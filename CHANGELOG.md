# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

- _No changes yet._

## [1.0.13] - 2025-11-13

### Added
- 🧭 **Metadata Integrity Command**: Added `sf swift metadata integrity` to flag lingering profile and permission set references to deleted Apex classes or custom fields.
- 🧩 **Metadata Integrity Helper**: Shared analyzer for detecting class and field permission issues with coverage tests.
- 🧮 **Integrity Ruleset**: Centralized metadata integrity rules covering Visualforce pages, flows, layouts, validation rules, field sets, record types, and compact layouts.
- 🧪 **Manual Integrity Simulation**: Added `--test-with-class` and `--test-with-field` flags to emulate deleted Apex classes or custom fields during integrity scans.
- 📘 **Metadata Integrity Guide**: Comprehensive documentation in `METADATA-INTEGRITY.md`, linked from the README.

### Changed
- 🔍 **Integrity Coverage**: The metadata integrity scan now inspects Apex source, Visualforce pages, LWC/Aura components, Flow definitions, formula fields, layouts, validation rules, field sets, record types, and compact layouts for lingering references to deleted Apex classes, Visualforce pages, and custom fields.
- ♻️ **Flexipage Scanning**: Removed Flexipage coverage from metadata integrity checks because Lightning pages do not expose a reliable object context.
- 🎯 **Integrity Precision**: Object-aware scanning now reduces false positives across flows, layouts, field sets, record types, compact layouts, and validation rules by matching references to their owning objects.
- 🕵️ **PR Integrity Checks**: CI now runs `sf swift metadata integrity` during pull requests and blocks automated formatting when issues are detected.

### Fixed
- 🧷 **Case-Insensitive Flow Detection**: Flow audits now match field references regardless of casing, catching `account.externalid__c` alongside canonical `Account.ExternalId__c` values.

## [1.0.12] - 2025-11-11

### Changed
- 🚀 **GitHub Actions**: Bumped workflow runtime to Node.js 24 for metadata adjustment and conflict detection jobs.
- 📦 **Workflow Polish**: Tightened `.github/workflows/pr-detect-issues.yml` so comments only post when conflicts exist and improved the Markdown summary.
- 📚 **Documentation**: Streamlined README introduction to highlight both `metadata adjust` and `detect git conflicts` commands.

## [1.0.11] - 2025-11-11

### Added
- 🤖 **GitHub Workflow**: `.github/workflows/pr-detect-issues.yml` - Automatically detects git conflict files in pull requests
- 📋 **JSON Output**: `--json` flag support for `sf swift detect git conflicts` command
- 💬 **PR Comments**: Workflow comments on PRs with list of detected `.rej` files when conflicts are found

## [1.0.10] - 2025-11-10

### Added
- 📚 **Documentation**: Documented usage, flags, and behavior for the `sf swift detect git conflicts` command in the README.

### Fixed
- 🧮 **Git Conflict Detection**: Correctly reports the number of `.rej` files discovered during scans.

## [1.0.5] - 2025-11-04

### Features
- **Workflow**: `.github/workflows/pr-metadata-adjust.yml` - Automatic PR formatting
- **Delta Mode**: Process only files changed in PR when `ADJUST_DELTA_ONLY: 'true'`
- **Full Mode**: Process all metadata files when `ADJUST_DELTA_ONLY: 'false'`
- **Auto-Commit**: Automatically commits formatting changes back to PR branch
- **PR Notifications**: Comments on PR with processing results and file counts

## [1.0.4] - 2025-11-02

### Added
- 🛡️ **Safety Whitelist System** - Only processes safe metadata types by default (profiles, permissionsets, etc.)
- 🌐 **--all Flag** - Bypass whitelist to process any metadata type (use with caution)
- ✅ **Whitelist Validation** - Prevents processing non-whitelisted types unless --all is specified
- 🔍 **Git Conflict Detection** - New `sf swift detect git conflicts` command to find .rej files
- 📊 **Enhanced Logging** - Improved console output with emojis for better readability
- 🚫 **Always-Excluded Types** - Flow files permanently excluded due to special handling requirements
- 🔐 **XML Entity Preservation** - Maintains XML entities like &apos; during processing
- 🎯 **Automatic Root Element Detection** - Extracts root element from XML without hardcoded mappings
- ⚡ **Performance Improvements** - Skips node_modules and .git directories during scanning

### Changed
- 📝 **Improved Error Messages** - Clearer validation errors with helpful suggestions
- 🔧 **Parser Configuration** - Enhanced XML parsing settings for better entity handling
- 📋 **Updated Documentation** - Comprehensive README updates for whitelist feature

### Fixed
- 🐛 **XML Entity Encoding** - Fixed issue where &apos; was converted to literal apostrophe
- 🔑 **Root Element Extraction** - Resolved issue with $ key appearing instead of actual root element name
- 📦 **Type Normalization** - Improved handling of -meta.xml suffix in include/exclude flags

### Security
- 🛡️ **Safe-by-Default** - Whitelist prevents accidental processing of complex metadata types

## [1.0.0] - 2025-10-28

### Added
- 🎯 **Smart Salesforce Metadata Sorting** - Understands PermissionSet, Profile, and other metadata structures
- 💾 **Automatic Backups** - Creates timestamped backups before processing (opt-in with `--backup` flag)
- 📊 **Detailed Reporting** - Shows which files were modified vs already properly formatted
- 🔄 **Recursive Processing** - Handles nested directory structures automatically
- 🔍 **Git Integration** - Process only files changed in recent commits with `--git-depth` flag
- ⏭️ **Exclude Filter** - Skip specific metadata types (defaults: reportType, flexipage, layout)
- 🎯 **Include Filter** - Target only specific metadata types with `--include` flag
- ✅ **Error Handling** - Continues processing even if individual files fail
- 🧹 **Clean Formatting** - Consistent indentation and XML formatting
- ⚡ **Performance Optimization** - Skips files that are already properly sorted
- ⏱️ **Execution Timer** - Shows how long processing took overall
- 📦 **Salesforce CLI Plugin** - Install as `sf` CLI plugin for seamless integration
- 🚀 **GitHub Actions** - Automated publishing to npm on version tag push

### Features
- **Command**: `sf swift metadata adjust` - Main command for sorting metadata files

[Unreleased]: https://github.com/legetz/sf-swift/compare/v1.0.13...HEAD
[1.0.13]: https://github.com/legetz/sf-swift/releases/tag/v1.0.13
[1.0.12]: https://github.com/legetz/sf-swift/releases/tag/v1.0.12
[1.0.11]: https://github.com/legetz/sf-swift/releases/tag/v1.0.11
[1.0.10]: https://github.com/legetz/sf-swift/releases/tag/v1.0.10
[1.0.5]: https://github.com/legetz/sf-swift/releases/tag/v1.0.5
[1.0.4]: https://github.com/legetz/sf-swift/releases/tag/v1.0.4
[1.0.0]: https://github.com/legetz/sf-swift/releases/tag/v1.0.0
