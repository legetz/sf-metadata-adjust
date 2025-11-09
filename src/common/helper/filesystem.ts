/**
 * File system utility helpers shared across commands.
 */

import * as fs from "fs";

export type ErrorHandler = (message: string, options?: { exit?: number }) => never;

/**
 * Ensure that the provided path exists and is a directory.
 * When an error handler is supplied (e.g., SfCommand#error), it will be invoked
 * with the appropriate message. Otherwise, this function throws an Error.
 */
export function ensureDirectory(targetDir: string, onError?: ErrorHandler): void {
  if (!fs.existsSync(targetDir)) {
    const message = `❌ Target directory does not exist: ${targetDir}`;
    if (onError) {
      onError(message, { exit: 1 });
    }
    throw new Error(message);
  }

  const stats = fs.statSync(targetDir);
  if (!stats.isDirectory()) {
    const message = `❌ Target path is not a directory: ${targetDir}`;
    if (onError) {
      onError(message, { exit: 1 });
    }
    throw new Error(message);
  }
}
