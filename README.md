# Mess Meal

Mess Meal is a web app for managing meals and shared finances in hostels, bachelor messes, and shared apartments. Members can coordinate daily meal bookings while managers keep track of grocery spending, deposits, bills, and monthly balances.

## Features

- Google sign-in and shared mess workspaces, with manager and member roles
- Daily lunch and dinner bookings, guest counts, booking deadlines, and automatic booking preferences
- Meal attendance and kitchen order summaries
- Bazaar expense and member deposit ledgers
- Utility and shared bills with equal, fixed-per-member, or custom allocations
- Meal-rate, monthly summary, and member settlement calculations
- In-app bill notifications and an audit trail for important changes
- Light and dark themes, plus a sample demo workspace with a guided walkthrough

## Try the demo

Start the app and choose **Open Demo Mess & Walkthrough** on the sign-in screen. The demo uses sample data and stores changes in your browser's local storage; it does not require Google sign-in or write to Firestore.

## Getting started

### Requirements

- Node.js
- Bun (recommended; the repository includes `bun.lock`)

### Install and run

```bash
bun install
bun run dev
```

Open the local URL printed by Vite (by default, `http://localhost:3000`).

Alternatively, with npm:

```bash
npm install
npm run dev
```

## Firebase setup

Firebase is needed for Google sign-in and persistent, multi-member workspaces. The app reads its Firebase web-app settings from the root `firebase-applet-config.json` file.

1. Create a Firebase project and register a web app.
2. Enable Google as a sign-in provider in Firebase Authentication.
3. Create a Cloud Firestore database.
4. Configure `firebase-applet-config.json` with your Firebase web-app settings, including the Firestore database ID.
5. Deploy the security rules in `firestore.rules` to that Firestore database.

Use the demo mode if you just want to explore without connecting Firebase. Firebase client configuration is not a substitute for security rules; review and deploy the rules for the Firebase project you use.

## Available scripts

| Command | Description |
| --- | --- |
| `bun run dev` | Start the Vite development server on port 3000 |
| `bun run build` | Create a production build in `dist/` |
| `bun run preview` | Preview the production build locally |
| `bun run lint` | Run the TypeScript check (`tsc --noEmit`) |
| `bun run clean` | Remove generated build output |

Use `npm run <script>` instead if you installed dependencies with npm.

## Project structure

```text
src/
  components/       Shared UI and application screens
  context/          Mess workspace and theme state
  firebase/         Firebase client setup and error handling
  services/         Firestore and local demo data services
  types/            Application data types
  utils/            Meal, settlement, date, and walkthrough helpers
firestore.rules     Firestore access-control rules
firebase-applet-config.json
                    Firebase web-app configuration
```

## Tech stack

React, TypeScript, Vite, Tailwind CSS, Firebase Authentication, Cloud Firestore, and Recharts.
