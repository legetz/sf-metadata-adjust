# Copilot Project Instructions

## General Coding Guidelines
- Use TypeScript with ES module syntax (`import`/`export`) and keep files ASCII-only unless existing code proves otherwise.
- Prefer concise helper utilities over large monolithic files. Reuse existing modules in `src/common/` when possible.
- Follow existing code style: 2-space indentation, single quotes for strings, semicolons at line ends.
- Log messages use emoji prefixes for readability (e.g., `✏️`, `⚠️`, `✅`). Maintain that style when adding new output.

## Metadata Adjuster Rules
- Respect the whitelist/exclusion model defined in `src/common/metadata/metadata-rules.ts`. Add new metadata types only after updating that module.
- Keep array ordering constraints defined in sorting rules. For example, `dispositions` inside `FileUploadAndDownloadSecurity.settings-meta.xml` must remain unsorted.
- Implement tests for any new metadata types or significant logic changes in `metadata-adjuster.test.ts`.

## GitHub Actions & Automation
- Workflow configuration lives under `.github/workflows/`. Any additions should document new environment variables in the README.
- The `ADJUST_DELTA_ONLY` flag toggles delta processing in PR automation; ensure related scripts keep PR comments and commit messages in sync with file counts.

## Documentation Expectations
- Update `README.md` and `CHANGELOG.md` alongside feature work. Follow the Keep a Changelog format for version entries and include release links.
- Provide examples or configuration snippets when introducing new CLI flags or workflow options.

Following these instructions keeps automated formatting, documentation, and CI behavior consistent across the project.
