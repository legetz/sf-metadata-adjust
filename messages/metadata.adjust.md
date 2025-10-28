# Summary

Sort and format Salesforce metadata XML files

# Description

Recursively processes all *-meta.xml files in the specified directory, sorting XML elements alphabetically with special handling for Salesforce metadata structures like PermissionSets, Profiles, and other metadata types. Can optionally process only files changed in recent Git commits. Backups are disabled by default for CI/CD friendliness.

# flags.targetDir.summary

Target directory to process

# flags.targetDir.description

Directory containing Salesforce project files. Defaults to current directory.

# Flags

## Path Argument
PATH: Optional path to the directory containing metadata files. Defaults to current directory if not specified.

## --backup
Create backup files (.bak) before modifying metadata. Backups are disabled by default for CI/CD friendliness.
Example: sf metadata adjust --backup

## --target-dir (-d)
Specify the target directory to process. Alternative to using the PATH argument.
Example: sf metadata adjust --target-dir ./force-app/main/default

## --git-depth (-g)
Process only files changed in the last N commits. Use 0 (default) to process all files. Useful for incremental processing in CI/CD pipelines.
Example: sf metadata adjust --git-depth 3

## --include (-i)
Only process specific metadata types. Accepts comma-separated values. Can specify with or without '-meta.xml' suffix.
Examples: 
  - sf metadata adjust --include permissionset
  - sf metadata adjust --include permissionset,profile
  - sf metadata adjust --include permissionset-meta.xml,profile-meta.xml

## --exclude (-e)
Exclude specific metadata types from processing. Accepts comma-separated values. Default exclusions: reportType, flexipage, layout
Examples:
  - sf metadata adjust --exclude reportType
  - sf metadata adjust --exclude reportType,flexipage,layout

# Examples

## Basic usage - process current directory
sf metadata adjust

## Process specific directory
sf metadata adjust ./force-app/main/default

## Create backups while processing
sf metadata adjust --backup

## Process only recent changes (last 3 commits)
sf metadata adjust --git-depth 3

## Process specific directory with backup and Git filtering
sf metadata adjust ./src/main/default --backup --git-depth 5

## Process only PermissionSets
sf metadata adjust --include permissionset

## Process only PermissionSets and Profiles
sf metadata adjust --include permissionset,profile

## Process only changed PermissionSets in last 3 commits
sf metadata adjust --git-depth 3 --include permissionset-meta.xml

## Exclude ReportTypes and FlexiPages
sf metadata adjust --exclude reportType,flexipage

## Complex filtering: exclude layouts but include specific types
sf metadata adjust --exclude layout --include permissionset,profile

## CI/CD workflow: process only changed metadata in last commit
sf metadata adjust --git-depth 1 --include permissionset,profile,permissionsetgroup