<<<<<<< HEAD
# NEXUS — Personal Productivity + Life OS

NEXUS is a personal productivity workspace built with React, TypeScript, Vite, Express, MongoDB and JWT authentication.

## Included in this release

- Authentication: account registration, sign-in, session restoration and sign-out.
- Account-scoped MongoDB persistence for tasks, projects, goals, habits, notes and completed focus sessions.
- Tasks: create/edit, status and priority filters, list/Kanban views, completion timestamps, and delete. Completed tasks leave the default active list but remain available in Completed/All tasks and Analytics.
- Projects: rename, mark complete/reopen, delete, and separate active from completed projects.
- Goals: update progress, rename, mark achieved, delete, and separate active goals from achieved history.
- Habits: add, rename and delete habits; weekly check-ins and streak tracking.
- Notes: edit content, favorite and delete.
- Focus timer: Focus, short break, long break and custom sessions. Completed focus sessions are saved to the signed-in user's account; session history can be deleted.
- Analytics: selectable 7-, 30- and 90-day windows, task completion trends, task distribution, recorded focus time, goal progress, habit consistency, and period summaries.
- Responsive layout, light/dark appearance, command palette and keyboard focus states.

## Requirements

- Node.js 20 or newer
- npm
- MongoDB running locally, or a MongoDB URI you control

## Setup

### 1. Backend

Open a terminal in `nexus-project/backend` and install dependencies:

```bash
npm install
```

Create `backend/.env` by copying `.env.example`. Make sure `MONGODB_URI` points to your MongoDB instance and replace `JWT_SECRET` with a long random secret (at least 32 characters).

Start the API:

```bash
npm run dev
```

The API runs at `http://localhost:4000`. Verify it at `http://localhost:4000/api/health`.

### 2. Frontend

Open a second terminal in `nexus-project/frontend`:

```bash
npm install
```

The included `.env` points the frontend to `http://localhost:4000/api`. If it is missing, create it with:

```env
VITE_API_BASE_URL=http://localhost:4000/api
```

Start Vite:

```bash
npm run dev
```

Open the local URL printed by Vite (normally `http://localhost:5173`). Keep both terminals running while developing.

## Build checks

From `frontend`:

```bash
npm run build
```

From `backend`:

```bash
npm run build
```

## Data and analytics notes

- Resource data is stored under the authenticated user's MongoDB ID. The API scopes reads, updates and deletes by that owner.
- Deleting a resource removes it from the active API list (the backend archives it); it is no longer shown in the app.
- Completed tasks remain in the account so totals and analytics remain meaningful. They are hidden from the default active-task list and can be viewed through the Completed or All tasks filters.
- Achieved goals and completed projects are hidden from their default active views and can be shown from the page controls.
- Habits are recurring, so checking off a day records consistency rather than permanently completing the habit. Delete a habit if you no longer want to track it.
- New task completion trends are based on the recorded completion timestamp. Older demo tasks without a timestamp count in overall totals but do not appear in a specific daily trend.
- Focus statistics count completed focus timer sessions. The timer must reach zero while the page is open for a session to be recorded; it is not a background timer.
- Habit consistency reflects the current 7-day check-in grid, not an unlimited historical calendar.
- UI preferences remain browser-local. Keep secrets out of frontend environment variables; only the API base URL belongs in the frontend `.env`.

## Project structure

```text
nexus-project/
├── backend/       # Express API, JWT auth, Mongoose models and routes
└── frontend/      # React + TypeScript + Vite application
    └── src/
        ├── App.tsx
        ├── data.ts
        ├── services/api.ts
        ├── styles.css
        └── types.ts
```

This is a local-development release. Before public production deployment, add deployment-specific CORS/origin settings, rate limiting, security review, automated tests, and a production-grade authentication/session strategy.
=======
# NEXUS
NEXUS — Personal Productivity and Life OS
>>>>>>> 64e85f2fdaa9b8d784f9ae47cedd3e8ac524b329
