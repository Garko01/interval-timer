# Interval Timer Architecture Overview

This document introduces the structure of the Interval Timer project so newcomers can find their way around the codebase quickly.

## High-level layout

The project is a [Vite](https://vitejs.dev/) + React + TypeScript single-page web app. The important top-level folders are:

| Path | Purpose |
| ---- | ------- |
| `src/` | React source code, styling, and timer logic. |
| `public/` | Static assets copied directly into the build output. |
| `index.html` | Vite entry HTML file with the `root` element that React hydrates. |
| `vite.config.ts` & `tsconfig*.json` | Tooling configuration for Vite and TypeScript. |

Vite handles local development (`npm run dev`) and production builds (`npm run build`). React is rendered into the DOM from `src/main.tsx`.

## Application entry point

* `src/main.tsx` boots the React app by rendering `<App />` into the `root` element and pulling in the global stylesheet. `React.StrictMode` is enabled so React surfaces potential side effects during development.【F:src/main.tsx†L1-L10】

## Core UI (`src/App.tsx`)

`App.tsx` contains nearly all of the UI and client-side state management.【F:src/App.tsx†L1-L210】 Key pieces:

* **Local settings state** – `useLocalStorage` wraps `useState` so timer preferences persist across sessions in `localStorage`. Settings are typed via the shared `Settings` interface.
* **Timer schedule** – `buildSchedule(settings)` (from `timer.ts`) composes the warmup, work/rest rounds, and cooldown blocks. React keeps track of the current interval index, remaining seconds, and round number. A helper `getRoundForIndex` maps the index back to a round count.
* **Animation loop** – The timer runs through `requestAnimationFrame` and tracks elapsed time between frames. When the remaining time crosses 3, 2, or 1 seconds, audio "pips" play (unless muted). At zero the app switches intervals, updates colors, and plays the work/rest cues.
* **Wake lock & notifications** – `requestWakeLock` keeps the screen awake while the timer runs if enabled. Notifications fire when the workout finishes, subject to user permissions.【F:src/App.tsx†L160-L338】【F:src/timer.ts†L63-L140】
* **Responsive layout** – `useAutoFitDigits` measures the viewport and resizes the time display without overflowing. The JSX renders the timer card, start/pause/reset controls, fullscreen toggle, and the settings modal.
* **Settings modal** – `SettingsModal` lets users tweak rounds, durations, audio options, and power settings. Inputs are controlled, validated with `clamp`, and combined in an `MmSsInput` compound component for mm:ss fields.【F:src/App.tsx†L338-L456】

## Timer utilities (`src/timer.ts`)

This module groups pure utilities and browser APIs for timer behavior.【F:src/timer.ts†L1-L140】 Highlights:

* **Type definitions & defaults** – `IntervalDef` and `Settings` describe the shape of intervals and persisted settings. `DEFAULT_SETTINGS` seeds the UI.
* **Schedule builder** – `buildSchedule` composes an array of intervals based on the active settings, trimming the trailing rest interval for a clean finish.
* **Formatting helpers** – `formatMMSS` converts raw seconds to a `MM:SS` string for display.
* **Audio cues** – A lightweight Web Audio graph synthesizes digital-style beeps for countdowns, work/rest transitions, and the finish signal.【F:src/timer.ts†L42-L115】
* **Wake lock & notifications** – Functions wrap the browser Wake Lock API and Notifications API, handling vendor differences and permissions.【F:src/timer.ts†L117-L200】

`App.tsx` imports everything from here, keeping the components lean and the signal-generation logic in one place.

## Styling (`src/styles.css`)

The stylesheet defines the dark theme, flex/grid layout for the timer card, responsive sizing for the digits, and the modal appearance. CSS variables manage the color palette. Media queries adjust layout on tablets and phones to prevent horizontal overflow.【F:src/styles.css†L1-L205】【F:src/styles.css†L206-L273】

## How things fit together

1. `App` loads user settings from local storage or defaults and computes the interval schedule.
2. When the user presses Start, the app enters a `requestAnimationFrame` loop that decrements `remaining` seconds, playing audio cues as thresholds are crossed.
3. After each interval finishes, the index advances, color palette updates, and the next interval begins immediately. Completing the schedule triggers a finish notification and long tone.
4. Users can adjust settings mid-session via the modal. Structural changes rebuild the schedule and restart the timer so state stays in sync.

## Development workflow

* `npm run dev` – start Vite dev server with hot module replacement.
* `npm run build` – type-check and produce a production build in `dist/`.
* `npm run preview` – serve the production build locally.

## Next steps for newcomers

* **React hooks** – Review `useState`, `useMemo`, `useEffect`, and refs since the timer heavily relies on them for state and lifecycle control.
* **Browser APIs** – Explore MDN docs for the Wake Lock API, Notifications API, and Web Audio API to understand cross-browser constraints and permission flows.
* **Accessibility & responsiveness** – Investigate how the app uses screen-reader-only text (`sr-only` class) and responsive CSS to stay usable across devices. Consider adding keyboard shortcuts or ARIA enhancements as a learning exercise.
* **Testing opportunities** – Add unit tests for `buildSchedule` and timer math, or integration tests with React Testing Library to verify UI behavior when intervals advance.

With these foundations, you should be able to extend the timer (e.g., long rests, custom sound packs, progress charts) or refactor pieces into smaller components as the project grows.
