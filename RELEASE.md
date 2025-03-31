# Release Process for zod-from-json-schema

This document outlines the steps to create a new release of the package.

## Release Steps

1. **Update package version in package.json**:
   ```bash
   # From the project root directory
   npm version patch   # For a bug fix (0.0.x)
   npm version minor   # For new features (0.x.0)
   npm version major   # For breaking changes (x.0.0)
   ```
   This will automatically:
   - Update the version in package.json
   - Create a git commit with that change
   - Create a git tag for the version

2. **Push the changes and tag**:
   ```bash
   git push origin main --tags
   ```

3. **Create a GitHub Release**:
   - Go to the "Releases" section of your GitHub repository
   - Click "Draft a new release"
   - Select the tag you just pushed (should match the version in package.json)
   - Add a title and description for the release
   - Click "Publish release"

4. **Monitor the GitHub Actions workflow**:
   - The publish workflow will trigger automatically when the release is created
   - It will verify that the package version matches the release tag
   - It will build, test, and publish the package to npm
   - You can monitor progress in the "Actions" tab of your GitHub repository

## Important Notes

- The version in package.json determines what version is published to npm
- The GitHub release tag should match the version in package.json (with or without a leading 'v')
- If there is a mismatch, the workflow will warn you but will still publish using the version in package.json
- Make sure to update the CHANGELOG.md file before creating a release