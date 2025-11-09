import { SfCommand, Flags } from "@salesforce/sf-plugins-core";
import { Messages } from "@salesforce/core";
import { Args } from "@oclif/core";
import * as fs from "fs";
import * as path from "path";

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages("sf-swift", "detect.git.conflicts");

export type ConflictResult = {
  count: number;
  conflictFiles: string[];
};

/**
 * Recursively searches for .rej files in the given directory
 * @param dir - The directory to search in
 * @returns Array of absolute paths to .rej files
 */
function findRejFiles(dir: string): string[] {
  const rejFiles: string[] = [];

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        // Skip .git and node_modules directories for performance
        if (entry.name !== ".git" && entry.name !== "node_modules") {
          rejFiles.push(...findRejFiles(fullPath));
        }
      } else if (entry.isFile() && entry.name.endsWith(".rej")) {
        rejFiles.push(fullPath);
      }
    }
  } catch (error) {
    // Ignore permission errors and continue with other directories
    if ((error as NodeJS.ErrnoException).code !== "EACCES" && (error as NodeJS.ErrnoException).code !== "EPERM") {
      throw error;
    }
  }

  return rejFiles;
}

export default class DetectGitConflicts extends SfCommand<ConflictResult> {
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
      description: messages.getMessage("flags.target-dir.description"),
      default: "."
    })
  };

  public async run(): Promise<ConflictResult> {
    const startTime = Date.now();
    const { args, flags } = await this.parse(DetectGitConflicts);

    // Priority: path argument > targetDir flag > current directory
    const targetDir = args.path || flags["target-dir"] || process.cwd();

    // Validate that the target directory exists
    if (!fs.existsSync(targetDir)) {
      this.error(`❌ Target directory does not exist: ${targetDir}`, { exit: 1 });
    }

    // Check if target is actually a directory
    const stats = fs.statSync(targetDir);
    if (!stats.isDirectory()) {
      this.error(`❌ Target path is not a directory: ${targetDir}`, { exit: 1 });
    }

    this.log(`🔍 Scan GIT conflict (.rej) files in ${targetDir}`);

    try {
      const conflictFiles = findRejFiles(targetDir);
      const conflictCount = conflictFiles.length;
      const elapsedTime = Date.now() - startTime;

      // Output JSON result
      const result: ConflictResult = {
        count: conflictCount,
        conflictFiles
      };

      // Display summary
      this.displaySummary(conflictCount, conflictFiles, elapsedTime, targetDir);

      // Exit with error code if conflicts were found
      if (conflictCount > 0) {
        this.error(`❌ Found ${conflictCount} Git conflict (.rej) files. Please resolve conflicts before proceeding.`, {
          exit: 1
        });
      }

      return result;
    } catch (error) {
      this.error(`❌ Error searching for .rej files: ${(error as Error).message}`, { exit: 1 });
    }
  }

  private displaySummary(
    conflictCount: number,
    conflictFiles: string[],
    elapsedTimeMs: number,
    targetDir: string
  ): void {
    const elapsedSeconds = (elapsedTimeMs / 1000).toFixed(2);

    this.log("\n" + "=".repeat(60));
    this.log("🔍 SCAN SUMMARY");
    this.log("=".repeat(60));
    this.log(`📁 Directory scanned: ${targetDir}`);
    this.log(`⏱️ Processing time: ${elapsedSeconds}s`);
    this.log(`📊 Conflict files found: ${conflictCount}`);

    if (conflictCount > 0) {
      this.log("❌ Conflict files detected:");
      conflictFiles.forEach((file, index) => {
        const relativePath = path.relative(targetDir, file);
        this.log(`  ${index + 1}. ${relativePath}`);
      });
    } else {
      this.log(`✅ No conflict files found - repository is clean!`);
    }
  }
}
