# CLAUDE.md — NodNôl

> Read automatically by Claude Code at the start of every session.
> **This repo is public — never add API secrets, keys or student data to this file.**
> **Last updated:** 15 July 2026

---

## Who I am

Cai Hywel — Welsh-medium music teacher at Ysgol Cwm Rhymni, South Wales. Classroom teacher and teacher mentor. Not a professional developer. I need explanations in plain English, and step-by-step instructions when it comes to GitHub, Supabase, or anything terminal-based. Welsh speaker; the platform is bilingual and Welsh comes first.

Email: `chh@ygcwmrhymni.net`

---

## What NodNôl is

A bilingual Welsh/English **video feedback platform for KS3 music lessons**.

Teachers film student performances, upload them, and add **timestamped comments** pinned to exact moments in the video, categorised by musical element. Students then respond, creating a genuine feedback dialogue rather than verbal feedback that vanishes the moment the lesson ends.

**The name:** NodNôl = short for *"Nodyn yn ôl"* (a note back). Pronounceable in English, Welsh in origin, and it's "London" backwards. Formerly called NoteBack.

**Why it matters:** Almost no Welsh-medium EdTech exists. That's a genuine competitive moat, not just a feature.

---

## Live infrastructure

| Thing | Where |
|---|---|
| **Live site** | `caihywel.github.io/noteback` |
| **Hosting** | GitHub Pages (repo: `caihywel/noteback`, **public**) |
| **Database + Auth** | Supabase (project `noteback`, ID `eszaolyporhlbrewvoks`) |
| **Video hosting** | Cloudinary (cloud name `dnia0eihr`, upload preset `noteback_videos`, unsigned, folder `noteback`) |
| **Auth** | Google OAuth, restricted to `@ygcwmrhymni.net` accounts only |

**Previously on Netlify** — abandoned after hitting free-tier deploy limits. The old URL `adborth-cerddoriaeth.netlify.app` is dead. Don't reference it.

### Deployment & source of truth (read before touching the live site)

**The GitHub repo is the single source of truth — NOT any folder on Cai's
computer.** Since the Phase 2 split began, the repo has files a stale local copy
does **not** (`styles.css`, and soon `app.js` + feature modules), and its
`index.html` has moved on. **Never treat a local folder as authoritative.** If an
old local folder were ever dragged up, it would wipe the split and resurrect the
dead monolithic `index.html`.

There are two deployment paths. Always know which one you're on.

**Path A — the normal Phase 2 flow (Claude edits): merge = deploy.**
Claude commits to a branch → a PR is opened → **Cai merges the PR on GitHub.**
Merging **is** the deploy: GitHub Pages rebuilds automatically (~2 min), then
refresh the live site. **Cai uploads nothing and drags nothing** — the files are
already in the repo on the branch. This is what Phase 2 runs on.

**Path B — hand-editing without Claude (emergency / one-off only).** The ordering
is strict, because the repo, not the laptop, is the truth:
1. **Download the CURRENT files from GitHub first** — never start from an old
   local copy. Open the repo and take the live version of each file you'll edit.
2. Edit those downloaded files.
3. `github.com/caihywel/noteback` (logged in) → **Add file → Upload files.**
4. **Select the files themselves and drag the *files* onto the page — NOT the
   containing folder.** GitHub keeps folder structure, so dragging a folder would
   create `noteback/index.html` in a subdirectory and Pages (serving from the repo
   **root**) would 404. Drag the loose files.
5. **Commit changes.** ~2 min, then refresh. Upload every file the change touches,
   together, so the set never mismatches.

**No build step, ever** (both paths). Native browser modules — plain `.js`/`.css`
the browser loads directly. The files in the repo are exactly what gets served;
nothing is compiled, bundled or transformed. No Node, no npm, no `build`. If any
plan introduces a build step, reject it. Deploy at 8am with nothing but a browser.

**Browser caching after a deploy.** Separate `.js`/`.css` files can be briefly
cached (~10 min on GitHub Pages). Deploy with a buffer before the lesson, not at
8:58 for a 9am start. Stale device: hard refresh — Ctrl+Shift+R (Windows) /
Cmd+Shift+R (Mac).

**Phase 2 watch-out — inline handlers will silently die under module scope.**
`index.html` has **75 inline handler attributes** (`onclick`/`oninput`/`onchange`/
drag) depending on **~50 global functions**. Those work today only because it's
all one plain `<script>`. Move the JS into `<script type="module">` files and
those functions stop being global, so every inline handler becomes a button that
does nothing — with no error. Plan: during the split, **bridge the functions onto
`window`** so behaviour stays byte-for-byte identical, then verify with (a) a
static name-diff of handler targets vs. what's attached to `window`, and (b) a
one-line console check that every expected function is defined. Do not modernise
handlers to `addEventListener` in the same step as the split. **Regenerate the
handler/function lists from the current file each time — don't trust an old
count. `seekTimeline` (added in Phase 1.5) is the newest name that must be in the
bridge, and exactly the kind that gets forgotten.**

**Phase 2 open bug — apostrophes / injection in `onclick` strings.** Many buttons
are built by pasting data straight into an `onclick` (e.g. `removeStudentFromClass`,
`startImpersonating`, `deleteUser`, `adminDeleteClass`). A value containing a
single quote — a pupil or teacher called **O'Brien** — breaks that button, and in
principle allows injection. **This is a KNOWN, still-OPEN hole, not a fixed one.**
Note the trap we already fell into: HTML-escaping the quote to `&#39;` does **not**
fix it, because the browser HTML-decodes the attribute back to `'` *before*
compiling it as JavaScript, so the string still breaks. Two real fixes exist:
1. **Event delegation** with `data-` attributes (stop putting data in `onclick` at
   all) — **preferred**, because the affected buttons include destructive admin
   actions and delegation removes the whole class of bug.
2. **A JS-string escape** (backslash-escape the quote, e.g. `\'`), which *does*
   survive HTML decoding. Lighter touch, but leaves the inline-handler pattern in
   place. Recorded so we remember there was a choice; delegation is still the plan.

---

## Codebase

**One single file: `index.html`, roughly 2,600 lines.** All HTML, CSS and JavaScript in one place. This is the root cause of a lot of our pain and splitting it up is the top priority for Claude Code.

### Database schema (Supabase)

- `profiles` — id, email, full_name, avatar_url, role (`admin`/`teacher`/`student`), language (`cy`/`en`)
- `classes` — id, name, description, teacher_id, invite_code (auto 6-char), created_at
- `class_members` — id, class_id, student_id, joined_at
- `videos` — id, class_id, student_id, uploaded_by, title, piece, drive_url (stores the Cloudinary URL), group_id, recorded_at
- `comments` — id, video_id, author_id, timestamp_seconds, text, category, role, created_at
- `groups` — id, class_id, name, description, created_at
- `group_members` — id, group_id, student_id, joined_at

### ✅ RLS is ENABLED and working (July 2026)

Row Level Security is **on across all seven tables** and verified end to end. Do not disable it.

**How the recursion was finally solved.** Three earlier attempts died with `infinite recursion detected in policy for relation "classes"` — the `classes` policy queried `class_members`, whose policy queried `classes`, forever. The fix is **`SECURITY DEFINER` helper functions**: they run with elevated rights and skip RLS when looking things up, so the loop can't form. The helpers are `is_staff()`, `is_admin()`, `my_taught_classes()`, `my_joined_classes()`, `my_visible_videos()`.

**Every policy is granted `TO authenticated`.** This is the bit that actually protects us. The anon key is unavoidably public — it sits in the page source of a static site — but on its own it now returns **zero rows** from every table. (Note: making the repo private would NOT help, and isn't possible on the free plan anyway. RLS is the only real protection.)

**Joining a class needs an RPC, not a direct query.** Chicken and egg: you can't see a class until you've joined it, but you had to look it up by invite code in order to join. Solved with a `SECURITY DEFINER` function `join_class_by_code(p_code)` that looks up the code server-side, adds the membership, and returns only that one class. `joinClass()` calls `sb.rpc('join_class_by_code', ...)`. **Never revert this to a direct `.eq('invite_code', ...)` query — it will 406.**

**Emergency rollback exists** (`EMERGENCY-rollback-rls.sql`) — disables RLS and drops all policies in about two seconds, no data touched. Genuine emergencies only.

#### How to test RLS properly (learned the hard way)

- **The impersonate / "view as" feature does NOT test RLS.** It swaps the profile in the browser, but the Supabase session is still the admin's — the database still sees Cai. It gives a false pass.
- **"Dim dosbarthiadau eto" on a fresh account proves nothing.** The app filters by user anyway, so you'd see that screen with the database wide open.
- **The real test** is a genuine second login in a private window, querying the database directly in the console, bypassing the app entirely:
  ```js
  (await sb.from('classes').select('name')).data   // expect []
  (await sb.from('videos').select('title')).data   // expect []
  ```
- **Then test it isn't too tight.** Join a class with a real invite code and confirm a pupil can see their own video, read feedback and reply. This is what caught the join bug — a too-tight policy would have locked out every pupil in the next lesson.

Verified July 2026: stranger sees nothing → pupil joins → admin comments → pupil reads and replies → admin reads the reply.

### Features currently working

- Google OAuth login, restricted to school domains via the `ALLOWED_DOMAINS` list near the top of the JS. Currently `@ygcwmrhymni.net` (pupils and most staff) and `@staff.ygcwmrhymni.net` (staff subdomain). **Keep the `@` in each entry** — without it, a lookalike domain like `notygcwmrhymni.net` would be let straight in. One line to add a new school.
- Roles: admin / teacher / student (admin = teacher + superuser, not a separate thing)
- Full Welsh/English toggle throughout
- Classes with auto-generated invite codes
- Ensemble/pair groups with member management
- Direct Cloudinary video upload with progress bar (**100MB hard limit** on free tier)
- Fullscreen video player: timeline, play/pause/skip/speed
- Timestamped comments with coloured dot markers on the timeline; clicking a marker seeks the video and highlights the comment
- Comment categories, each colour-coded: Rhythm/Curiad, Pitch/Traw, Expression/Mynegiant, Technique/Techneg, Ensemble, General/Cyffredinol
- Admin panel: user management, role changes, stats, invite teacher, impersonate ("view as") with a persistent purple banner to return
- Remove student from class (red "Tynnu" button in the Disgyblion tab)

---

## Known bugs and open issues

- **"Ychwanegu Fideo" button sometimes doesn't fire.** Intermittent. `currentClass` and `uploadedVideoUrl` were both confirmed correct when it failed, so the click handler itself isn't registering. Unresolved.
- **`.MOV` files don't play on Windows laptops.** Apple devices fine. Need automatic transcoding to MP4 (Cloudinary can do this).
- **100MB upload limit** — Cloudinary free tier. Students recording at 1080p regularly exceed it. Advise 720p, or compress via HandBrake / Clideo / Photos app export.
- ~~Join-class code silently fails first attempt~~ — likely fixed July 2026. The join is now a single atomic `join_class_by_code` RPC rather than two separate round-trips that could race. Watch to confirm.
- **Student-side reports (from homework task):** some can't watch their video, some can't add comments, some can't see comments. Mixed devices at home (Chromebook/iPad/Windows/Mac). Comments *are* saving correctly in the database — confirmed by SQL query. **Two live hypotheses, not yet narrowed:** (A) comments *are* fetched but not visible — layout/cache; the player's comments column is a fixed 280–320px panel in a horizontal flex row with `overflow:hidden` and no mobile stacking, so on phones/portrait tablets it's clipped off-screen (explains the narrow-screen subset only, NOT the Chromebook/Windows-laptop reports); (B) comments are *not* fetched — the pupil's browser gets zero rows for that video (a membership/visibility or auth-state issue), even though the rows exist when queried as admin. Do **not** assume "client-side" — (B) is server-side and still open.
  **BLOCKED until September** — needs an affected pupil, on the device where it fails, running this in the browser console on the live site: `(await sb.from('comments').select('*').eq('video_id','THE-VIDEO-ID')).data`. Rows back → it's (A), layout/cache. `[]` or error → it's (B), visibility. That one test splits the two; nothing conclusive before then.
- **Welsh/English flag emojis show as black squares on Windows.** Not our bug — Windows doesn't render those flag emojis. Left as-is deliberately.
- **Supabase free tier pauses the project after ~7 days of inactivity.** Happened over half term; site showed an endless "Llwytho..." spinner. Fix: supabase.com → project → **Restore**. Decided to stay on free tier and unpause manually.

---

## The Claude Code plan (5 phases, agreed but not started)

Blocked on a Windows setup issue — `CLAUDE_CODE_GIT_BASH_PATH` needed setting, then a full PC restart.

1. **Understand and stabilise** — read everything, write `ARCHITECTURE.md`, list all bugs. **Change nothing.**
2. **Split the monolith** — break `index.html` into separate files (markup, styles, and JS modules: auth, classes, videos, comments, groups, admin). Commit after each step.
3. ~~**Get RLS working properly**~~ — ✅ DONE, July 2026. See the RLS section above.
4. **Fix the video codec problem** — automatic MP4 transcoding.
5. **Add a basic test safety net** — login, create class, upload video, add comment.

---

## How I like to work

- Plain English, no jargon. Explain what a thing does before telling me to do it.
- Step-by-step for anything involving GitHub, Supabase, PowerShell or the terminal — including where the buttons are.
- I'm on Windows at school and Mac at home, so keyboard shortcuts need specifying.
- I test in real lessons with real students, so a working version beats a perfect one.
- Don't let me skip the careful bit on anything touching student data.
