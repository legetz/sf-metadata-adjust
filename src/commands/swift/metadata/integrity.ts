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
  classifyRemovedMetadataFile,
  findIntegrityIssuesInMetadata,
  IntegrityIssue,
  RemovedMetadataItem
} from "../../../common/metadata/metadata-integrity.js";

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
    })
  };

  public async run(): Promise<MetadataIntegrityResult> {
    const { args, flags } = await this.parse(MetadataIntegrity);
    const targetDir = args.path || flags["target-dir"] || process.cwd();
    ensureDirectory(targetDir, this.error.bind(this));

    const start = Date.now();
    const gitDepth = flags["git-depth"] ?? 5;

    const { removedItems, actualDepth } = this.getRemovedMetadataItems(targetDir, gitDepth);

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
    const metadataFiles = new Set<string>();
    findFilesBySuffix(targetDir, ".profile-meta.xml").forEach((file) => metadataFiles.add(file));
    findFilesBySuffix(targetDir, ".permissionset-meta.xml").forEach((file) => metadataFiles.add(file));

    const issues: IntegrityIssue[] = [];

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

    this.log(messages.getMessage("log.analysisComplete", [metadataFiles.size]));

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
}
