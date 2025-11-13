import { expect } from "chai";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { SfMetadataAdjuster } from "../../../src/sf-metadata-adjuster.js";

function copyDirectory(source: string, destination: string): void {
  fs.mkdirSync(destination, { recursive: true });
  const entries = fs.readdirSync(source, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = path.join(source, entry.name);
    const destinationPath = path.join(destination, entry.name);

    if (entry.isDirectory()) {
      copyDirectory(sourcePath, destinationPath);
      continue;
    }

    fs.copyFileSync(sourcePath, destinationPath);
  }
}

function collectMetadataFiles(root: string): string[] {
  const files: string[] = [];
  const entries = fs.readdirSync(root, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(root, entry.name);

    if (entry.isDirectory()) {
      files.push(...collectMetadataFiles(fullPath));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith("-meta.xml")) {
      files.push(fullPath);
    }
  }

  return files;
}

describe("metadata-adjust", () => {
  const fixturesRoot = path.resolve("test-files");
  const originalRoot = path.join(fixturesRoot, "original");
  const expectedRoot = path.join(fixturesRoot, "adjusted-meta");
  let tempRoot = "";

  afterEach(() => {
    if (tempRoot && fs.existsSync(tempRoot)) {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
    tempRoot = "";
  });

  it("adjusts metadata files to the expected snapshot", async () => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "metadata-adjust-"));
    copyDirectory(originalRoot, tempRoot);

    const adjuster = new SfMetadataAdjuster(tempRoot, [], [], false, { silent: true });
    await adjuster.process(false);

    const expectedFiles = collectMetadataFiles(expectedRoot)
      .map((filePath) => path.relative(expectedRoot, filePath))
      .sort();
    const actualFiles = collectMetadataFiles(tempRoot)
      .map((filePath) => path.relative(tempRoot, filePath))
      .sort();

    expect(actualFiles).to.deep.equal(expectedFiles);

    for (const relativePath of expectedFiles) {
      const expectedFile = path.join(expectedRoot, relativePath);
      const actualFile = path.join(tempRoot, relativePath);
      const expectedContents = fs.readFileSync(expectedFile, "utf8");
      const actualContents = fs.readFileSync(actualFile, "utf8");

      expect(actualContents, `Mismatch detected in ${relativePath}`).to.equal(expectedContents);
    }
  });
});
