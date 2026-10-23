# NEXUS Frontend

React + TypeScript + Vite interface for NEXUS, a personal productivity workspace.

## Features

- Login and registration connected to the Express API.
- Account-scoped backend sync for tasks, projects, goals, habits, notes and focus sessions.
- Active/completed task views; task edit, complete/reopen and delete actions.
- Project rename, complete/reopen and delete actions.
- Goal rename, progress changes, achievement and delete actions.
- Habit add, rename, weekly check-ins, streaks and delete actions.
- Editable/favoritable/deletable notes.
- Persistent completed focus-session history.
- Analytics with 7-, 30- and 90-day views, task trends, focus time, habit consistency, goal progress and summaries.
- Responsive light/dark workspace, calendar, command palette and settings.

## Run

Node.js 20+ and npm are required. Start the backend first (see `../backend/README.md`). Then:

```bash
npm install
npm run dev
```

Frontend environment file `.env`:

```env
VITE_API_BASE_URL=http://localhost:4000/api
```

## Build

```bash
npm run build
```

The app stores productivity records in MongoDB through the authenticated API; `localStorage` is used as a browser cache and for interface preferences. Completed tasks remain available for history/analytics while being hidden from the default active-task list. Focus sessions are recorded when the timer completes with the page open.
