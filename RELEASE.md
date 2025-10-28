# Release Process

## Automated Release via GitHub Actions

This project automatically publishes to npm when a version tag is pushed to the main branch.

### Prerequisites

1. **npm Token**: Ensure `NPM_TOKEN` secret is configured in GitHub repository settings
2. **Access**: You must have write access to the repository
3. **Clean State**: Ensure all changes are committed

### Release Steps

#### 1. Update Version

Choose the appropriate version bump:

```bash
# For bug fixes (1.0.0 → 1.0.1)
npm version patch

# For new features (1.0.0 → 1.1.0)
npm version minor

# For breaking changes (1.0.0 → 2.0.0)
npm version major
```

This command will:
- Update version in `package.json`
- Create a git commit with the version
- Create a git tag (e.g., `v1.0.1`)

#### 2. Push Changes

```bash
# Push both commit and tags
git push origin main --follow-tags
```

#### 3. Monitor Release

1. Go to GitHub → Actions tab
2. Watch the "Publish to npm" workflow
3. Verify successful completion

#### 4. Verify Publication

```bash
# Check npm registry
npm view sf-swift

# Test installation
sf plugins install sf-swift
```

## Manual Release (Emergency Only)

If automated release fails:

```bash
# Ensure you're on main branch
git checkout main
git pull

# Build project
npm run build

# Login to npm (if not already)
npm login

# Publish
npm publish --access public

# Create and push tag manually
git tag v1.0.X
git push origin v1.0.X
```

## Troubleshooting

### "NPM_TOKEN not found"
- Verify secret is set in GitHub: Settings → Secrets → Actions
- Token name must be exactly `NPM_TOKEN`

### "npm ERR! 403 Forbidden"
- Check npm token has publish permissions
- Regenerate token if expired

### "Version already exists"
- You cannot republish the same version
- Bump version: `npm version patch`

### Build Fails
- Check TypeScript compilation: `npm run build`
- Fix errors before pushing tag

## Version Guidelines

Follow [Semantic Versioning](https://semver.org/):

- **MAJOR** (X.0.0): Breaking changes
- **MINOR** (0.X.0): New features, backward compatible
- **PATCH** (0.0.X): Bug fixes

## Pre-release Versions

For beta/alpha releases:

```bash
# Create beta version
npm version prerelease --preid=beta
# Result: 1.0.0 → 1.0.1-beta.0

# Push with tag
git push origin main --follow-tags
```

## Changelog

Remember to update CHANGELOG.md before release:

```markdown
## [1.0.1] - 2025-10-28
### Fixed
- Bug fix description

### Added
- New feature description

### Changed
- Change description
```
