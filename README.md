# SF Swift ⚡

A fast and powerful Salesforce CLI plugin with utilities for metadata formatting, sorting, and more

- 🎯 **Smart Salesforce Metadata Sorting** - Understands PermissionSet, Profile, and other metadata structures
- 💾 **Automatic Backups** - Creates timestamped backups before processing (opt-in)
- 📊 **Detailed Reporting** - Shows which files were modified vs already okay
- 🔄 **Recursive Processing** - Handles nested directory structures
- 🔍 **Git Integration** - Process only files changed in recent commits
- 🛡️ **Safety Whitelist** - Only processes safe metadata types by default (can be bypassed with `--all`)
- ⏭️ **Exclude Filter** - Skip specific metadata types (e.g., `--exclude field,object`) (defaults: reportType, flexipage, layout)
- 🎯 **Include Filter** - Target only specific metadata types (e.g., `--include permissionset,profile`)
- ✅ **Error Handling** - Continues processing even if individual files fail
- 🧹 **Clean Formatting** - Consistent indentation and XML formatting
- ⚡ **Performance Optimization** - Skips files that are already properly sorted
- ⏱️ **Execution Timer** - Shows how long processing took overall

## Installation

### Salesforce CLI Plugin

```bash
# Install from npm
sf plugins install sf-swift
```

### Standalone Tool

```bash
# Clone and install
git clone git@github.com:legetz/sf-swift.git
cd sf-swift
npm install
npm run build
```

Optionally connect to SF CLI:
```bash
# Install from local directory (for development)
sf plugins install .

# Or link for development
sf plugins link .
```

## Usage

```bash
# Process current directory
sf swift metadata adjust

# Process specific directory  
sf swift metadata adjust ./force-app/main/default

# Process with backup (disabled by default)
sf swift metadata adjust --backup

# Process only files changed in last 3 commits
sf swift metadata adjust --git-depth 3

# Process only files changed in last 5 commits with backup
sf swift metadata adjust --git-depth 5 --backup

# Process only PermissionSet files
sf swift metadata adjust --include permissionset

# Process only PermissionSet and Profile files
sf swift metadata adjust --include permissionset,profile

# Combine with git-depth to process only specific types from recent commits
sf swift metadata adjust --git-depth 3 --include permissionset

# Exclude specific types (overrides defaults)
sf swift metadata adjust --exclude profile,permissionset

# Include with custom exclusions
sf swift metadata adjust --include permissionset,field --exclude profile

# Process ALL metadata types (bypass safety whitelist)
sf swift metadata adjust --all

# Process ALL types with backup
sf swift metadata adjust --all --backup

# Process ALL types changed in last 5 commits
sf swift metadata adjust --all --git-depth 5

# Get help
sf swift metadata adjust --help
```

### Arguments
- `PATH` - Path to the SF project directory containing metadata files to process

### Flags

| Flag | Short | Description | Default |
|------|-------|-------------|---------|
| `--target-dir` | `-d` | Target directory to process | `.` (current) |
| `--git-depth` | `-g` | Process only N commits | `0` (all files) |
| `--include` | `-i` | Only process specific types | All whitelisted types |
| `--exclude` | `-e` | Exclude specific types | `reportType,flexipage,layout` |
| `--all` | `-a` | Process ALL types (bypass whitelist) | Disabled |
| `--backup` | - | Create backup before processing | Disabled |
| `--help` | `-h` | Show help information | - |

### Sample Output
```
🎯 Including only: permissionset, profile, translation
🔍 Found 371 changed *-meta.xml files in last 100 commits
📋 Processing 25 specific metadata files
🔤 Processing specified metadata files...

✏️  Modified: permissionsets/Admin.permissionset-meta.xml
✏️  Modified: profiles/Admin.profile-meta.xml
...

============================================================
📊 ADJUSTMENT SUMMARY
============================================================
📁 Total files checked: 25 files
✏️ Modified: 23 files
✅ Already good: 2 files
⏭️ Skipped: 346 files
⚠️ Errors encountered: 0 files

🎉 Successfully adjusted 23 metadata files!

⏱️  Completed in 3.10 seconds
```

### Direct Usage

```bash
# Process all *-meta.xml files in a folder
npm run sf-adjust ./force-app/main/default

# Process only permissionset
npm run sf-adjust ./src/main/default -- --include permissionset

# Using compiled version
npm run build
npm run sf-adjust:prod ./force-app

# Direct usage example
npx ts-node src/commands/metadata/adjust.ts ./src/main/default -- --include profile,permissionset --git-depth 10
```

## Exclude Filter

By default, the tool excludes certain Salesforce metadata file types that should not be sorted:

- `reportType-meta.xml` - Report Type metadata files
- `flexipage-meta.xml` - Lightning Page (FlexiPage) metadata files
- `layout-meta.xml` - Page Layout metadata files

You can override these defaults with the `--exclude` flag:

```bash
# Only exclude profiles (process everything else including layouts, flexipages, etc.)
sf swift metadata adjust --exclude profile

# Exclude nothing (process all files)
sf swift metadata adjust --exclude ""

# Custom exclusions
sf swift metadata adjust --exclude reportType,customObject
```

These files are counted in the summary statistics but never modified.

## Safety Whitelist

By default, the tool uses a **safety whitelist** to only process metadata types that are known to be safe for XML sorting. This prevents potential issues with complex metadata types that may have specific ordering requirements.

### Whitelisted Types (Safe by Default)

The following metadata types are whitelisted and will be processed by default:

- `cls-meta.xml` - Apex classes
- `customObject-meta.xml` -  Custom Objects
- `field-meta.xml` - Fields
- `labels-meta.xml` - Labels
- `object-meta.xml` - Standard Objects
- `permissionset-meta.xml` - Permission Sets
- `profile-meta.xml` - User Profiles
- `settings-meta.xml` - Org Settings (various types)
- `trigger-meta.xml` - Triggers
- `validationRule-meta.xml` - Validation Rules

### Always Excluded Types

Some types are **always excluded** due to special handling requirements:

- `flow-meta.xml` - Flows (require special key ordering logic)

### Using the Whitelist

```bash
# Default: Only process whitelisted types
sf swift metadata adjust

# Specific whitelisted types only
sf swift metadata adjust --include permissionset,profile

# Error: reportType is not whitelisted
sf swift metadata adjust --include reportType
# ❌ Invalid configuration: The following types are not in the allowed whitelist: reportType-meta.xml
# Use --all flag to process all metadata types without whitelist restrictions.
```

### Bypassing the Whitelist

Use the `--all` flag to process any metadata type, bypassing whitelist restrictions:

```bash
# Process ALL metadata types (use with caution)
sf swift metadata adjust --all

# Process specific non-whitelisted types
sf swift metadata adjust --all --include reportType,customField

# Process ALL types from recent commits
sf swift metadata adjust --all --git-depth 10

# Process ALL with backup (recommended when experimenting)
sf swift metadata adjust --all --backup
```

⚠️ **Important**: When using `--all`, be aware that some complex metadata types may have specific ordering requirements that standard alphabetical sorting doesn't preserve. Always:
- Test in a non-production environment first
- Use `--backup` flag for safety
- Review changes carefully before committing
- Check that metadata still deploys correctly

## Performance Tips

1. **Use git-depth for large repos**: Only process changed files
2. **Backup disabled by default**: Already optimized for CI/CD
3. **Run before commit**: Catch issues early with git-depth 1
4. **Ignore backup folders**: Add `.backup-*` to `.gitignore` (when using --backup)

## Integration Examples

### Pre-commit Hook
```bash
#!/bin/bash
sf swift metadata adjust --git-depth 1
if [ $? -ne 0 ]; then
    echo "Metadata formatting failed!"
    exit 1
fi
```

### GitHub Actions - Automatic Adjustment in PR

This plugin includes a ready-to-use GHA workflow that automatically adjusts metadata files on pull requests and commits the changes back to the PR branch.

#### Setup

1. The workflow file is already included: `.github/workflows/pr-metadata-adjust.yml`
2. Configure which metadata types to process by editing the `INCLUDED_TYPES` environment variable:

```yaml
env:
  # Process all whitelisted types
  INCLUDED_TYPES: ''

  # Process only defined types
  INCLUDED_TYPES: 'profile,permissionset'
  
  # Only process files changed in PR (recommended)
  ADJUST_DELTA_ONLY: 'true'
  
  # Or process all files in directory
  ADJUST_DELTA_ONLY: 'false'
```

#### Features

- ✅ **Automatic Triggering** - Runs when metadata files change in PRs
- 🤖 **Auto-Commit** - Commits formatting changes back to PR branch
- 💬 **PR Comments** - Notifies about formatting status
- 🎯 **Configurable** - Choose which metadata types to process
- ⚡ **Delta Mode** - Optionally process only files changed in the PR

#### Workflow Behavior

1. **Triggered** when a PR is opened, synchronized, or reopened with metadata file changes
2. **Delta Mode** (when `ADJUST_DELTA_ONLY: 'true'`):
   - Automatically calculates the number of commits in the PR
   - Uses `--git-depth <commit_count>` to process only files changed in the PR
   - PR comment indicates: "Changed files only (X commits)"
3. **Full Mode** (when `ADJUST_DELTA_ONLY: 'false'` or unset):
   - Processes all metadata files in the configured directory
   - PR comment indicates: "All files in directory"
4. **Formats** metadata files based on `INCLUDED_TYPES` configuration
5. **Commits** changes automatically if any files were modified
6. **Comments** on the PR with the formatting status and scope


#### Customization

Edit `.github/workflows/pr-metadata-adjust.yml` to:
- Change `INCLUDED_TYPES` to process different metadata types
- Set `ADJUST_DELTA_ONLY: 'true'` for PR-only processing (recommended)
- Set `ADJUST_DELTA_ONLY: 'false'` to process all files in directory
- Adjust commit message format
- Adjust PR comment templates
- Change trigger conditions

## Troubleshooting

### "No metadata files found"
- Check you're in the right directory
- Verify files end with `-meta.xml`

### "Git operation failed"
- Ensure you're in a Git repository
- Check git-depth doesn't exceed commit count

### "Not in the allowed whitelist"
- You're trying to include a non-whitelisted metadata type
- Use `--all` flag to bypass whitelist restrictions
- Review the whitelisted types in the error message
- Example: `sf swift metadata adjust --all --include reportType`

### "Permission denied"
- Check file permissions
- Use `--backup` to preserve originals if needed

### Too many backup folders
- Only created when using `--backup` flag
- Add `.backup-*` to `.gitignore`
- Clean old backups: `rm -rf .backup-*`

## Best Practices

✅ **DO**:
- Run before committing code
- Use git-depth for incremental checks
- Review modified files in summary
- Add to pre-commit hooks
- Use `--backup` when testing major changes
- Stick to whitelisted metadata types for safety
- Test with `--all` flag in non-production first
- Use `--all --backup` when processing new metadata types

❌ **DON'T**:
- Process backup folders (add to gitignore)
- Ignore errors in CI/CD
- Forget to commit adjusted files
- Use `--all` flag in production without thorough testing
- Process complex metadata types without understanding their structure

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable  
5. Submit a pull request

## License

This project is licensed under the ISC License.