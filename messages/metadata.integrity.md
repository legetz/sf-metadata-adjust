# description
Scan recent git history for deleted metadata and detect lingering references across access control, source code, layouts, and flows.

# args.path.description
Path to the Salesforce project root to analyze. Defaults to current directory if not provided.

# flags.targetDir.description
Directory containing metadata to analyze. Defaults to current working directory.

# flags.gitDepth.description
Number of commits to inspect for deletions. Values greater than available history will be clamped.

# flags.testWith.description
Treat provided identifiers as manually removed metadata. Use `Object.Field__c` for fields or class name for Apex. Repeat flag to test multiple items.

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

# log.metadataAnalysisComplete
🔍 Scanned {0} profile/permission set file(s) for access references.

# log.sourceAnalysisComplete
🧩 Scanned {0} source file(s) (Apex, LWC, Aura) for Apex class references.

# log.flowAnalysisComplete
🌊 Scanned {0} Flow definition file(s) for Apex class and field references.

# log.layoutAnalysisComplete
📐 Scanned {0} layout file(s) for field references.

# log.flexipageAnalysisComplete
🪟 Scanned {0} Flexipage file(s) for field references.

# log.validationAnalysisComplete
✅ Scanned {0} object metadata file(s) for validation rule field references.

# log.fieldSetAnalysisComplete
🧺 Scanned {0} field set file(s) for field references.

# log.recordTypeAnalysisComplete
🗂️ Scanned {0} record type file(s) for field references.

# log.compactLayoutAnalysisComplete
🧱 Scanned {0} compact layout file(s) for field references.

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

# warn.testWithInvalid
⚠️ Ignoring --test-with value '{0}'. Provide an Apex class name or Object.Field API name.

# error.issuesFound
Detected {0} metadata integrity issue(s). See above for details.
