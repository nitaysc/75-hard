# 75 HARD — native-feeling web app

A mobile-first PWA for tracking the **75 Hard** challenge. Dark theme, red accents, installable on your phone's home screen, works offline.

## Run locally
```bash
npx serve .
# or: python -m http.server 8080
# open http://localhost:8080
```

## Features
- **Today dashboard** — 6 daily tasks, day counter, water intake tracker, daily notes
- **75-day progress grid** — completed days glow red, today pulses
- **Progress photos** — daily camera shots with compressed local storage
- **Shareable success cards** — "COMPLETED" stamps with day marker, share or download
- **Reminders** — native notifications per task / time / weekday
- **The Reset Rule** — miss a task and the counter resets to Day 1, enforced automatically
- **PWA** — install to home screen, works offline via service worker

## Deploy to GitHub Pages (free)
1. Create a repo on GitHub (public): `gh repo create 75-hard --public --source . --push`
2. Enable Pages: `gh api -X POST repos/nitaysc/75-hard/pages -f "source[branch]=main" -f "source[path]=/"`
3. Your app is live at `https://nitaysc.github.io/75-hard/`

Install it on your phone: open the URL in Chrome/Safari → **Add to Home Screen** → opens full-screen like a native app.
