import * as fs from 'fs';
import * as path from 'path';

/**
 * Create backup of files before processing
 * @param files - Array of file paths to backup
 * @param basePath - Base path for calculating relative paths
 * @returns The backup directory path
 */
export function createFileBackup(files: string[], basePath: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(basePath, `.backup-${timestamp}`);
    
    try {
        fs.mkdirSync(backupDir, { recursive: true });
        
        for (const file of files) {
            const relativePath = path.relative(basePath, file);
            const backupFile = path.join(backupDir, relativePath);
            const backupFileDir = path.dirname(backupFile);
            
            // Ensure backup directory exists
            fs.mkdirSync(backupFileDir, { recursive: true });
            
            // Copy file to backup
            fs.copyFileSync(file, backupFile);
        }
        
        console.log(`📁 Backup created: ${path.relative(basePath, backupDir)}`);
        return backupDir;
    } catch (error) {
        throw new Error(`Failed to create backup: ${error}`);
    }
}
