# Geo-Land

**Geography olympiad prep** platform by **Nursultan Utebayev** (NIS Karatau, Shymkent).

Personal training room for students: landing page (path to IGeo), bilingual UI (ҚАЗ / EN), tests, calculation exercises, teacher review.

**Live (after Pages is on):** https://yerkebulat.github.io/geo-land/

## Features

- Public landing: ascent path (school → city → oblast → republican → **IGeo**), topic map, mentor & medals
- Login only (4 pilot accounts, no public registration)
- **Tests** — multiple choice, auto-graded
- **Calculations** — free-text answers, teacher grades
- **Teacher panel** — view all submissions, mark calculations
- **Open questions** — placeholder for later (+ optional AI marking)
- Kazakh-first UI with English toggle
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
calc.html           Calculations
teacher.html        Teacher results
history.html        Student history
submission.html     View / grade one submission
css/main.css        Dark atlas theme
js/                 Auth, storage, i18n, runners
data/test-1.json    First MCQ test (30 Q)
data/calc-1.json    First calculation set (10)
tasks/              Original Word sources
```

## License / use

Built for Nursultan Utebayev’s olympiad students. Content language of tasks is primarily **Kazakh**.
