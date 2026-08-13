# 75 HARD — native-feeling web app

A mobile-first PWA for tracking the **75 Hard** challenge. Dark theme, red accents, installable on your phone's home screen, works offline.

## Run locally
```bash
npx serve .
# or: python -m http.server 8080
# open http://localhost:8080
```

## Features
- **Account & cloud sync** — free Firebase database. Sign up with email/password and your progress syncs to any device. If the cloud has newer data, it wins; if this device is newer, it's pushed. Works offline (local copy) and syncs when back online.
- **Today dashboard** — 6 daily tasks, day counter, water intake tracker, daily notes
- **75-day progress grid** — completed days glow red, today pulses
- **Progress photos** — daily camera shots with compressed local storage
- **Shareable success cards** — "COMPLETED" stamps with day marker, share or download
- **Reminders** — native notifications per task / time / weekday
- **Motivation popups** — random cat videos or quotes on task completion (Settings toggle)
- **Languages** — English, Hebrew (full RTL), Russian
- **The Reset Rule** — miss a task and the counter resets to Day 1, enforced automatically
- **PWA** — install to home screen, works offline via service worker

## Set up cloud sync (free Firebase, ~5 min)
1. Go to **https://console.firebase.google.com** → **Add project** (e.g. `75-hard`) → create it.
2. In the project, click the **web icon `</>`** → register a web app → copy the **firebaseConfig** object.
3. **Build → Authentication → Get started → Sign-in method** → enable **Email/Password**.
4. **Build → Firestore Database → Create database** → choose **Production mode** → pick a location.
5. **Firestore → Rules** tab → paste these rules → **Publish**:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```
6. Open the app → **Settings → Account & cloud sync → Set up cloud sync** → paste the config → **Connect** → **Create account**.

Your progress now backs up to the cloud and restores on any device when you sign in.

The apiKey in the config is not a secret — security comes from the Firestore rules above (only the signed-in owner can read/write their data).

## Deploy to GitHub Pages (free)
1. Create a repo on GitHub (public): `gh repo create 75-hard --public --source . --push`
2. Enable Pages: `gh api -X POST repos/nitaysc/75-hard/pages -f "source[branch]=main" -f "source[path]=/"`
3. Your app is live at `https://nitaysc.github.io/75-hard/`

Install it on your phone: open the URL in Chrome/Safari → **Add to Home Screen** → opens full-screen like a native app.
