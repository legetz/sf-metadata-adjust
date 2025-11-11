# description
Scan recent git history for deleted metadata and detect lingering references in Profiles and Permission Sets.

# args.path.description
Path to the Salesforce project root to analyze. Defaults to current directory if not provided.

# flags.targetDir.description
Directory containing metadata to analyze. Defaults to current working directory.

# flags.gitDepth.description
Number of commits to inspect for deletions. Values greater than available history will be clamped.

# examples
- Analyze latest 5 commits in the current directory:
  <%= config.bin %> <%= command.id %>

- Analyze a specific project root with deeper history:
  <%= config.bin %> <%= command.id %> ./force-app/main/default --git-depth 10

# log.noDeletions
✅ No metadata deletions detected in the selected commit range.

# log.elapsed
⏱️ Completed in {0} seconds.

# log.removedHeader
🗑️ Found {0} removed metadata item(s) within the last {1} commit(s):

# log.depthClamped
ℹ️ Git history only contained {0} commit(s); requested depth of {1} was clamped.

# log.analysisComplete
🔍 Scanned {0} profile/permission set file(s) for references.

# log.noIssues
✅ No lingering references detected. Metadata integrity looks good!

# log.issuesHeader
❌ Detected {0} metadata integrity issue(s):

# warn.analysisFailed
⚠️ Skipped analysis for {0}: {1}

# warn.notGitRepo
⚠️ {0} is not a Git repository. Skipping deletion analysis.

# warn.gitError
⚠️ Unable to analyze Git history: {0}

# error.issuesFound
Detected {0} metadata integrity issue(s). See above for details.
