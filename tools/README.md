# tools/ — Claude's pre-merge gate for the Phase 2 split

**Cai never runs anything in here.** These are checks Claude runs in its own
sandbox before asking you to merge a split step. They do not touch the live
site, need no install on your machine, and do not violate the no-build rule —
GitHub Pages just ignores this folder.

## The three checks Claude runs before each split PR

1. **Syntax** — `node --check` on the JS. Catches a stray brace that would break
   every function at once. Syntax only.

2. **No dead buttons** — `node tools/check-handlers.mjs <html> [--globals-from=<jsfile>]`
   Every function an inline `onclick`/`oninput`/etc. calls must be reachable.
   - pre-split: `node tools/check-handlers.mjs index.html`
   - post-split: `node tools/check-handlers.mjs index.html --globals-from=app.js`
     (reads the names bridged onto `window`). Exits 1 and names the offender if
     a handler target isn't bridged — e.g. the easily-forgotten `seekTimeline`.

3. **No missing imports** — `node --check` can't see these; a function calling a
   helper it never imported throws a ReferenceError only when clicked. Claude
   runs `eslint` with `no-undef` in its sandbox across the split modules. Nothing
   is committed here for it (keeps the repo install-free); the flat config is:
   ```js
   export default [{ files:['**/*.js'], languageOptions:{ sourceType:'module',
     globals:{ window:'readonly', document:'readonly', navigator:'readonly',
               supabase:'readonly', XMLHttpRequest:'readonly', FormData:'readonly' } },
     rules:{ 'no-undef':'error' } }];
   ```
