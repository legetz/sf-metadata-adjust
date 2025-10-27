# Salesforce Metadata Adjust

A Salesforce CLI plugin that formats XML files and sorts their elements alphabetically (a-z)

- 🎯 **Smart Salesforce Metadata Sorting** - Understands PermissionSet, Profile, and other metadata structures
- 💾 **Automatic Backups** - Creates timestamped backups before processing (opt-in)
- 📊 **Detailed Reporting** - Shows which files were modified vs already okay
- 🔄 **Recursive Processing** - Handles nested directory structures
- 🔍 **Git Integration** - Process only files changed in recent commits
- ⏭️ **Exclude Filter** - Skip specific metadata types (e.g., `--exclude field,object`) (defaults: reportType, flexipage, layout)
- 🎯 **Include Filter** - Target only specific metadata types (e.g., `--include permissionset,profile`)
- ✅ **Error Handling** - Continues processing even if individual files fail
- 🧹 **Clean Formatting** - Consistent indentation and XML formatting
- ⚡ **Performance Optimization** - Skips files that are already properly sorted
- ⏱️ **Execution Timer** - Shows how long processing took overall

## Installation

### As a Salesforce CLI Plugin

```bash
# Install from npm
sf plugins install sf-metadata-adjust

# Install from local directory (for development)
sf plugins install .

# Or link for development
sf plugins link .
```

### As a Standalone Tool

```bash
# Clone and install
git clone git@github.com:legetz/sf-metadata-adjust.git
cd sf-metadata-adjust
npm install
npm run build
```

## Usage

```bash
# Process current directory
sf metadata adjust

# Process specific directory  
sf metadata adjust ./force-app/main/default

# Process with backup (disabled by default)
sf metadata adjust --backup

# Process only files changed in last 3 commits
sf metadata adjust --git-depth 3

# Process only files changed in last 5 commits with backup
sf metadata adjust --git-depth 5 --backup

# Process only PermissionSet files
sf metadata adjust --include permissionset

# Process only PermissionSet and Profile files
sf metadata adjust --include permissionset,profile

# Combine with git-depth to process only specific types from recent commits
sf metadata adjust --git-depth 3 --include permissionset

# Exclude specific types (overrides defaults)
sf metadata adjust --exclude profile,permissionset

# Include with custom exclusions
sf metadata adjust --include permissionset,field --exclude profile

# Get help
sf metadata adjust --help
```

### Arguments
- `PATH` - Path to the SF project directory containing metadata files to process

### Flags

| Flag | Short | Description | Default |
|------|-------|-------------|---------|
| `--target-dir` | `-d` | Target directory to process | `.` (current) |
| `--git-depth` | `-g` | Process only N commits | `0` (all files) |
| `--include` | `-i` | Only process specific types | All types |
| `--exclude` | `-e` | Exclude specific types | `reportType,flexipage,layout` |
| `--backup` | - | Create backup before processing | Disabled |
| `--help` | `-h` | Show help information | - |

### Sample Output
```
🎯 Including only: permissionset, profile, translation
🔍 Found 371 changed *-meta.xml files in last 100 commits
📋 Processing 25 specific metadata files
🔤 Processing specified metadata files...

✅  Already good: permissionsets/Marketing.permissionset-meta.xml
✏️  Modified: permissionsets/Admin.permissionset-meta.xml
✏️  Modified: profiles/Admin.profile-meta.xml
✅  Already good: profiles/Standard.profile-meta.xml
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
# Process all *-meta.xml files in a folder (with backup)
npm run sf-adjust ./force-app/main/default

# Process without creating backup
npm run sf-adjust ./src/main/default -- --no-backup

# Using compiled version
npm run build
npm run sf-adjust:prod ./force-app
```

## Exclude Filter

By default, the tool excludes certain Salesforce metadata file types that should not be sorted:

- `reportType-meta.xml` - Report Type metadata files
- `flexipage-meta.xml` - Lightning Page (FlexiPage) metadata files
- `layout-meta.xml` - Page Layout metadata files

You can override these defaults with the `--exclude` flag:

```bash
# Only exclude profiles (process everything else including layouts, flexipages, etc.)
sf metadata adjust --exclude profile

# Exclude nothing (process all files)
sf metadata adjust --exclude ""

# Custom exclusions
sf metadata adjust --exclude reportType,customObject
```

These files are counted in the summary statistics but never modified.

## Performance Tips

1. **Use git-depth for large repos**: Only process changed files
2. **Backup disabled by default**: Already optimized for CI/CD
3. **Run before commit**: Catch issues early with git-depth 1
4. **Ignore backup folders**: Add `.backup-*` to `.gitignore` (when using --backup)

## Integration Examples

### Pre-commit Hook
```bash
#!/bin/bash
sf metadata adjust --git-depth 1
if [ $? -ne 0 ]; then
    echo "Metadata formatting failed!"
    exit 1
fi
```

### GitHub Actions
```yaml
- name: Format Metadata
  run: sf metadata adjust --git-depth 10
```

## Troubleshooting

### "No metadata files found"
- Check you're in the right directory
- Verify files end with `-meta.xml`

### "Git operation failed"
- Ensure you're in a Git repository
- Check git-depth doesn't exceed commit count

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

❌ **DON'T**:
- Process backup folders (add to gitignore)
- Ignore errors in CI/CD
- Forget to commit adjusted files

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable  
5. Submit a pull request

## License

This project is licensed under the ISC License.