# Incirql Footer Sticky Incident Report

Date: 2026-04-08
Scope: Mobile footer/bottom-nav positioning in the Incirql Capacitor app
Primary file: Incirql.jsx

## 1) User-Visible Problem

The footer/bottom bar was expected to remain pinned to the bottom of the screen while chat/persona content scrolled.

Observed behavior:
- Footer appeared to move with content or was only visible after scrolling.
- In some iterations, homepage personas became unscrollable.

## 2) Root Causes (What Actually Broke)

### Root Cause A: Tailwind did not scan the mounted UI file
The live app is mounted from `src/main.jsx` and imports `../Incirql` (root-level `Incirql.jsx`).

However, Tailwind config only scanned:
- `./index.html`
- `./src/**/*.{js,ts,jsx,tsx}`

That means utility classes used in root-level `Incirql.jsx` (including sticky/fixed position utilities) were not guaranteed to be present in generated CSS after rebuilds.

Impact:
- Positioning changes looked correct in source but were missing or inconsistent in runtime CSS.

### Root Cause B: Global scroll lock overcorrection
To force footer stability, global `overflow-y: hidden` was temporarily applied on `html/body/#root`.

Impact:
- It blocked document-level vertical scrolling in WebView.
- Nested scroll regions did not always recover correctly, making persona list unscrollable.

### Root Cause C: Scroll ownership in nested flex layout
For `overflow-y-auto` children to scroll reliably inside nested flex layouts, parent chain must allow shrinkage (`min-h-0` in key wrappers).

Impact:
- Without `min-h-0` at key levels, inner lists can fail to scroll in mobile WebView environments.

### Root Cause D: Asset deployment mismatch (web vs Android)
Even when web source was corrected, Android app could still show old behavior if fresh `dist` assets were not synced into Capacitor Android assets.

Impact:
- Device behavior looked unchanged despite source edits.

## 3) Timeline of Attempts

### Attempt 1: Force fixed footer/nav classes in `Incirql.jsx`
What was done:
- Applied `fixed bottom-0 left-0 right-0 z-40/z-50` and safe-area padding style.

Why it was insufficient:
- Tailwind purge/content scanning excluded root `Incirql.jsx`, so classes were not reliably in CSS bundle.

### Attempt 2: Lock the whole page with global overflow hidden
What was done:
- `overflow-y: hidden` added to `html/body/#root`, viewport shell hard lock.

Result:
- Footer looked pinned, but homepage personas became unscrollable (regression).

### Attempt 3: Correct Tailwind scanning + rebuild/sync
What was done:
- Updated `tailwind.config.js` content paths to include root files:
  - `./*.{js,ts,jsx,tsx}`
- Rebuilt and synced assets:
  - `npm run build`
  - `npx cap sync android`

Result:
- Footer utility classes became available in generated CSS.

### Attempt 4: Remove harmful global lock and fix flex scroll chain
What was done:
- Removed global `overflow-y: hidden` from `src/index.css`.
- Kept app shell bounded (`h-[100dvh]` + `overflow-hidden`).
- Added `min-h-0` to key intermediate flex wrappers in `Incirql.jsx`.

Result:
- Persona lists scroll again.
- Footer/nav remain pinned as intended.

## 4) Final Stable Fix (Implemented)

### Files changed
- `tailwind.config.js`
  - Added root-level scan path:
    - `"./*.{js,ts,jsx,tsx}"`

- `src/index.css`
  - Reverted global vertical lock.
  - Kept safe defaults for body sizing and touch behavior.

- `Incirql.jsx`
  - Footer/nav kept fixed with safe-area-aware bottom padding.
  - App shell bounded to viewport height.
  - Added `min-h-0` in key flex wrappers to preserve inner scrolling.

### Asset deployment
- Rebuilt web assets and synced to Android:
  - `npm run build`
  - `npx cap sync android`

## 5) Verification Checklist

1. Open homepage with many personas.
2. Scroll persona list:
- Expected: list scrolls naturally.
- Expected: footer/bottom nav remains pinned at bottom.

3. Open a chat thread and scroll messages:
- Expected: messages scroll.
- Expected: chat footer remains pinned and visible.

4. Keyboard interaction on Android:
- Expected: footer remains anchored with safe-area padding.

## 6) Preventing Recurrence

- Always ensure Tailwind `content` includes the real mounted component locations.
- Avoid global `overflow-y: hidden` unless absolutely required and tested for nested scroll regions.
- In nested flex layouts with scrollable children, include `min-h-0` in intermediate wrappers.
- After UI fixes for Capacitor builds, always run both:
  - `npm run build`
  - `npx cap sync android`

## 7) Current Status

Status: Resolved in source and synced to Android assets.

If runtime still shows old behavior, perform a clean relaunch/reinstall of the app on device to clear stale WebView/app process state.
