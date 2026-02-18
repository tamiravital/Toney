Push current work to the dev branch for preview deployment.

## Steps

1. **Check branch**: Confirm we're on the `dev` branch. If not, error and tell the user.

2. **Check for changes**: Run `git status`. If there are uncommitted changes, ask the user if they want to commit first (suggest running `/end` first).

3. **Push**: Run `git push origin dev`.

4. **Report**: Tell the user:
   - What was pushed (commit summary)
   - The preview URL: check the latest Vercel deployment URL using `gh api repos/tamiravital/Toney/deployments --jq '.[0:2] | .[] | select(.environment | contains("toney-mobile")) | .environment'` and then get the status URL for the environment_url
   - Remind them: "This deploys to the DEV environment (DEV Supabase). Production is not affected."
