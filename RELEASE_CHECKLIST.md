# Release Checklist

Follow this checklist before creating a new release:

## Automated Checks

- [ ] Run `npm run release` to verify all automated checks pass
  - This runs linting, builds the project, and runs all tests

## Manual Checks

- [ ] Verify the application works with a real Cloudflare account
- [ ] Test on Windows, macOS, and Linux if possible
- [ ] Check that all new features are documented in README.md
- [ ] Update the version number in package.json
- [ ] Update CHANGELOG.md with notable changes

## Release Process

1. Complete all checks above
2. Run one of:
   - `npm run release:patch` (for bug fixes)
   - `npm run release:minor` (for new features)
   - `npm run release:major` (for breaking changes)
3. Wait for GitHub Actions to complete the release workflow
4. Verify the package is published to npm

## Post-Release

- [ ] Announce the release in appropriate channels
- [ ] Update documentation website if applicable
- [ ] Create a GitHub release with release notes
