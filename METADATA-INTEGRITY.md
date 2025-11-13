# Metadata Integrity Command Guide

`sf swift metadata integrity` audits your Salesforce project for dangling references after metadata deletions. The command inspects recent Git history (or simulated removals) to find Apex classes, Visualforce pages, and custom fields that were removed, then scans the rest of the workspace for anything that still references them.

## How the scan works

1. **Collect removals**
   - Reads Git history up to the configured `--git-depth` to locate deleted metadata files.
   - Accepts manual simulations with `--test-with-class` and `--test-with-field` flags.
   - Classifies removals into `ApexClass`, `CustomField`, or `VisualforcePage` buckets.
2. **Build lookup index**
   - Normalises names (e.g., `Account.Legacy__c`) for fast, case-insensitive matching.
3. **Cross-reference project files**
   - Parses relevant metadata XML and scans source content to flag lingering references.
4. **Report issues**
   - Prints a human-readable summary or emits structured JSON when `--json` is supplied.

## Supported reference checks

| Removed Item Type | Reference Sources Inspected | Notes |
|-------------------|-----------------------------|-------|
| Apex class | Profiles (`classAccesses`), Permission Sets (`classAccesses`), Apex source, LWC modules, Aura markup, Visualforce pages, Flow action calls | Flow controller references and imports are detected regardless of case. Manual simulations skip class definitions to avoid false positives. |
| Custom field | Profiles (`fieldPermissions`), Permission Sets (`fieldPermissions`), Flow input assignments, Layouts, Field Sets, Record Types, Compact Layouts, Formula fields, Validation rules | Flow references are matched case-insensitively (e.g., `account.externalid__c` matches `Account.ExternalId__c`). Object-aware filters reduce false positives. |
| Visualforce page | Profiles (`pageAccesses`) | Only enabled page accesses are considered, matching controller usage scenarios. |

## CLI usage highlights

```bash
# Default: analyse last 5 commits in current directory
sf swift metadata integrity

# Increase history window
sf swift metadata integrity --git-depth 15

# Target a specific directory
sf swift metadata integrity ./force-app/main/default

# Emit JSON for automation
sf swift metadata integrity --json

# Simulate removals without touching Git history
sf swift metadata integrity --test-with-class LegacyService --test-with-field Account.Legacy__c
```

### Key flags

| Flag | Purpose |
|------|---------|
| `--git-depth <n>` | Number of commits to inspect for deletions (default `5`, automatically clamped to available history). |
| `--target-dir <path>` | Directory to analyse when no positional path is provided. |
| `--json` | Emit machine-readable output for pipelines and bots. |
| `--test-with-class <name>` | Pretend an Apex class was removed. Repeatable for multiple classes. |
| `--test-with-field <Object.Field__c>` | Pretend a custom field was removed. Repeatable for multiple fields. |

## Output anatomy

When run in standard mode the command prints a summary that lists every removed item and any lingering references. With `--json`, the output structure is:

```json
{
  "status": 1,
  "result": {
    "gitDepthUsed": 5,
    "removedItems": [
      {
        "type": "ApexClass",
        "name": "ObsoleteService",
        "referenceKey": "ObsoleteService",
        "sourceFile": "force-app/main/default/classes/ObsoleteService.cls"
      }
    ],
    "issues": [
      {
        "type": "MissingApexClassReference",
        "missingItem": "ObsoleteService",
        "referencingFile": "profiles/Admin.profile-meta.xml",
        "detail": "Class access still enabled for removed Apex class 'ObsoleteService'"
      }
    ]
  },
  "warnings": []
}
```

- `status` is `0` when no issues are found, `1` otherwise.
- `result.removedItems` lists every detected or simulated removal.
- `result.issues` describes each lingering reference with actionable `detail` text.
- `warnings` contains non-blocking messages (e.g., when depth exceeds history).

## Best practices

- **Confirm depth**: Start with the default depth (5 commits) and adjust as needed. The command clamps depth to available history to avoid Git errors.
- **Use simulations for refactors**: `--test-with-class` and `--test-with-field` help evaluate impact before deleting metadata for real.
- **Automate in CI/CD**: Combine with `--json` to block merges that leave dangling references. A failing exit code (`1`) signals your pipeline to stop.
- **Handle large repositories**: Run the command from package roots (e.g., `force-app/main/default`) to focus scans and reduce runtime.
- **Review details**: The `detail` message explains why each issue was flagged, making it easier to locate the source of a dangling reference.

## Limitations and roadmap

- Only Apex classes, Visualforce pages, and custom fields are tracked as removed items today.
- Flow detection covers Apex action calls and field usage but does not yet inspect custom metadata or platform events.
- Aura and LWC scanning focuses on controller imports. Template-level references that do not import controllers are not inspected.

## Example workflows

### Local audit before a deploy

```bash
git checkout feature/remove-legacy-field
git commit for example 10 times
sf swift metadata integrity --git-depth 10 --json | jq
```

Review the JSON output to ensure no lingering references remain before packaging changes.

### Pull request gate in GitHub Actions

```yaml
jobs:
  metadata-integrity:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install plugin
        run: sf plugins install .
      - name: Scan metadata integrity
        run: sf swift metadata integrity --json > integrity.json
      - name: Fail when issues are found
        run: |
          jq '.status' integrity.json | grep 0
```

Update the action to parse `integrity.json` and comment on the PR with the report for full visibility.

---

Need help or have ideas to extend the checker? Open an issue or pull request—the integrity analyzer is intentionally modular so new detectors can be added with dedicated tests.
