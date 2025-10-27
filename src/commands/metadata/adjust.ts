#!/usr/bin/env node

import * as path from 'path';
import * as fs from 'fs';
import { execSync } from 'child_process';
import SfMetadataAdjuster from '../../sf-metadata-adjuster';

/**
 * SF CLI Plugin Command: metadata adjust
 * 
 * This is a standalone implementation that can be integrated with SF CLI
 * Usage: sf metadata adjust [path] [--no-backup] [--target-dir <dir>]
 */
export class MetadataAdjustCommand {
  public static readonly summary = 'Sort and format Salesforce metadata XML files';
  public static readonly description = 'Recursively processes all *-meta.xml files in the specified directory, sorting XML elements alphabetically with special handling for Salesforce metadata structures like PermissionSets, Profiles, and other metadata types. Can optionally process only files changed in recent Git commits. Backups are disabled by default for CI/CD friendliness.';
  
  public static readonly examples = [
    'sf metadata adjust',
    'sf metadata adjust ./force-app/main/default',  
    'sf metadata adjust --backup',
    'sf metadata adjust --git-depth 3',
    'sf metadata adjust ./src/main/default --backup --git-depth 5',
    'sf metadata adjust --include permissionset',
    'sf metadata adjust --include permissionset,profile',
    'sf metadata adjust --git-depth 3 --include permissionset-meta.xml',
    'sf metadata adjust --exclude reportType,flexipage',
    'sf metadata adjust --exclude layout --include permissionset,profile'
  ];

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
   * Parse command line arguments
   */
  private parseArgs(args: string[]): { path?: string; backup: boolean; targetDir?: string; gitDepth: number; includeTypes: string[]; excludeTypes: string[] } {
    const result = {
      path: undefined as string | undefined,
      backup: false,
      targetDir: undefined as string | undefined,
      gitDepth: 0,
      includeTypes: [] as string[],
      excludeTypes: [] as string[],
    };

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      
      if (arg === '--backup') {
        result.backup = true;
      } else if (arg === '--target-dir' || arg === '-d') {
        result.targetDir = args[++i];
      } else if (arg === '--git-depth' || arg === '-g') {
        const depth = parseInt(args[++i], 10);
        if (isNaN(depth) || depth < 0) {
          console.error('❌ git-depth must be a non-negative number');
          process.exit(1);
        }
        result.gitDepth = depth;
      } else if (arg === '--include' || arg === '-i') {
        // Support comma-separated values or multiple --include flags
        const types = args[++i].split(',').map(t => t.trim());
        result.includeTypes.push(...types);
      } else if (arg === '--exclude' || arg === '-e') {
        // Support comma-separated values or multiple --exclude flags
        const types = args[++i].split(',').map(t => t.trim());
        result.excludeTypes.push(...types);
      } else if (!arg.startsWith('--') && !arg.startsWith('-') && !result.path) {
        result.path = arg;
      }
    }

    return result;
  }

  /**
   * Execute the command
   */
  public async run(args: string[]): Promise<void> {
    const parsed = this.parseArgs(args);
    const targetDir = parsed.targetDir || parsed.path || process.cwd();
    
    // Start timer
    const startTime = Date.now();
    
    // Display include types if specified
    if (parsed.includeTypes.length > 0) {
      console.log(`\n🎯 Including only: ${parsed.includeTypes.join(', ')}`);
    }
    
    // Display exclude types if specified
    if (parsed.excludeTypes.length > 0) {
      console.log(`\n🚫 Excluding: ${parsed.excludeTypes.join(', ')}`);
    }

    try {
      // If git-depth is specified, process only changed files
      if (parsed.gitDepth > 0) {
        const changedFiles = this.getChangedMetadataFiles(parsed.gitDepth, targetDir);
        
        if (changedFiles.length === 0) {
          console.log(`\n🔍 No *-meta.xml files found in last ${parsed.gitDepth} commits`);
          // Calculate and display elapsed time even for early return
          const endTime = Date.now();
          const elapsedSeconds = ((endTime - startTime) / 1000).toFixed(2);
          console.log(`\n⏱️  Completed in ${elapsedSeconds} seconds`);
          return;
        }

        const adjuster = new SfMetadataAdjuster(targetDir, parsed.includeTypes, parsed.excludeTypes);
        await adjuster.processSpecificFiles(changedFiles, parsed.backup);
      } else {
        // Process all files in directory
        const adjuster = new SfMetadataAdjuster(targetDir, parsed.includeTypes, parsed.excludeTypes);
        await adjuster.process(parsed.backup);
      }
      
      // Calculate and display elapsed time
      const endTime = Date.now();
      const elapsedSeconds = ((endTime - startTime) / 1000).toFixed(2);
      console.log(`\n⏱️  Completed in ${elapsedSeconds} seconds`);
    } catch (error) {
      console.error('❌ Error:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  }  /**
   * Display help information
   */
  public static showHelp(): void {
    console.log(`
${MetadataAdjustCommand.summary}

USAGE
  sf metadata adjust [PATH] [FLAGS]

DESCRIPTION
  ${MetadataAdjustCommand.description}

ARGUMENTS
  PATH  Path to the directory containing metadata files to process

FLAGS
  -d, --target-dir <dir>  Target directory to process (defaults to current directory)
  -g, --git-depth <num>   Process only files changed in last N commits (0 = all files)
  -i, --include <types>   Only process specific metadata types (comma-separated, e.g., permissionset,profile)
  -e, --exclude <types>   Exclude specific metadata types (comma-separated, defaults: reportType,flexipage,layout)
      --backup            Create backup before processing (backup disabled by default)

EXAMPLES
${MetadataAdjustCommand.examples.map(ex => `  ${ex}`).join('\n')}
`);
  }
}

// CLI entry point when run directly
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    MetadataAdjustCommand.showHelp();
    process.exit(0);
  }

  const command = new MetadataAdjustCommand();
  command.run(args).catch((error) => {
    console.error('❌ Command failed:', error);
    process.exit(1);
  });
}

export default MetadataAdjustCommand;