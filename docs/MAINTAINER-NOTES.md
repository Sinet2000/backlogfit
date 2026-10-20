# Maintainer notes

Notes for people who maintain this repository. They are not needed to use or contribute to
Backlogfit.

## Company attribution block

The company name appears in exactly two places, each wrapped in HTML comment markers:

- `README.md`, section "Author"
- `AUTHORS.md`

```md
<!-- company-attribution:start -->
Dexlaris
<!-- company-attribution:end -->
```

This block must be removed if the company's policy does not allow its name to be associated
with the project (for example after a policy change, an employment change, or on request).

How to remove it:

1. Delete everything from `<!-- company-attribution:start -->` to
   `<!-- company-attribution:end -->`, including both marker lines, in **both** files.
   For example:

   ```sh
   for f in README.md AUTHORS.md; do
     sed -i.bak '/<!-- company-attribution:start -->/,/<!-- company-attribution:end -->/d' "$f" && rm "$f.bak"
   done
   ```

2. Check that nothing else mentions it: `git grep -n -i dexlaris` must return no results.
3. Commit with `git commit -s -m "docs: remove company attribution"`.

The personal author line (`NN Y2K0 (Nikita Nikitins)`) is independent of this block. No website
links, email addresses or other contact details for authors are published anywhere in the
repository; please keep it that way.

## Credits wording

The README "Credits" paragraph about the estimation technique is deliberately worded. Keep it
verbatim. "Planning poker" is used only descriptively (the technique), never as a product name
or in branding.

## Other

- Releases: see [RELEASING.md](RELEASING.md).
- Dependency notes: see [DEPENDENCIES.md](DEPENDENCIES.md). Each package owner maintains its
  own `docs/dependencies/<pkg>.md`.
- Workflow actions are pinned by commit SHA. Dependabot proposes updates; check the release
  notes of the action before merging, and keep the `# vX.Y.Z` comment in sync.
