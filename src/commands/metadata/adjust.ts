#!/usr/bin/env node

import * as path from 'path';
import * as fs from 'fs';
import { execSync } from 'child_process';
import { SfMetadataAdjuster } from '../../sf-metadata-adjuster.js';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('sf-metadata-adjust', 'metadata.adjust');

export class MetadataAdjustCommand extends SfCommand<void> {
  public static readonly summary = messages.getMessage('Summary');
  public static readonly description = messages.getMessage('Description');
  public static readonly examples = messages.getMessages('Examples');

  public static readonly flags = {
      targetDir: Flags.string({
        char: 'd',
        summary: messages.getMessage('flags.targetDir.summary'),
        description: messages.getMessage('flags.targetDir.description'),
        default: '.',
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
    const { flags } = await this.parse(MetadataAdjustCommand);
    const targetDir = flags.targetDir || flags.path || process.cwd();
    
    // Start timer
    const startTime = Date.now();
    
    // Display include types if specified
    if (flags.includeTypes.length > 0) {
      console.log(`\n🎯 Including only: ${flags.includeTypes.join(', ')}`);
    }
    
    // Display exclude types if specified
    if (flags.excludeTypes.length > 0) {
      console.log(`\n🚫 Excluding: ${flags.excludeTypes.join(', ')}`);
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

        const adjuster = new SfMetadataAdjuster(targetDir, flags.includeTypes, flags.excludeTypes);
        await adjuster.processSpecificFiles(changedFiles, flags.backup);
      } else {
        // Process all files in directory
        const adjuster = new SfMetadataAdjuster(targetDir, flags.includeTypes, flags.excludeTypes);
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

export default MetadataAdjustCommand;