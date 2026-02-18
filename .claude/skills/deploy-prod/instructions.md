Merge dev into main and deploy to production.

## Steps

1. **Check branch**: Confirm we're on the `dev` branch. If not, error and tell the user.

2. **Check for uncommitted changes**: Run `git status`. If there are uncommitted changes, stop and tell the user to commit first (`/end`).

3. **Show what's shipping**: Run `git log main..dev --oneline` to show what commits will be merged. Show this to the user.

4. **Ask for confirmation**: Ask the user "Ready to ship these to production?" and wait for confirmation before proceeding.

5. **Merge and push**:
   ```
   git checkout main
   git merge dev
   git push origin main
   git checkout dev
   ```

6. **Report**: Tell the user:
   - What was shipped (commit summary)
   - Production URL: https://toney-mobile.vercel.app
   - "Production is now updated. You're back on the dev branch."
