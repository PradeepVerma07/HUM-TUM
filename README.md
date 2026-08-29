# CI360 Realtime Job Board

React + TypeScript frontend, Express + TypeScript API, SQLite persistence, Socket.IO updates, client/admin roles, job management, client management and support tickets.

## Local Setup

```bash
npm install
copy server\.env.example server\.env
npm run migrate
npm run create-admin
npm run dev
```

Frontend: http://localhost:5173  
API: http://localhost:4000

## Production Setup

1. Set all required environment variables from `.env.example`.
2. Generate a 64-character random `JWT_SECRET`; do not reuse the sample value.
3. Run `npm ci`.
4. Run `npm run migrate`.
5. Run `npm run create-admin` once.
6. Run `npm run build`.
7. Start with `npm run start`.

Demo users are not created automatically. Development sample clients/jobs can only be created with:

```bash
npm run seed:demo
```

That command refuses to run when `NODE_ENV=production`.

## Commands

```bash
npm run dev
npm run build
npm run start
npm run migrate
npm run migrate:status
npm run create-admin
npm run seed:demo
npm run lint
npm run format:check
npm run typecheck
npm run test
npm run test:integration
npm run test:e2e
```

## Health Checks

- `GET /health/live`
- `GET /health/ready`

## Notes

The current database adapter is SQLite. The production checklist references MySQL fields; those are documented in `.env.example` for a future adapter migration, but this pass preserves the existing SQLite implementation.

Support ticket attachments are stored in private local storage under `UPLOAD_DIR`, with metadata in SQLite and authorised downloads through the backend.
