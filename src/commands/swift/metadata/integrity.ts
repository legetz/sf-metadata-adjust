import { SfCommand, Flags } from "@salesforce/sf-plugins-core";
import { Messages, SfError } from "@salesforce/core";
import { AnyJson } from "@salesforce/ts-types";
import { Args } from "@oclif/core";
import { execSync } from "child_process";
import * as fs from "fs/promises";
import * as path from "path";
import { ensureDirectory } from "../../../common/helper/filesystem.js";
import { findFilesBySuffix } from "../../../common/helper/file-finder.js";
import { parseMetadataXml } from "../../../common/xml/xml-helpers.js";
import {
  buildRemovedMetadataIndex,
  createManualRemovedItem,
  classifyRemovedMetadataFile,
  CustomFieldReferenceContext,
  findCustomFieldIssuesInContent,
  findIntegrityIssuesInMetadata,
  findIntegrityIssuesInSource,
  IntegrityIssue,
  RemovedMetadataItem
} from "../../../common/metadata/metadata-integrity.js";
import {
  getSurfacesForRemovedTypes,
  IntegrityReferenceSurface
} from "../../../common/metadata/metadata-integrity-rules.js";

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages("sf-swift", "metadata.integrity");

export type MetadataIntegrityResult = {
  removedItems: RemovedMetadataItem[];
  issues: IntegrityIssue[];
  gitDepthUsed: number;
};

export default class MetadataIntegrity extends SfCommand<MetadataIntegrityResult> {
  public static readonly description = messages.getMessage("description");
  public static readonly examples = messages.getMessages("examples");

  public static readonly args = {
    path: Args.string({
      description: messages.getMessage("args.path.description"),
      required: false
    })
  };

  public static readonly flags = {
    "target-dir": Flags.string({
      char: "d",
      description: messages.getMessage("flags.targetDir.description")
    }),
    "git-depth": Flags.integer({
      char: "g",
      description: messages.getMessage("flags.gitDepth.description"),
      default: 5
    }),
    "test-with-class": Flags.string({
      description: messages.getMessage("flags.testWithClass.description"),
      multiple: true
    }),
    "test-with-field": Flags.string({
      description: messages.getMessage("flags.testWithField.description"),
      multiple: true
    })
  };

  public async run(): Promise<MetadataIntegrityResult> {
    const { args, flags } = await this.parse(MetadataIntegrity);
    const targetDir = args.path || flags["target-dir"] || process.cwd();
    ensureDirectory(targetDir, this.error.bind(this));

    const start = Date.now();
    const gitDepth = flags["git-depth"] ?? 5;

    const { removedItems, actualDepth } = this.getRemovedMetadataItems(targetDir, gitDepth);
    const manualClasses = this.normalizeStringArray(flags["test-with-class"]);
    const manualFields = this.normalizeStringArray(flags["test-with-field"]);

    for (const identifier of manualClasses) {
      const manualItem = createManualRemovedItem(identifier, "ApexClass");
      if (!manualItem) {
        this.warn(messages.getMessage("warn.testWithClassInvalid", [identifier]));
        continue;
      }

      if (!this.manualItemAlreadyTracked(removedItems, manualItem)) {
        removedItems.push(manualItem);
      }
    }

    for (const identifier of manualFields) {
      const manualItem = createManualRemovedItem(identifier, "CustomField");
      if (!manualItem) {
        this.warn(messages.getMessage("warn.testWithFieldInvalid", [identifier]));
        continue;
      }

      if (!this.manualItemAlreadyTracked(removedItems, manualItem)) {
        removedItems.push(manualItem);
      }
    }

    if (actualDepth > 0 && actualDepth < gitDepth) {
      this.log(messages.getMessage("log.depthClamped", [actualDepth, gitDepth]));
    }

    if (removedItems.length === 0) {
      this.log(messages.getMessage("log.noDeletions"));
      const elapsedSeconds = ((Date.now() - start) / 1000).toFixed(2);
      this.log(messages.getMessage("log.elapsed", [elapsedSeconds]));
      return {
        removedItems,
        issues: [],
        gitDepthUsed: actualDepth
      };
    }

    this.log(messages.getMessage("log.removedHeader", [removedItems.length, actualDepth]));
    removedItems.forEach((item) => {
      this.log(`  • [${item.type}] ${item.name} (${item.sourceFile})`);
    });

    const removedIndex = buildRemovedMetadataIndex(removedItems);
    const surfacesToCheck = getSurfacesForRemovedTypes(new Set(removedItems.map((item) => item.type)));
    const shouldCheckAccessControl = this.shouldCheckAnySurface(surfacesToCheck, ["profile", "permissionSet"]);
    const shouldCheckSource = this.shouldCheckAnySurface(surfacesToCheck, ["apexSource", "lwc", "aura"]);

    const issues: IntegrityIssue[] = [];

    if (shouldCheckAccessControl) {
      const metadataFiles = this.collectMetadataFiles(targetDir);

      for (const metadataFile of metadataFiles) {
        try {
          const rawXml = await fs.readFile(metadataFile, "utf8");
          const parsed = await parseMetadataXml(rawXml);
          const relativePath = path.relative(targetDir, metadataFile) || path.basename(metadataFile);
          const fileIssues = findIntegrityIssuesInMetadata(parsed, relativePath, removedIndex);
          issues.push(...fileIssues);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          this.warn(messages.getMessage("warn.analysisFailed", [metadataFile, message]));
        }
      }

      this.log(messages.getMessage("log.metadataAnalysisComplete", [metadataFiles.length]));
    }

    if (shouldCheckSource) {
      const sourceFiles = this.collectSourceFiles(targetDir);
      this.log(messages.getMessage("log.sourceAnalysisComplete", [sourceFiles.length]));

      for (const sourceFile of sourceFiles) {
        try {
          const content = await fs.readFile(sourceFile, "utf8");
          const relativePath = path.relative(targetDir, sourceFile) || path.basename(sourceFile);
          const sourceIssues = findIntegrityIssuesInSource(content, relativePath, removedIndex);
          issues.push(...sourceIssues);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          this.warn(messages.getMessage("warn.analysisFailed", [sourceFile, message]));
        }
      }
    }

    if (surfacesToCheck.has("flow")) {
      const flowFiles = this.collectFlowFiles(targetDir);
      this.log(messages.getMessage("log.flowAnalysisComplete", [flowFiles.length]));

      for (const flowFile of flowFiles) {
        try {
          const xml = await fs.readFile(flowFile, "utf8");
          const relativePath = path.relative(targetDir, flowFile) || path.basename(flowFile);
          const flowObjects = this.extractFlowObjects(xml);
          const flowIssues = [
            ...findIntegrityIssuesInSource(xml, relativePath, removedIndex),
            ...findCustomFieldIssuesInContent(xml, relativePath, removedIndex, "Flow", flowObjects)
          ];
          issues.push(...flowIssues);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          this.warn(messages.getMessage("warn.analysisFailed", [flowFile, message]));
        }
      }
    }

    if (surfacesToCheck.has("formulaField")) {
      const fieldFiles = this.collectCustomFieldFiles(targetDir);
      this.log(messages.getMessage("log.formulaAnalysisComplete", [fieldFiles.length]));
      await this.processFormulaFieldFileSet(fieldFiles, targetDir, removedIndex, issues);
    }

    if (surfacesToCheck.has("layout")) {
      const layoutFiles = this.collectLayoutFiles(targetDir);
      this.log(messages.getMessage("log.layoutAnalysisComplete", [layoutFiles.length]));
      await this.processCustomFieldFileSet(layoutFiles, targetDir, removedIndex, "Layout", issues);
    }

    if (surfacesToCheck.has("validationRule")) {
      const validationRuleFiles = this.collectValidationRuleFiles(targetDir);
      this.log(messages.getMessage("log.validationAnalysisComplete", [validationRuleFiles.length]));
      await this.processCustomFieldFileSet(validationRuleFiles, targetDir, removedIndex, "Validation Rule", issues);
    }

    if (surfacesToCheck.has("fieldSet")) {
      const fieldSetFiles = this.collectFieldSetFiles(targetDir);
      this.log(messages.getMessage("log.fieldSetAnalysisComplete", [fieldSetFiles.length]));
      await this.processCustomFieldFileSet(fieldSetFiles, targetDir, removedIndex, "Field Set", issues);
    }

    if (surfacesToCheck.has("recordType")) {
      const recordTypeFiles = this.collectRecordTypeFiles(targetDir);
      this.log(messages.getMessage("log.recordTypeAnalysisComplete", [recordTypeFiles.length]));
      await this.processCustomFieldFileSet(recordTypeFiles, targetDir, removedIndex, "Record Type", issues);
    }

    if (surfacesToCheck.has("compactLayout")) {
      const compactLayoutFiles = this.collectCompactLayoutFiles(targetDir);
      this.log(messages.getMessage("log.compactLayoutAnalysisComplete", [compactLayoutFiles.length]));
      await this.processCustomFieldFileSet(compactLayoutFiles, targetDir, removedIndex, "Compact Layout", issues);
    }

    if (issues.length === 0) {
      const elapsedSeconds = ((Date.now() - start) / 1000).toFixed(2);
      this.log(messages.getMessage("log.noIssues"));
      this.log(messages.getMessage("log.elapsed", [elapsedSeconds]));
      return {
        removedItems,
        issues,
        gitDepthUsed: actualDepth
      };
    }

    this.log(messages.getMessage("log.issuesHeader", [issues.length]));
    issues.forEach((issue) => {
      this.log(`  • ${issue.detail} → ${issue.referencingFile}`);
    });

    const elapsedSeconds = ((Date.now() - start) / 1000).toFixed(2);
    this.log(messages.getMessage("log.elapsed", [elapsedSeconds]));

    const result: MetadataIntegrityResult = {
      removedItems,
      issues,
      gitDepthUsed: actualDepth
    };

    const error = new SfError(messages.getMessage("error.issuesFound", [issues.length]), "MetadataIntegrityError");
    error.data = JSON.parse(JSON.stringify(result)) as AnyJson;

    this.error(error, { exit: 1 });

    return result;
  }

  private getRemovedMetadataItems(
    targetDir: string,
    gitDepth: number
  ): {
    removedItems: RemovedMetadataItem[];
    actualDepth: number;
  } {
    if (gitDepth <= 0) {
      return { removedItems: [], actualDepth: 0 };
    }

    try {
      execSync("git rev-parse --git-dir", { cwd: targetDir, stdio: "ignore" });
    } catch {
      this.warn(messages.getMessage("warn.notGitRepo", [targetDir]));
      return { removedItems: [], actualDepth: 0 };
    }

    try {
      const commitCountRaw = execSync("git rev-list --count HEAD", { cwd: targetDir, encoding: "utf8" }).trim();
      const commitCount = parseInt(commitCountRaw, 10);
      const maxDepth = Math.max(commitCount - 1, 0);
      const actualDepth = Math.min(gitDepth, maxDepth);

      if (actualDepth <= 0) {
        return { removedItems: [], actualDepth: 0 };
      }

      const diffCommand = `git diff --name-status HEAD~${actualDepth} HEAD`;
      const diffOutput = execSync(diffCommand, { cwd: targetDir, encoding: "utf8" });

      const rawItems: RemovedMetadataItem[] = [];

      diffOutput
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .forEach((line) => {
          const [status, filePath] = line.split(/\s+/, 2);
          if (status !== "D" || !filePath) {
            return;
          }

          const normalizedPath = path.normalize(filePath);
          const classified = classifyRemovedMetadataFile(normalizedPath);

          if (classified) {
            rawItems.push(classified);
          }
        });

      const index = buildRemovedMetadataIndex(rawItems);
      const deduped: RemovedMetadataItem[] = [];
      for (const typeMap of index.values()) {
        for (const item of typeMap.values()) {
          if (!deduped.some((existing) => existing.referenceKey === item.referenceKey && existing.type === item.type)) {
            deduped.push(item);
          }
        }
      }

      return { removedItems: deduped, actualDepth };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.warn(messages.getMessage("warn.gitError", [message]));
      return { removedItems: [], actualDepth: 0 };
    }
  }

  private collectMetadataFiles(targetDir: string): string[] {
    const files = new Set<string>();
    findFilesBySuffix(targetDir, ".profile-meta.xml").forEach((file) => files.add(file));
    findFilesBySuffix(targetDir, ".permissionset-meta.xml").forEach((file) => files.add(file));
    return Array.from(files);
  }

  private collectSourceFiles(targetDir: string): string[] {
    const files = new Set<string>();

    findFilesBySuffix(targetDir, ".cls").forEach((file) => {
      if (file.includes(`${path.sep}classes${path.sep}`)) {
        files.add(file);
      }
    });

    findFilesBySuffix(targetDir, ".trigger").forEach((file) => {
      if (file.includes(`${path.sep}triggers${path.sep}`)) {
        files.add(file);
      }
    });

    findFilesBySuffix(targetDir, ".js").forEach((file) => {
      if (file.includes(`${path.sep}lwc${path.sep}`) || file.includes(`${path.sep}aura${path.sep}`)) {
        files.add(file);
      }
    });

    findFilesBySuffix(targetDir, ".ts").forEach((file) => {
      if (file.includes(`${path.sep}lwc${path.sep}`)) {
        files.add(file);
      }
    });

    [".cmp", ".app", ".evt", ".auradoc", ".design"].forEach((suffix) => {
      findFilesBySuffix(targetDir, suffix).forEach((file) => files.add(file));
    });

    findFilesBySuffix(targetDir, ".page").forEach((file) => {
      if (file.includes(`${path.sep}pages${path.sep}`)) {
        files.add(file);
      }
    });

    findFilesBySuffix(targetDir, ".component").forEach((file) => {
      if (file.includes(`${path.sep}components${path.sep}`)) {
        files.add(file);
      }
    });

    findFilesBySuffix(targetDir, ".html").forEach((file) => {
      if (file.includes(`${path.sep}lwc${path.sep}`) || file.includes(`${path.sep}aura${path.sep}`)) {
        files.add(file);
      }
    });

    return Array.from(files);
  }

  private collectFlowFiles(targetDir: string): string[] {
    return findFilesBySuffix(targetDir, ".flow-meta.xml");
  }

  private collectCustomFieldFiles(targetDir: string): string[] {
    return findFilesBySuffix(targetDir, ".field-meta.xml");
  }

  private collectLayoutFiles(targetDir: string): string[] {
    return findFilesBySuffix(targetDir, ".layout-meta.xml");
  }

  private collectValidationRuleFiles(targetDir: string): string[] {
    return findFilesBySuffix(targetDir, ".object-meta.xml");
  }

  private collectFieldSetFiles(targetDir: string): string[] {
    return findFilesBySuffix(targetDir, ".fieldSet-meta.xml");
  }

  private collectRecordTypeFiles(targetDir: string): string[] {
    return findFilesBySuffix(targetDir, ".recordType-meta.xml");
  }

  private collectCompactLayoutFiles(targetDir: string): string[] {
    return findFilesBySuffix(targetDir, ".compactLayout-meta.xml");
  }

  private shouldCheckAnySurface(
    surfaces: Set<IntegrityReferenceSurface>,
    targets: IntegrityReferenceSurface[]
  ): boolean {
    return targets.some((surface) => surfaces.has(surface));
  }

  private async processCustomFieldFileSet(
    files: string[],
    targetDir: string,
    removedIndex: ReturnType<typeof buildRemovedMetadataIndex>,
    context: CustomFieldReferenceContext,
    issues: IntegrityIssue[]
  ): Promise<void> {
    for (const file of files) {
      try {
        const rawContent = await fs.readFile(file, "utf8");
        const relativePath = path.relative(targetDir, file) || path.basename(file);
        const metadataObject = this.extractObjectNameFromFile(file);
        const fileIssues = findCustomFieldIssuesInContent(
          rawContent,
          relativePath,
          removedIndex,
          context,
          metadataObject
        );
        issues.push(...fileIssues);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.warn(messages.getMessage("warn.analysisFailed", [file, message]));
      }
    }
  }

  private async processFormulaFieldFileSet(
    files: string[],
    targetDir: string,
    removedIndex: ReturnType<typeof buildRemovedMetadataIndex>,
    issues: IntegrityIssue[]
  ): Promise<void> {
    const fieldIndex = removedIndex.get("CustomField");
    if (!fieldIndex || fieldIndex.size === 0) {
      return;
    }

    for (const file of files) {
      try {
        const rawContent = await fs.readFile(file, "utf8");
        const formula = this.extractFormulaFromCustomField(rawContent);
        if (!formula) {
          continue;
        }

        const relativePath = path.relative(targetDir, file) || path.basename(file);
        const metadataObject = this.extractObjectNameFromFile(file);
        const fieldReference = this.extractFieldReferenceFromFile(file);
        const formulaIssues = findCustomFieldIssuesInContent(
          formula,
          relativePath,
          removedIndex,
          "Formula Field",
          metadataObject
        );

        const filtered = fieldReference
          ? formulaIssues.filter((issue) => issue.missingItem !== fieldReference)
          : formulaIssues;
        issues.push(...filtered);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.warn(messages.getMessage("warn.analysisFailed", [file, message]));
      }
    }
  }

  private extractObjectNameFromFile(filePath: string): string | undefined {
    const normalized = filePath.split(path.sep).join("/");

    const dirMatch = normalized.match(/\/objects\/([^/]+)\//i);
    if (dirMatch) {
      return dirMatch[1];
    }

    const objectFileMatch = normalized.match(/\/objects\/([^/.]+)\.object-meta\.xml$/i);
    if (objectFileMatch) {
      return objectFileMatch[1];
    }

    const layoutMatch = normalized.match(/\/layouts\/([^/]+)-[^/]+\.layout-meta\.xml$/i);
    if (layoutMatch) {
      return layoutMatch[1];
    }

    return undefined;
  }

  private extractFieldReferenceFromFile(filePath: string): string | undefined {
    const normalized = filePath.split(path.sep).join("/");
    const match = normalized.match(/\/objects\/([^/]+)\/fields\/([^/]+)\.field-meta\.xml$/i);
    if (!match) {
      return undefined;
    }
    return `${match[1]}.${match[2]}`;
  }

  private extractFlowObjects(xml: string): string[] {
    const matches = xml.match(/<\s*(?:object|objectType)\s*>([^<]+)<\/\s*(?:object|objectType)\s*>/gi) ?? [];
    const objects = new Set<string>();

    for (const match of matches) {
      const valueMatch = match.match(/>([^<]+)</);
      const candidate = valueMatch?.[1]?.trim();
      if (candidate) {
        objects.add(candidate);
      }
    }

    return Array.from(objects);
  }

  private normalizeStringArray(input: string | string[] | undefined): string[] {
    if (!input) {
      return [];
    }

    const values = Array.isArray(input) ? input : [input];
    return values.map((value) => value?.trim()).filter((value): value is string => Boolean(value && value.length > 0));
  }

  private manualItemAlreadyTracked(removedItems: RemovedMetadataItem[], candidate: RemovedMetadataItem): boolean {
    return removedItems.some((item) => item.type === candidate.type && item.referenceKey === candidate.referenceKey);
  }

  private extractFormulaFromCustomField(rawContent: string): string | undefined {
    const match = rawContent.match(/<formula>([\s\S]*?)<\/formula>/i);
    if (!match) {
      return undefined;
    }

    let formula = match[1]?.trim() ?? "";
    if (!formula) {
      return undefined;
    }

    if (formula.startsWith("<![CDATA[")) {
      formula = formula
        .slice(9)
        .replace(/\]\]>$/, "")
        .trim();
    }

    return formula.length > 0 ? formula : undefined;
  }
}
