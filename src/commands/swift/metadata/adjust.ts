import * as path from 'path';
import * as fs from 'fs';
import { execSync } from 'child_process';
import { SfMetadataAdjuster } from '../../../sf-metadata-adjuster.js';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import { Args } from '@oclif/core';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('sf-swift', 'metadata.adjust');

export default class MetadataAdjust extends SfCommand<void> {
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly args = {
    path: Args.string({
      description: messages.getMessage('args.path.description'),
      required: false,
    }),
  };

  public static readonly flags = {
    targetDir: Flags.string({
      char: 'd',
      description: messages.getMessage('flags.targetDir.description'),
    }),
    backup: Flags.boolean({
      description: messages.getMessage('flags.backup.description'),
      default: false,
    }),
    gitDepth: Flags.integer({
      char: 'g',
      description: messages.getMessage('flags.gitDepth.description'),
      default: 0,
    }),
    include: Flags.string({
      char: 'i',
      description: messages.getMessage('flags.include.description'),
      multiple: true,
      delimiter: ',',
    }),
    exclude: Flags.string({
      char: 'e',
      description: messages.getMessage('flags.exclude.description'),
      multiple: true,
      delimiter: ',',
    }),
  };

  /**
   * Get list of *-meta.xml files changed in the last N commits
   */
  private getChangedMetadataFiles(gitDepth: number, targetPath: string): string[] {
    try {
      // Check if we're in a git repository
      execSync('git rev-parse --git-dir', { cwd: targetPath, stdio: 'ignore' });
      
      // Check total number of commits to avoid "unknown revision" errors
      const commitCount = parseInt(
        execSync('git rev-list --count HEAD', { cwd: targetPath, encoding: 'utf8' }).trim(),
        10
      );
      
      const actualDepth = Math.min(gitDepth, commitCount - 1);
      
      if (actualDepth <= 0) {
        console.log('ℹ️  Not enough commits for git-depth analysis, processing all files...');
        return []; // Fall back to full directory scan
      }
      
      // Get changed files from the last N commits
      const gitCommand = `git diff --name-only HEAD~${actualDepth} HEAD`;
      const changedFiles = execSync(gitCommand, { cwd: targetPath, encoding: 'utf8' })
        .split('\n')
        .filter(file => file.trim() !== '')
        .filter(file => file.endsWith('-meta.xml'))
        .map(file => path.resolve(targetPath, file))
        .filter(file => fs.existsSync(file)); // Only include files that still exist

      console.log(`🔍 Found ${changedFiles.length} changed *-meta.xml files in last ${actualDepth} commits`);
      
      if (actualDepth < gitDepth) {
        console.log(`ℹ️  Note: Only ${commitCount} commits available, used depth of ${actualDepth} instead of ${gitDepth}`);
      }
      
      if (changedFiles.length === 0) {
        console.log('ℹ️  No metadata files have changed in the specified commit range');
      }
      
      return changedFiles;
    } catch (error) {
      if (gitDepth > 0) {
        console.error(`❌ Git operation failed: ${error instanceof Error ? error.message : error}`);
        console.error('   Falling back to scanning entire directory...');
      }
      return []; // Return empty array to trigger fallback to full directory scan
    }
  }

  /**
   * Execute the command
   */
  public async run(): Promise<void> {
    const { args, flags } = await this.parse(MetadataAdjust);
    
    // Priority: path argument > targetDir flag > current directory
    const targetDir = args.path || flags.targetDir || process.cwd();
    
    // Start timer
    const startTime = Date.now();
    
    // Convert flag values to arrays (handle undefined)
    const includeTypes = flags.include || [];
    const excludeTypes = flags.exclude || [];
    
    // Display include types if specified
    if (includeTypes.length > 0) {
      console.log(`\n🎯 Including only: ${includeTypes.join(', ')}`);
    }
    
    // Display exclude types if specified
    if (excludeTypes.length > 0) {
      console.log(`\n🚫 Excluding: ${excludeTypes.join(', ')}`);
    }

    try {
      // If git-depth is specified, process only changed files
      if (flags.gitDepth > 0) {
        const changedFiles = this.getChangedMetadataFiles(flags.gitDepth, targetDir);
        
        if (changedFiles.length === 0) {
          console.log(`\n🔍 No *-meta.xml files found in last ${flags.gitDepth} commits`);
          // Calculate and display elapsed time even for early return
          const endTime = Date.now();
          const elapsedSeconds = ((endTime - startTime) / 1000).toFixed(2);
          console.log(`\n⏱️  Completed in ${elapsedSeconds} seconds`);
          return;
        }

        const adjuster = new SfMetadataAdjuster(targetDir, includeTypes, excludeTypes);
        await adjuster.processSpecificFiles(changedFiles, flags.backup);
      } else {
        // Process all files in directory
        const adjuster = new SfMetadataAdjuster(targetDir, includeTypes, excludeTypes);
        await adjuster.process(flags.backup);
      }
      
      // Calculate and display elapsed time
      const endTime = Date.now();
      const elapsedSeconds = ((endTime - startTime) / 1000).toFixed(2);
      console.log(`\n⏱️  Completed in ${elapsedSeconds} seconds`);
    } catch (error) {
      console.error('❌ Error:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  }
}