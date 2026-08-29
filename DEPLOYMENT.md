# Deployment

## Environments

Use separate credentials and data for development, test, staging and production.

Required production variables:

- `NODE_ENV=production`
- `PORT`
- `CLIENT_URL`
- `JWT_SECRET`
- `JWT_ISSUER`
- `JWT_AUDIENCE`
- `ACCESS_TOKEN_TTL_SECONDS`
- `REFRESH_TOKEN_DAYS`
- `DATABASE_PATH`
- `UPLOAD_DIR`
- `MAX_UPLOAD_MB`
- `TRUST_PROXY`
- `LOG_LEVEL`

## Production Steps

```bash
npm ci
npm run migrate
npm run create-admin
npm run lint
npm run format:check
npm run typecheck
npm run test
npm run build
npm run start
```

## Rollback Guidance

1. Stop the current process.
2. Restore the previous application release.
3. Restore database and attachment backups if the migration changed persistent data.
4. Run `npm run migrate:status`.
5. Start the previous release and verify `/health/ready`.

## Hosting Notes

Use a Node.js web app deployment, not static hosting. Ensure `UPLOAD_DIR` persists across releases and is not publicly served.
