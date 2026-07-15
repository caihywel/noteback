# ARCHITECTURE.md — How NodNôl actually works

> A plain-English map of the app as it stands today (July 2026), written during
> Phase 1. **Nothing in the code was changed to produce this** — it only
> describes what's already there, so we both understand the machine before we
> start taking it apart.

---

## The one-sentence version

Everything — the page layout, the styling, and all the logic — lives in a
single file, `index.html` (~2,670 lines). The browser loads that one file, talks
directly to Supabase (the database) and Cloudinary (video storage), and swaps
which "screen" is visible without ever loading a new page.

---

## The big picture

```
                 ┌─────────────────────────────────────────────┐
   Teacher /     │              index.html                     │
   Student  ───▶ │   (HTML + CSS + JavaScript, all in one)     │
   browser       │                                             │
                 │   ┌───────────┐        ┌────────────────┐    │
                 │   │  Screens  │        │  JS functions  │    │
                 │   │  &panels  │◀──────▶│  (~70 of them)  │    │
                 │   └───────────┘        └────────────────┘    │
                 └───────┬───────────────────────┬─────────────┘
                         │                        │
              login + all data              video files
                         │                        │
                         ▼                        ▼
                  ┌─────────────┐          ┌──────────────┐
                  │  Supabase   │          │  Cloudinary  │
                  │ (Postgres + │          │ (video host) │
                  │  Google     │          └──────────────┘
                  │  login+RLS) │
                  └─────────────┘
```

- **Supabase** does three jobs: it logs people in with their Google account, it
  stores all the data (users, classes, videos, comments, groups), and it
  enforces the security rules (RLS) that decide who can see what.
- **Cloudinary** only stores the actual video files. When a teacher uploads a
  video, the file goes straight to Cloudinary from the browser, and Cloudinary
  hands back a web address. That address is what gets saved in the database (in
  a column still confusingly named `drive_url` — a leftover from the old Google
  Drive days).
- There is **no server of our own**. GitHub Pages just serves the one static
  file. All the "thinking" happens in the visitor's browser.

---

## Screens vs. panels (how navigation works)

The app never loads a second page. Instead it shows and hides big `<div>`
blocks. There are two levels of this:

**Screens** (only ever one visible at a time), switched by `showScreen()`:

| Screen | When you see it |
|---|---|
| `app-loading` | The spinner at the very start while it checks if you're logged in |
| `screen-auth` | The "Sign in with Google" card |
| `screen-setup` | First-time only: "Are you a teacher or a student?" |
| `screen-app` | The real app — sidebar on the left, content on the right |

**Panels** (inside `screen-app`), switched by `showPanel()`:

| Panel | What it is |
|---|---|
| `panel-home` | The landing dashboard — your classes as cards |
| `panel-classes` | The classes list **and** the detail view for one class (two sub-views inside one panel) |
| `panel-admin` | Admin only: users, all classes, invite a teacher |
| `panel-join` | Student only: type an invite code to join a class |
| `panel-player` | The full-screen video player with comments — technically a panel but it covers the whole screen |

The class detail view is itself split into three **tabs** (`switchTab`): Videos,
Groups, Students. The admin panel has its own three tabs (`switchAdminTab`):
Users, Classes, Invite.

---

## The journey through the app

### 1. Starting up (`init`)
On load, `init()` asks Supabase "is anyone already logged in?"
- **Nobody logged in** → show the sign-in screen.
- **Logged in, but not a school email** → sign them straight back out and show
  an "access denied" message. The allowed domains live in the `ALLOWED_DOMAINS`
  list near the top of the script.
- **Logged in with a school email** → `loadProfile()` fetches their profile row.

`init()` also sets up a listener (`onAuthStateChange`) so that when someone
finishes the Google login popup, the same checks run again.

### 2. Profile & role (`loadProfile`, `selectRole`, `saveRole`)
- **No profile row yet** → show the setup screen to pick teacher or student.
  `saveRole()` writes the choice (plus their name, avatar and language) into the
  `profiles` table.
- **Profile exists** → set the language, show the main app, run `loadApp()`.

### 3. The main app (`loadApp`, `updateSidebar`)
`loadApp()` builds the sidebar, shows the home panel, and lists your classes in
the sidebar. `updateSidebar()` decides which buttons you can see based on your
role — teachers get "New Class" and the video/invite tools; students get "Join a
Class"; only admins see the Admin section.

### 4. Classes
- **Teachers** see classes they own (`teacher_id` = them).
- **Students** see classes they've joined (via the `class_members` table).
- `openClass()` opens the detail view: invite code, and the Videos/Groups/
  Students tabs.
- `createClass()` inserts a new row; Supabase auto-generates the 6-character
  invite code.
- **Joining** (`joinClass`) does **not** query the classes table directly.
  It calls a database function, `join_class_by_code`, which looks up the code
  on the server and adds the membership in one go. (This is deliberate and
  documented in CLAUDE.md — reverting it to a direct lookup will break joining.)

### 5. Videos
- `openAddVideoModal()` opens the upload box. You pick an individual student
  **or** a group, give it a title, and choose a file.
- `handleFileSelect()` → `uploadToCloudinary()` sends the file straight to
  Cloudinary with a live progress bar, and remembers the returned URL in
  `uploadedVideoUrl`.
- `addVideo()` then saves a `videos` row. For a **group** video it inserts one
  row **per group member** (all pointing at the same video URL), so each student
  sees it as "theirs". The video list then de-duplicates those back into a
  single entry for the teacher.

### 6. The video player & comments
- `openVideo()` loads the chosen video into a normal HTML `<video>` element and
  wires up the play/pause/skip/speed controls and the timeline.
- Comments are timestamped. `saveComment()` records the current video time, the
  chosen category, the text, and whether it came from a teacher or student.
- `loadComments()` fetches them; `renderComments()` draws them in the right-hand
  list; `renderMarkers()` draws the coloured dots on the timeline. Clicking a dot
  or a comment's time (`seekTo`) jumps the video to that moment and highlights
  the matching comment.
- Categories (Rhythm/Pitch/Expression/Technique/Ensemble/General) are stored in
  English internally but shown in whichever language is active, each with its own
  colour.

### 7. Groups (`loadGroups`, `openManageGroup`, …)
Within a class, a teacher can make ensemble/pair groups, add and remove members,
and delete groups. Groups are what make a single "group video" fan out to every
member.

### 8. Admin (`loadAdminPanel`, …)
Admins get platform-wide stats, a full user list (with role-change, delete, and
"view as"), a list of every class, and a teacher-invite helper (which actually
just prepares a copy-pasteable message — see the bug list).

### 9. "View as" / impersonate (`startImpersonating`)
Swaps the profile held **in the browser** so the admin can preview what another
user sees. **Important and already noted in CLAUDE.md:** this does *not* change
the actual database session, so it is **not** a real test of the security rules.

---

## Language handling

Every piece of visible text has an entry in a big `T` object with `cy` (Welsh)
and `en` (English) versions. The `t()` helper looks up the right one, and
`applyLang()` walks through the page setting each label. Welsh is the default and
the fallback. (Note: `applyLang()` doesn't cover *every* label on the page — see
the bug list.)

---

## Where the data lives (recap)

Seven Supabase tables: `profiles`, `classes`, `class_members`, `videos`,
`comments`, `groups`, `group_members`. Row Level Security is on for all of them
and is the real thing protecting the data, because the Supabase key sits in the
page source of a public site by necessity. The full schema and the story of how
RLS was made to work are in CLAUDE.md.

---

## Why this is fragile (the honest summary)

1. **One 2,670-line file.** Layout, styling and every function share one
   namespace. A typo in one corner can silently affect another. This is the
   single biggest source of risk and is exactly what Phase 2 is meant to fix.
2. **No tests and no build step.** The only way to know something works is to
   try it in a real lesson.
3. **Manual deploy.** Uploading `index.html` through the GitHub website by hand
   means it's easy to deploy a half-finished version.
4. **Errors mostly show as a toast, then the app carries on.** A failed database
   call often leaves the screen half-drawn rather than telling you clearly what
   went wrong.

The specific bugs and fragile spots are listed separately in the chat.
