# Backup And Recovery

## Scope

Back up both:

- SQLite database at `DATABASE_PATH`
- Private attachments under `UPLOAD_DIR`

## Recommended Procedure

1. Put the app in maintenance mode or stop writes.
2. Copy the SQLite database, WAL and SHM files if present.
3. Copy the full private upload directory.
4. Encrypt backups at rest.
5. Store backups outside the application server.
6. Verify the backup by restoring to a staging/test environment.

## Restore Steps

1. Stop the application.
2. Restore database files to `DATABASE_PATH`.
3. Restore attachment files to `UPLOAD_DIR`.
4. Run `npm run migrate:status`.
5. Start the application.
6. Verify `/health/ready`, login, ticket listing and authorised attachment download.

## Retention

Suggested baseline:

- Hourly backups for 24 hours.
- Daily backups for 30 days.
- Monthly backups for 12 months.

## RTO/RPO

Set formal targets with the business owner. A practical baseline for this app is:

- RTO: 4 hours.
- RPO: 1 hour.

## MySQL Note

If the app is migrated to MySQL, replace SQLite file copies with `mysqldump` or provider snapshots and keep attachment backups independent.
