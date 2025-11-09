import { expect } from 'chai';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { findFilesBySuffix } from '../../../src/common/helper/file-finder.js';

describe('common/helper/file-finder', () => {
  const tempDirs: string[] = [];

  const createTempDir = (): string => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'file-finder-test-'));
    tempDirs.push(dir);
    return dir;
  };

  afterEach(() => {
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop();
      if (dir && fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  it('should find files with the given suffix recursively', () => {
    const root = createTempDir();
    const subDir = path.join(root, 'sub');
    fs.mkdirSync(subDir);

    const files = [
      path.join(root, 'one.rej'),
      path.join(subDir, 'two.rej'),
      path.join(subDir, 'three.txt')
    ];

    fs.writeFileSync(files[0], 'a');
    fs.writeFileSync(files[1], 'b');
    fs.writeFileSync(files[2], 'c');

    const result = findFilesBySuffix(root, '.rej');

    expect(result).to.have.lengthOf(2);
    expect(result).to.deep.include.members([files[0], files[1]]);
    expect(result).to.not.include(files[2]);
  });

  it('should treat suffix without dot as valid input', () => {
    const root = createTempDir();
    const filePath = path.join(root, 'example.rej');
    fs.writeFileSync(filePath, 'content');

    const result = findFilesBySuffix(root, 'rej');

    expect(result).to.have.lengthOf(1);
    expect(result[0]).to.equal(filePath);
  });

  it('should skip node_modules and .git directories by default', () => {
    const root = createTempDir();
    const nodeModules = path.join(root, 'node_modules');
    const gitDir = path.join(root, '.git');
    fs.mkdirSync(nodeModules);
    fs.mkdirSync(gitDir);

    const forbiddenFile = path.join(nodeModules, 'ignored.rej');
    const ignoredGitFile = path.join(gitDir, 'ignored.rej');
    const allowedFile = path.join(root, 'allowed.rej');

    fs.writeFileSync(forbiddenFile, 'node');
    fs.writeFileSync(ignoredGitFile, 'git');
    fs.writeFileSync(allowedFile, 'root');

    const result = findFilesBySuffix(root, '.rej');

    expect(result).to.deep.equal([allowedFile]);
  });

  it('should allow custom directories to skip', () => {
    const root = createTempDir();
    const skipDir = path.join(root, 'skip-me');
    fs.mkdirSync(skipDir);

    const skippedFile = path.join(skipDir, 'skip.rej');
    const processedFile = path.join(root, 'process.rej');

    fs.writeFileSync(skippedFile, 'skip');
    fs.writeFileSync(processedFile, 'process');

    const result = findFilesBySuffix(root, '.rej', { skipDirectories: ['skip-me'] });

    expect(result).to.deep.equal([processedFile]);
  });
});
