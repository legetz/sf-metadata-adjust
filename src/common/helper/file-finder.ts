/**
 * Recursive file finder utilities for metadata helpers
 */

import * as fs from "fs";
import * as path from "path";

const DEFAULT_SKIP_DIRECTORIES = [".git", "node_modules"];

type ErrorWithCode = NodeJS.ErrnoException & { code?: string };

export interface FindFilesOptions {
  /** Additional directory names to skip during traversal */
  skipDirectories?: string[];
}

/**
 * Find files recursively whose names end with the provided suffix.
 * @param dir - Directory to start scanning from.
 * @param suffix - File name suffix (with or without leading dot).
 * @param options - Optional configuration for skipped directories.
 */
export function findFilesBySuffix(dir: string, suffix: string, options: FindFilesOptions = {}): string[] {
  const normalizedSuffix = suffix.startsWith(".") ? suffix : `.${suffix}`;
  const skipped = new Set([...DEFAULT_SKIP_DIRECTORIES, ...(options.skipDirectories ?? [])]);

  const visit = (currentDir: string): string[] => {
    const matches: string[] = [];

    try {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);

        if (entry.isDirectory()) {
          if (skipped.has(entry.name)) {
            continue;
          }
          matches.push(...visit(fullPath));
        } else if (entry.isFile() && entry.name.endsWith(normalizedSuffix)) {
          matches.push(fullPath);
        }
      }
    } catch (error) {
      const err = error as ErrorWithCode;
      if (err.code !== "EACCES" && err.code !== "EPERM") {
        throw error;
      }
    }

    return matches;
  };

  return visit(dir);
}
