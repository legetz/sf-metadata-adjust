import { SfCommand, Flags } from "@salesforce/sf-plugins-core";
import { Messages } from "@salesforce/core";
import { Args } from "@oclif/core";
import * as path from "path";
import { ensureDirectory } from "../../../../common/helper/filesystem.js";
import { findFilesBySuffix } from "../../../../common/helper/file-finder.js";

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages("sf-swift", "detect.git.conflicts");

export type ConflictResult = {
  count: number;
  conflictFiles: string[];
};

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

    ensureDirectory(targetDir, this.error.bind(this));

    this.log(`🔍 Scan GIT conflict (.rej) files in ${targetDir}`);
    const conflictCount = 0;
    try {
      const conflictFiles = findFilesBySuffix(targetDir, ".rej");
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
