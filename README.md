# CI360 Realtime Job Board

A production-oriented React + Express job-management app rebuilt from the supplied CI360 HTML demo.

## Features

- React + TypeScript frontend
- Express + TypeScript API
- SQLite database
- JWT authentication
- Admin and client roles
- Realtime updates using Socket.IO
- Shared jobs across users and devices
- Job submission, filtering, status updates and completion
- Configurable TAT categories, capacity, working days and working hours
- Client creation, archiving and password resets
- Audit log table
- Secure password hashing with bcrypt

## Demo accounts

- Admin: `ci360admin` / `CI360Demo#2026`
- Client: `acme` / `acme123`
- Client: `beta` / `beta123`

Change these passwords immediately for a real deployment.

## Run locally

Requirements: Node.js 20+

```bash
cd ci360-realtime-app
npm install
cp server/.env.example server/.env
npm run dev
```

Frontend: http://localhost:5173
API: http://localhost:4000

## Deploy to Hostinger with GitHub

Use Hostinger's **Node.js Web App** deployment, not the static Git deployment screen, because this project includes an Express API and Socket.IO server.

1. Push this folder to a GitHub repository.
2. In Hostinger hPanel, choose **Websites -> Add Website -> Node.js Web App -> Import Git Repository**.
3. Select the repository and branch.
4. Use these build settings:

```text
Package manager: npm
Node version: 20.x or 22.x
Install command: npm install
Build command: npm run build
Start command: npm run start
Output directory, if requested: server/dist
Entry file, if relative to the output directory: index.js
Entry file, if relative to the repository root: server/dist/index.js
```

5. Add environment variables in Hostinger:

```text
NODE_ENV=production
JWT_SECRET=<use a long random secret>
CLIENT_ORIGIN=https://your-domain.com
DATABASE_PATH=./data/ci360.db
```

The React app is built into `server/dist/public` and served by Express. Browser API calls use same-origin URLs by default, so no production `VITE_API_URL` is needed when the frontend and API are on the same Hostinger app.

For larger teams or important long-term records, replace SQLite with a hosted database before going live.

## Production Notes

1. Change the demo passwords immediately.
2. Set a long random `JWT_SECRET`.
3. Use HTTPS for the deployed domain.
4. Keep `.env` files and database files out of Git.
5. Run `npm run build` before pushing if you want to catch deployment errors locally.

## Realtime behaviour

Whenever a job, setting or client record changes, the server broadcasts a Socket.IO event. Logged-in users automatically reload the authorised data set, so admins and clients see changes without refreshing.
