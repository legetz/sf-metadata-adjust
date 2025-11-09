import { expect } from "chai";
import * as fs from "fs";
import * as path from "path";
import { createFileBackup } from "../../../src/common/helper/backup.js";

describe("common/helper/backup", () => {
  const testDir = path.join(process.cwd(), "test-temp-backup");
  const testFile1 = path.join(testDir, "test1.txt");
  const testFile2 = path.join(testDir, "subdir", "test2.txt");

  beforeEach(() => {
    // Create test directory and files
    fs.mkdirSync(path.dirname(testFile2), { recursive: true });
    fs.writeFileSync(testFile1, "test content 1");
    fs.writeFileSync(testFile2, "test content 2");
  });

  afterEach(() => {
    // Clean up test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe("createFileBackup", () => {
    it("should create a backup directory with timestamp", () => {
      const files = [testFile1, testFile2];
      const backupDir = createFileBackup(files, testDir);

      expect(fs.existsSync(backupDir)).to.be.true;
      expect(path.basename(backupDir)).to.match(/^\.backup-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}/);
    });

    it("should backup all specified files", () => {
      const files = [testFile1, testFile2];
      const backupDir = createFileBackup(files, testDir);

      const backedUpFile1 = path.join(backupDir, "test1.txt");
      const backedUpFile2 = path.join(backupDir, "subdir", "test2.txt");

      expect(fs.existsSync(backedUpFile1)).to.be.true;
      expect(fs.existsSync(backedUpFile2)).to.be.true;
    });

    it("should preserve file contents in backup", () => {
      const files = [testFile1, testFile2];
      const backupDir = createFileBackup(files, testDir);

      const backedUpFile1 = path.join(backupDir, "test1.txt");
      const backedUpFile2 = path.join(backupDir, "subdir", "test2.txt");

      const content1 = fs.readFileSync(backedUpFile1, "utf8");
      const content2 = fs.readFileSync(backedUpFile2, "utf8");

      expect(content1).to.equal("test content 1");
      expect(content2).to.equal("test content 2");
    });

    it("should preserve directory structure in backup", () => {
      const files = [testFile1, testFile2];
      const backupDir = createFileBackup(files, testDir);

      const backedUpSubdir = path.join(backupDir, "subdir");
      expect(fs.existsSync(backedUpSubdir)).to.be.true;
      expect(fs.statSync(backedUpSubdir).isDirectory()).to.be.true;
    });

    it("should handle empty file list", () => {
      const files: string[] = [];
      const backupDir = createFileBackup(files, testDir);

      expect(fs.existsSync(backupDir)).to.be.true;
      expect(fs.readdirSync(backupDir).length).to.equal(0);
    });

    it("should return the backup directory path", () => {
      const files = [testFile1];
      const backupDir = createFileBackup(files, testDir);

      expect(backupDir).to.be.a("string");
      expect(backupDir).to.include(".backup-");
      expect(path.isAbsolute(backupDir)).to.be.true;
    });

    it("should create nested directories as needed", () => {
      const nestedFile = path.join(testDir, "level1", "level2", "level3", "test.txt");
      fs.mkdirSync(path.dirname(nestedFile), { recursive: true });
      fs.writeFileSync(nestedFile, "nested content");

      const files = [nestedFile];
      const backupDir = createFileBackup(files, testDir);

      const backedUpNested = path.join(backupDir, "level1", "level2", "level3", "test.txt");
      expect(fs.existsSync(backedUpNested)).to.be.true;
      expect(fs.readFileSync(backedUpNested, "utf8")).to.equal("nested content");
    });

    it("should handle multiple files in same directory", () => {
      const testFile3 = path.join(testDir, "test3.txt");
      fs.writeFileSync(testFile3, "test content 3");

      const files = [testFile1, testFile3];
      const backupDir = createFileBackup(files, testDir);

      const backedUpFile1 = path.join(backupDir, "test1.txt");
      const backedUpFile3 = path.join(backupDir, "test3.txt");

      expect(fs.existsSync(backedUpFile1)).to.be.true;
      expect(fs.existsSync(backedUpFile3)).to.be.true;
    });

    it("should throw error if file does not exist", () => {
      const nonExistentFile = path.join(testDir, "nonexistent.txt");
      const files = [nonExistentFile];

      expect(() => createFileBackup(files, testDir)).to.throw();
    });

    it("should create unique backup directories for consecutive calls", (done) => {
      const files = [testFile1];
      const backupDir1 = createFileBackup(files, testDir);

      // Wait a moment to ensure different timestamp
      setTimeout(() => {
        const backupDir2 = createFileBackup(files, testDir);

        expect(backupDir1).to.not.equal(backupDir2);
        expect(fs.existsSync(backupDir1)).to.be.true;
        expect(fs.existsSync(backupDir2)).to.be.true;

        done();
      }, 1500);
    });
  });
});
