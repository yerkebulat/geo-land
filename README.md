# Geo-Land

**Geography olympiad prep** platform by **Nursultan Utebayev** (NIS Karatau, Shymkent).

Personal training room for students: landing page (path to IGeo), trilingual UI (ҚАЗ / EN / РУС), practice tests, open questions, teacher review.

**Live (after Pages is on):** https://yerkebulat.github.io/geo-land/

## Features

- Public landing: ascent path (school → city → oblast → republican → **IGeo**), topic map, mentor & medals
- Login only (4 pilot accounts, no public registration)
- **Practice tests** — multiple choice, auto-graded
- **Open questions** — written answers, AI draft score, teacher reviews
- **Teacher panel** — view all submissions, grade open questions
- **Topic presentations** — 12 topic cards linking to Google Drive folders (shared list in `js/topics.js`)
- Kazakh-first UI with English and Russian toggles
- GitHub Pages static hosting + optional **Firebase** for shared results

## Quick start

1. Enable **GitHub Pages** (branch `main`, `/root`) — see [SETUP.md](SETUP.md)
2. (Recommended) Connect **Firebase Firestore** so teacher sees students across devices
3. Log in with accounts listed in SETUP.md

## Structure

```
index.html          Landing
app.html            Dashboard
test.html           Take a test
open-hub.html       Open questions (pick topic / set)
open.html           Answer an open-question set
teacher.html        Teacher results
history.html        Student history
submission.html     View / grade one submission
css/main.css        Dark atlas theme
js/                 Auth, storage, i18n, runners
data/test-1.json    First MCQ test (30 Q)
data/open-1.json    Built-in open-question set (14)
tasks/              Original Word sources
```

## License / use

Built for Nursultan Utebayev’s olympiad students. Content language of tasks is primarily **Kazakh**.
