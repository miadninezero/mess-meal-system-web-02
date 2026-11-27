# Mess Meal

Mess Meal helps shared apartments, hostels, and bachelor messes coordinate meals and track shared expenses. Members book meals and record deposits; managers maintain the member list, meal service, bazaar expenses, bills, and monthly settlements.

## Features

- Google sign-in and shared workspaces with manager and member roles
- Lunch and dinner bookings, guest counts, booking deadlines, and optional auto-booking
- Meal attendance and kitchen order summaries
- Bazaar expense and deposit ledgers
- Utility bills and shared bills with equal, fixed-per-member, or custom allocations
- Monthly meal rates, balances, and member settlements
- Bill notifications, audit history, and monthly report exports
- Light and dark themes
- A sample demo workspace with a guided walkthrough

## Run the app locally

### Requirements

- Node.js 20.19+ or 22.12+
- npm (included with Node.js)

Bun is also supported; the repository includes a `bun.lock` file.

### Install dependencies and start the development server

From the project root, run:

```bash
npm install
npm run dev
```

Open the URL printed by Vite (normally <http://localhost:3000>). The development server listens on all network interfaces, so use the printed address if it differs.

To use Bun instead:

```bash
bun install
bun run dev
```

### Explore the demo

On the sign-in screen, choose **Open Demo Mess & Walkthrough**. The demo uses sample data saved in your browser's local storage. It does not require Google sign-in or save data to Firestore. Demo changes stay in that browser and can be cleared by clearing the site's local storage.

## Configure Firebase for shared workspaces

Firebase is required for Google sign-in and persistent data shared between users. The app imports its Firebase web app settings from `firebase-applet-config.json` at the project root; it does not load these values from `.env`.

1. Create a Firebase project and register a **Web app** in that project.
2. In **Authentication → Sign-in method**, enable **Google**.
3. In **Authentication → Settings → Authorized domains**, add the domain where the app will run. For local development, make sure `localhost` is listed.
4. Create or select a **Cloud Firestore** database. If it is not the default database, set `firestoreDatabaseId` to its ID.
5. Put the web app configuration in `firebase-applet-config.json`. Keep the property names used by the existing file, including `firestoreDatabaseId`.
6. Open **Firestore Database → Rules** in the Firebase console, paste the contents of [`firestore.rules`](firestore.rules), and publish them.
7. Start the app and sign in with Google. Create a mess or join one using its invite code.

The checked-in Firebase config identifies the project's web app; Firebase web API keys are intended to be present in client apps. Access control must come from correctly configured Authentication and Firestore security rules. Review the rules for your deployment before publishing them, and do not put service account credentials or other private keys in this client app.

## Commands

Run these from the project root:

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the Vite development server on port 3000 |
| `npm run build` | Create the production bundle in `dist/` |
| `npm run preview` | Serve the production bundle locally for a preview |
| `npm run lint` | Run the TypeScript compiler with no output (`tsc --noEmit`); this is not an ESLint run |
| `npm run clean` | Remove generated `dist/` and `server.js` files |

Use `bun run <command>` if you installed dependencies with Bun. To create and preview a production build:

```bash
npm run build
npm run preview
```

## Project layout

```text
src/
  components/       Shared UI and screens
  context/          Mess workspace and theme state
  firebase/         Firebase client setup and error handling
  services/         Firestore and local demo data services
  types/            Application data types
  utils/            Meal, settlement, date, and export helpers
firestore.rules     Firestore access-control rules
firebase-applet-config.json
                  Firebase web app configuration loaded by the client
```

## Tech stack

React, TypeScript, Vite, Tailwind CSS, Firebase Authentication, Cloud Firestore, and Recharts.
