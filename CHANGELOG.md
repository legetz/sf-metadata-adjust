# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[1.0.0]: https://github.com/legetz/sf-swift/releases/tag/v1.0.0
