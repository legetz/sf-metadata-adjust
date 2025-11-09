import { expect } from "chai";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { ensureDirectory } from "../../../src/common/helper/filesystem.js";

describe("common/helper/filesystem", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fs-helper-test-"));
  });

  afterEach(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("should do nothing when directory exists", () => {
    expect(() => ensureDirectory(tempDir)).to.not.throw();
  });

  it("should throw when directory does not exist", () => {
    const nonExistent = path.join(tempDir, "missing");
    expect(() => ensureDirectory(nonExistent)).to.throw(/does not exist/);
  });

  it("should throw when path is a file", () => {
    const filePath = path.join(tempDir, "file.txt");
    fs.writeFileSync(filePath, "content");
    expect(() => ensureDirectory(filePath)).to.throw(/not a directory/);
  });

  it("should delegate to provided error handler", () => {
    const nonExistent = path.join(tempDir, "missing");
    let captured: string | null = null;

    try {
      ensureDirectory(nonExistent, (message: string) => {
        captured = message;
        throw new Error("handler");
      });
    } catch (error) {
      expect((error as Error).message).to.equal("handler");
      expect(captured).to.include("does not exist");
    }
  });
});
