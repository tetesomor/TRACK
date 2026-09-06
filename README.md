# run + lift tracker

A simple installable web app for tracking runs and leg workouts, with automatic progressive-overload suggestions. No login, no backend — everything is saved locally on your device.

## What's in this folder

- `index.html` — the app shell and styling
- `app.js` — all app logic (pages, data, progressive overload calculations)
- `manifest.json` — makes the app installable on your phone
- `sw.js` — service worker, lets the app work offline and installs cleanly
- `icons/` — app icons used on your home screen

## 1. Put this on GitHub

1. Create a new repository on GitHub (e.g. `run-lift-tracker`).
2. Upload all the files in this folder to the repository, keeping the folder structure (the `icons/` folder needs to stay a folder).
   - Easiest way: on the repo page, click **Add file → Upload files**, then drag in everything here at once (including the `icons` folder).
3. Commit the files to the `main` branch.

## 2. Turn on GitHub Pages

1. In your repository, go to **Settings → Pages**.
2. Under **Build and deployment**, set **Source** to `Deploy from a branch`.
3. Set **Branch** to `main` and folder to `/ (root)`, then **Save**.
4. GitHub will give you a URL like `https://yourusername.github.io/run-lift-tracker/`. It can take a minute or two to go live.

## 3. Install it on your phone

**iPhone (Safari):**
1. Open your GitHub Pages URL in Safari.
2. Tap the **Share** icon (square with an arrow).
3. Tap **Add to Home Screen**, then **Add**.
4. The app now opens full-screen from your home screen, like a native app.

**Android (Chrome):**
1. Open your GitHub Pages URL in Chrome.
2. Tap the **⋮** menu in the top right.
3. Tap **Add to Home screen** (or you may see an **Install app** prompt automatically).
4. Confirm — it'll appear on your home screen.

## Notes on your data

- Everything you log is saved in your phone's browser storage (`localStorage`) — it stays on your device and isn't sent anywhere.
- Because it's tied to the browser, uninstalling/clearing site data, or switching phones, will reset it. There's no built-in export yet — if you want a backup/export or sync-across-devices feature later, that's a good next addition.
- Editing the code (colors, text, features) just means editing `index.html` and `app.js` and re-uploading to GitHub — changes go live on Pages automatically after a commit.
