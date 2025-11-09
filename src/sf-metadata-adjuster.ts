import * as fs from "fs";
import * as path from "path";
import { sortXmlElements } from "./common/xml/sorter.js";
import { createFileBackup } from "./common/helper/backup.js";
import { hashString } from "./common/helper/string.js";
import {
  ALLOWED_METADATA_TYPES,
  DEFAULT_EXCLUSIONS,
  ALWAYS_EXCLUDED,
  ELEMENT_CLEANUP_RULES
} from "./common/metadata/metadata-rules.js";
import { parseMetadataXml, prefixXmlEntities, buildMetadataXml, XmlObject } from "./common/xml/xml-helpers.js";

interface ProcessingStats {
  processed: number;
  unchanged: number;
  modified: number;
  skipped: number;
  errors: number;
  files: string[];
  unchangedFiles: string[];
}

export class SfMetadataAdjuster {
  private folderPath: string;
  private includeTypes: string[];
  private excludeTypes: string[];
  private allowAll: boolean;
  private specificFiles: string[] | null = null;
  private stats: ProcessingStats = {
    processed: 0,
    unchanged: 0,
    modified: 0,
    skipped: 0,
    errors: 0,
    files: [],
    unchangedFiles: []
  };

  constructor(folderPath: string, includeTypes: string[] = [], excludeTypes: string[] = [], allowAll: boolean = false) {
    this.folderPath = folderPath;
    this.allowAll = allowAll;

    this.includeTypes = includeTypes.map((t) => {
      // Normalize type names - ensure they end with -meta.xml
      if (!t.endsWith("-meta.xml")) {
        return `${t}-meta.xml`;
      }
      return t;
    });

    // If no exclude types specified, use defaults; otherwise use the provided exclusions
    if (excludeTypes.length === 0) {
      this.excludeTypes = [...DEFAULT_EXCLUSIONS];
    } else {
      this.excludeTypes = excludeTypes.map((t) => {
        // Normalize type names - ensure they end with -meta.xml
        if (!t.endsWith("-meta.xml")) {
          return `${t}-meta.xml`;
        }
        return t;
      });
    }

    // Validate that include types don't conflict with always-excluded types
    this.validateIncludeTypes();

    // Validate that include types are whitelisted (unless --all is specified)
    this.validateWhitelistedTypes();
  }

  /**
   * Validate that include types are whitelisted when --all is not specified
   */
  private validateWhitelistedTypes(): void {
    // Skip validation if --all flag is used or no include types specified
    if (this.allowAll || this.includeTypes.length === 0) {
      return;
    }

    const nonWhitelistedTypes: string[] = [];

    for (const includeType of this.includeTypes) {
      const isWhitelisted = ALLOWED_METADATA_TYPES.some((allowedType) => includeType.endsWith(allowedType));

      if (!isWhitelisted) {
        nonWhitelistedTypes.push(includeType);
      }
    }

    if (nonWhitelistedTypes.length > 0) {
      const nonWhitelistedList = nonWhitelistedTypes.join(", ");
      const allowedList = ALLOWED_METADATA_TYPES.join(", ");
      throw new Error(
        `Invalid configuration: The following types are not in the allowed whitelist: ${nonWhitelistedList}.\n` +
          `Allowed types: ${allowedList}\n` +
          `Use --all flag to process all metadata types without whitelist restrictions.`
      );
    }
  }

  /**
   * Validate that include types don't conflict with always-excluded types
   */
  private validateIncludeTypes(): void {
    if (this.includeTypes.length === 0) {
      return; // No include types specified, nothing to validate
    }

    const conflictingTypes: string[] = [];

    for (const includeType of this.includeTypes) {
      for (const alwaysExcludedType of ALWAYS_EXCLUDED) {
        if (includeType.endsWith(alwaysExcludedType)) {
          conflictingTypes.push(includeType);
          break;
        }
      }
    }

    if (conflictingTypes.length > 0) {
      const conflictList = conflictingTypes.join(", ");
      const alwaysExcludedList = ALWAYS_EXCLUDED.join(", ");
      throw new Error(
        `Invalid configuration: The following types cannot be included as they require special handling: ${conflictList}. ` +
          `Always excluded types: ${alwaysExcludedList}`
      );
    }
  }

  /**
   * Check if a file should be excluded based on the exclude list
   */
  private shouldExcludeFile(filePath: string): boolean {
    const fileName = path.basename(filePath);

    // Always exclude types that require special handling
    const isAlwaysExcluded = ALWAYS_EXCLUDED.some((excludePattern) => fileName.endsWith(excludePattern));
    if (isAlwaysExcluded) {
      return true;
    }

    // Check regular exclusion list
    return this.excludeTypes.some((excludePattern) => fileName.endsWith(excludePattern));
  }

  /**
   * Check if a file matches the include list (if specified)
   */
  private shouldIncludeFile(filePath: string): boolean {
    const fileName = path.basename(filePath);

    // If include types are specified, check against them
    if (this.includeTypes.length > 0) {
      return this.includeTypes.some((includePattern) => fileName.endsWith(includePattern));
    }

    // If no include types specified and --all is NOT used, check against whitelist
    if (!this.allowAll) {
      return ALLOWED_METADATA_TYPES.some((allowedType) => fileName.endsWith(allowedType));
    }

    // If --all is used and no specific includes, accept all files (except excludes)
    return true;
  }

  /**
   * Find all *-meta.xml files recursively in the folder
   */
  private findMetadataFiles(dir: string): string[] {
    const files: string[] = [];

    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          // Skip node_modules and .git directories for performance
          if (entry.name === "node_modules" || entry.name === ".git") {
            continue;
          }
          // Recursively search subdirectories
          files.push(...this.findMetadataFiles(fullPath));
        } else if (entry.isFile() && entry.name.endsWith("-meta.xml")) {
          // Check if file should be excluded
          if (this.shouldExcludeFile(fullPath)) {
            this.stats.skipped++;
            continue;
          }
          // Check if file matches include list
          if (!this.shouldIncludeFile(fullPath)) {
            this.stats.skipped++;
            continue;
          }
          files.push(fullPath);
        }
      }
    } catch (error) {
      console.error(`❌ Error reading directory ${dir}: ${error}`);
    }

    return files;
  }

  /**
   * Read and parse XML file
   */
  private async readXmlFile(filePath: string): Promise<string> {
    try {
      return fs.readFileSync(filePath, "utf8");
    } catch (error) {
      throw new Error(`Failed to read XML file: ${error}`);
    }
  }

  /**
   * Fix incorrect xmlns namespace for metadata files
   * Corrects tooling API namespace to standard metadata namespace
   */
  private fixXmlNamespace(xmlObject: XmlObject): XmlObject {
    // Check if object has attributes
    if (xmlObject.$ && typeof xmlObject.$ === "object") {
      const attrs = xmlObject.$;

      // Check if xmlns contains the tooling metadata namespace
      if (attrs.xmlns && typeof attrs.xmlns === "string" && attrs.xmlns.includes("metadata.tooling")) {
        // Replace with correct metadata namespace
        attrs.xmlns = "http://soap.sforce.com/2006/04/metadata";
      }

      // Remove fqn attribute if it exists (not needed in metadata API)
      if (attrs.fqn) {
        delete attrs.fqn;
      }
    }

    return xmlObject;
  }

  /**
   * Clean up metadata by removing elements with default/false values
   * Uses configuration-driven approach for different metadata types
   */
  private cleanupElements(xmlObject: XmlObject, filePath: string): XmlObject {
    // Find matching metadata type rule
    const metadataType = Object.keys(ELEMENT_CLEANUP_RULES).find((type) => filePath.endsWith(type));

    if (!metadataType) {
      return xmlObject; // No cleanup rules for this type
    }

    const rules = ELEMENT_CLEANUP_RULES[metadataType];

    // Apply cleanup rules for each element
    for (const rule of rules) {
      const { elementName, removeValues, conditions } = rule;

      // Check if element exists and has a value that should be removed
      if (
        !xmlObject[elementName] ||
        !Array.isArray(xmlObject[elementName]) ||
        !removeValues.includes(xmlObject[elementName][0])
      ) {
        continue;
      }

      // Check conditions if specified
      if (conditions) {
        let allConditionsMet = true;

        for (const condition of conditions) {
          const conditionElement = xmlObject[condition.elementName];
          if (
            !conditionElement ||
            !Array.isArray(conditionElement) ||
            !condition.values.includes(conditionElement[0])
          ) {
            allConditionsMet = false;
            break;
          }
        }

        if (!allConditionsMet) {
          continue; // Don't remove if conditions aren't met
        }
      }

      // All conditions met, remove the element
      delete xmlObject[elementName];
    }

    return xmlObject;
  }

  /**
   * Process a single XML file
   */
  private async processFile(filePath: string): Promise<boolean> {
    const relativePath = path.relative(this.folderPath, filePath);

    try {
      // Read the file
      const originalXml = await this.readXmlFile(filePath);

      // Prefix XML entities with markers before parsing to preserve them
      const prefixedXml = prefixXmlEntities(originalXml);

      // Parse the prefixed XML
      let xmlObject;
      try {
        xmlObject = await parseMetadataXml(prefixedXml);
      } catch (parseError) {
        // XML is not valid - skip this file with a warning
        console.log(`⚠️  Skipped (invalid XML): ${relativePath}`);
        this.stats.skipped++;
        return false;
      }

      // Fix incorrect xmlns namespace (e.g., tooling API namespace)
      const fixedObject = this.fixXmlNamespace(xmlObject);

      // Clean up metadata elements (remove default/false values based on rules)
      const cleanedObject = this.cleanupElements(fixedObject, filePath);

      // Sort the elements using imported sorter with file path for rule-based sorting
      const sortedObject = sortXmlElements(cleanedObject, undefined, filePath);

      // Build the XML
      const sortedXml = buildMetadataXml(sortedObject, originalXml);

      // Make sha256 hash of original and sorted XML
      const originalHash = hashString(originalXml);
      const sortedHash = hashString(sortedXml);

      // Compare original and sorted to see if changes are needed
      const needsUpdate = originalHash !== sortedHash;

      if (needsUpdate) {
        // Write back to the same file (replace original)
        fs.writeFileSync(filePath, sortedXml, "utf8");
        console.log(`✏️  Modified: ${relativePath}`);
        this.stats.modified++;
        this.stats.files.push(relativePath);
      } else {
        this.stats.unchanged++;
        this.stats.unchangedFiles.push(relativePath);
      }

      this.stats.processed++;

      return true;
    } catch (error) {
      console.error(`❌ Error processing ${relativePath}: ${error}`);
      this.stats.errors++;
      return false;
    }
  }

  /**
   * Set specific files to process instead of scanning the directory
   * @param files - Array of file paths to process
   */
  setFiles(files: string[]): void {
    this.specificFiles = files;
  }

  /**
   * Get the list of files to process
   * Either returns specific files (if set) or scans the directory
   */
  private getFilesToProcess(): string[] {
    if (this.specificFiles !== null) {
      // Filter specific files
      return this.specificFiles.filter((file) => {
        if (!fs.existsSync(file)) {
          console.log(`⚠️  File not found, skipping: ${path.relative(this.folderPath, file)}`);
          return false;
        }
        if (!file.endsWith("-meta.xml")) {
          console.log(`⚠️  Not a metadata file, skipping: ${path.relative(this.folderPath, file)}`);
          return false;
        }
        // Check exclude list
        if (this.shouldExcludeFile(file)) {
          this.stats.skipped++;
          return false;
        }
        // Check include list
        if (!this.shouldIncludeFile(file)) {
          this.stats.skipped++;
          return false;
        }
        return true;
      });
    } else {
      // Scan directory
      return this.findMetadataFiles(this.folderPath);
    }
  }

  /**
   * Main process: find and adjust all metadata files
   */
  async process(createBackup: boolean = true): Promise<void> {
    try {
      // Reset stats
      this.stats = {
        processed: 0,
        unchanged: 0,
        modified: 0,
        skipped: 0,
        errors: 0,
        files: [],
        unchangedFiles: []
      };

      if (this.specificFiles !== null) {
        if (this.specificFiles.length === 0) {
          console.log("ℹ️  No files specified for processing");
          return;
        }
      } else {
        console.log(`🔍 Scanning for *-meta.xml files in: ${this.folderPath}`);
      }

      const metadataFiles = this.getFilesToProcess();

      if (metadataFiles.length === 0) {
        if (this.specificFiles !== null) {
          console.log("ℹ️  No valid metadata files to process");
        } else {
          console.log("ℹ️  No *-meta.xml files found in the specified directory");
        }
        return;
      }

      console.log(`📋 ${this.specificFiles !== null ? "Processing" : "Found"} ${metadataFiles.length} metadata files`);

      // Create backup if requested
      if (createBackup) {
        createFileBackup(metadataFiles, this.folderPath);
      }

      // Process each file
      for (const file of metadataFiles) {
        await this.processFile(file);
      }

      // Display summary
      this.displaySummary();
    } catch (error) {
      console.error("❌ Error processing metadata files:", error);
      process.exit(1);
    }
  }

  /**
   * Display processing summary
   */
  private displaySummary(): void {
    console.log("\n" + "=".repeat(60));
    console.log("📊 ADJUSTMENT SUMMARY");
    console.log("=".repeat(60));
    console.log(`📁 Total files checked: ${this.stats.processed} files`);
    console.log(`✏️ Modified: ${this.stats.modified} files`);
    console.log(`✅ Already good: ${this.stats.unchanged} files`);
    if (this.stats.skipped > 0) {
      console.log(`⏭️ Skipped: ${this.stats.skipped} files`);
    }
    console.log(`⚠️ Errors encountered: ${this.stats.errors} files`);

    if (this.stats.modified > 0) {
      console.log(
        `\n🎉 Successfully adjusted ${this.stats.modified} metadata file${this.stats.modified !== 1 ? "s" : ""}!`
      );
    } else if (this.stats.unchanged > 0) {
      console.log(`\n✨ All metadata files are already good!`);
    }
  }
}
