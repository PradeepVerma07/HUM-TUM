# Production Readiness Changes

## Audit Findings

- Frontend framework: React 18 + Vite + TypeScript.
- Backend framework: Express 4 + TypeScript.
- Database: SQLite via `better-sqlite3`.
- Authentication before this pass: JWT bearer token with a hardcoded fallback secret and localStorage token persistence.
- Authentication after this pass: short-lived access token, HttpOnly refresh cookie, server-side refresh session table and token rotation.
- Socket.IO before this pass: unauthenticated global connections and broad refresh events.
- Socket.IO after this pass: authenticated handshake and role/client/user rooms.
- Attachment storage before this pass: support-ticket uploads used Base64 JSON stored in SQLite.
- Attachment storage after this pass: multipart upload, private local filesystem storage, checksum and metadata in SQLite.
- Existing roles: `admin`, `client`.
- Existing routes preserved: login, bootstrap, jobs, settings, clients, support tickets and attachment download.

The referenced ZIP file `ci360-realtime-app-20260729-132140.zip` was not present in the workspace. Changes were applied to the existing `ci360-realtime-app` folder.

## Security Changes

- Removed automatic fixed administrator/demo seeding from startup.
- Added `npm run create-admin` one-time secure administrator setup.
- Added `npm run seed:demo` as explicit development-only sample data creation.
- Added strict environment validation and rejected known placeholder JWT secrets.
- Removed default JWT secret fallback.
- Added issuer, audience, subject, expiry and JTI claims to access tokens.
- Added refresh-token rotation with hashed refresh tokens in `refresh_sessions`.
- Added HttpOnly refresh cookies.
- Moved browser access token persistence from localStorage to sessionStorage.
- Added login rate limiting and account failed-attempt lockout.
- Added password strength validation and password confirmation for client creation/reset.
- Revoked refresh sessions when a client password is reset.
- Added request IDs, Pino structured HTTP logging and selected security audit events.
- Added explicit Helmet security headers and strict CORS origin.
- Added authenticated Socket.IO handshakes and authorised rooms.
- Added private attachment storage and authorised download proxy.
- Added attachment extension, size, MIME/signature and checksum validation.
- Added `X-Content-Type-Options: nosniff` on attachment downloads.
- Added health checks and graceful shutdown.

## Database Changes

- Added guarded compatibility columns for user security state.
- Added `refresh_sessions`.
- Added support-ticket attachment metadata fields.
- Added indexes for users, jobs, tickets, messages, attachments, audit logs and refresh sessions.
- Added migration files under `migrations/`.
- Added migration commands:
  - `npm run migrate`
  - `npm run migrate:status`

## Tests And Tooling

- Added ESLint flat config.
- Added Prettier config.
- Added initial Vitest unit tests for password strength and TAT calculations.
- Added CI workflow skeleton.

## Remaining Limitations

- SQLite is preserved to avoid an unsafe database replacement. MySQL migration remains a future adapter project.
- Full refresh-token revocation dashboards and password-change-required UI are not complete.
- ClamAV, Redis, Google Drive/S3/R2 and SMTP integrations require real infrastructure credentials. Provider hooks are documented, but production should fail or be configured explicitly before enabling them.
- Integration and E2E test commands are wired, but only unit tests have meaningful coverage in this pass.
- Full pagination was added for support tickets; jobs, clients, candidates, audit logs and attachments still need endpoint-level pagination work.
- Optimistic locking/version fields remain future work.
- Existing legacy SQLite databases may still contain historical rows from old demo seeding; startup no longer creates them.
