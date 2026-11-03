# Rutina

Offline-first training tracker (PWA). No backend: data lives on the phone and, optionally,
in a linked `.json` file that the app autosaves to (File System Access API, Chromium only).

## Run locally

    python3 -m http.server 8000      # from this folder, then open http://localhost:8000

## Install on the phone

The app must be served over HTTPS (any static host works: GitHub Pages, Netlify, nginx).
Open the URL in Chrome on Android and choose "Add to home screen".

## Tests

    npm test

## Deploying a new version

Bump `VERSION` in `sw.js` so installed copies refresh their cache.
