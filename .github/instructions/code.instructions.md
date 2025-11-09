---
applyTo: "src/**/*.ts,test/**/*.ts"
---

## General Coding Guidelines
- Use TypeScript with ES module syntax (`import`/`export`) and keep files ASCII-only unless existing code proves otherwise.
- Prefer concise helper utilities over large monolithic files. Reuse existing modules in `src/common/` when possible.
- Use Prettier for code formatting. Ensure new code adheres to the established style. Use double quotes for strings and semicolons at line ends. Indentation should be 4 spaces.
- Run `npm run prettier` to format code before agent work is complete.

## Metadata Adjuster Rules
- Respect the whitelist/exclusion model defined in `src/common/metadata/metadata-rules.ts`. Add new metadata types only after updating that module.
- Keep array ordering constraints defined in sorting rules. For example, `dispositions` inside `FileUploadAndDownloadSecurity.settings-meta.xml` must remain unsorted.
- Implement tests for any new metadata types or significant logic changes in `metadata-adjuster.test.ts`.

## Documentation Expectations
- Update `README.md` and `CHANGELOG.md` alongside feature work. Follow the Keep a Changelog format for version entries and include release links.
- Provide examples or configuration snippets when introducing new CLI flags or workflow options.