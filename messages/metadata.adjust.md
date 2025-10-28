# description
Recursively processes all *-meta.xml files in the specified directory, sorting XML elements alphabetically with special handling for Salesforce metadata structures like PermissionSets, Profiles, and other metadata types. 

Can optionally process only files changed in recent Git commits. 

Backups are disabled by default for CI/CD friendliness.

# args.path.description
Path to the directory containing metadata files. Defaults to current directory if not specified.

# flags.targetDir.description
Directory containing Salesforce project files. Defaults to current directory. Alternative to using the path argument.

# flags.backup.description
Create backup files before modifying metadata. Backups are disabled by default for CI/CD friendliness.

# flags.gitDepth.description
Process only files changed in the last N commits. Use 0 (default) to process all files. Useful for incremental processing in CI/CD pipelines.

# flags.include.description
Only process specific metadata types. Accepts comma-separated values. Can specify with or without '-meta.xml' suffix (e.g., 'permissionset' or 'permissionset-meta.xml').

# flags.exclude.description
Exclude specific metadata types from processing. Accepts comma-separated values. Default exclusions: reportType, flexipage, layout.

# examples
- Adjust metadata files within current folder: 
<%= config.bin %> <%= command.id %>

- Adjust metadata files within given folder: 
<%= config.bin %> <%= command.id %> ./force-app/main/default

Create backup files before modifying metadata:
<%= config.bin %> <%= command.id %> --backup

Process only files changed in the last 50 commits:
<%= config.bin %> <%= command.id %> --git-depth 50

Process only files changed in the last 50 commits and take backup:
<%= config.bin %> <%= command.id %> ./src/main/default --backup --git-depth 50

Process only permissionset files:
<%= config.bin %> <%= command.id %> --include permissionset

Process only permissionset and profile files:
<%= config.bin %> <%= command.id %> --exclude permissionset,profile

Process only permissionset files changed in the last 50 commits:
<%= config.bin %> <%= command.id %> --git-depth 50 --include permissionset-meta.xml

Skip reportType and flexipage files:
<%= config.bin %> <%= command.id %> --exclude reportType,flexipage

Skip layout files and only process permissionset and profile files:
<%= config.bin %> <%= command.id %> --exclude layout --include permissionset,profile