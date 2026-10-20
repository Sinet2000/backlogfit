## Summary

<!-- What does this change and why? Link the issue: Closes #123 -->

## How was it tested?

<!-- Commands run, new or updated tests, manual checks. -->

## Checklist

- [ ] Every commit is signed off (`git commit -s`, DCO).
- [ ] Commit messages follow Conventional Commits.
- [ ] Tests added or updated; `pnpm verify` and `pnpm build` pass locally.
- [ ] E2E tests pass or are not affected (`pnpm e2e`).
- [ ] Docs and `CHANGELOG.md` (Unreleased) updated for user-visible changes.
- [ ] New dependencies are pinned and justified in `docs/dependencies/<pkg>.md`.
- [ ] Privacy invariants kept: no vote values before reveal, secrets only in the URL fragment, no third-party requests, no logging of request data.
- [ ] No code or assets copied from other estimation or planning poker projects.
