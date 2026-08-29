# Security

## Administrator Setup

No administrator is created automatically. Run:

```bash
npm run create-admin
```

The command prompts for name, login ID/email and password confirmation, validates strength and stores only a bcrypt hash.

## Authentication

- Access tokens are short-lived JWTs with `sub`, `role`, `iat`, `exp`, `iss`, `aud` and `jti`.
- Refresh tokens are stored in HttpOnly cookies and hashed in `refresh_sessions`.
- Refresh rotation is enabled on `/api/auth/refresh`.
- Logout revokes the current refresh session.
- Logout-all revokes all refresh sessions for the user.

## Password Policy

- Minimum 12 characters.
- Maximum 128 characters.
- Requires lower, upper, number and symbol.
- Password confirmation is required for client creation and reset.

## Upload Security

- Attachments are uploaded with multipart form data.
- Files are stored under private `UPLOAD_DIR`, not the public web root.
- Metadata only is stored in SQLite.
- Allowed extensions: PDF, DOC, DOCX, JPG, JPEG, PNG, ZIP.
- Maximum size defaults to 10 MB.
- MIME/file signature validation and SHA-256 checksums are used.
- Downloads require backend authorisation.

## Required Production Hardening

Configure Redis-backed rate limiting before running multiple API instances. Configure ClamAV or an equivalent malware scanner for `scan_status` processing. Do not place `UPLOAD_DIR` under a static/public directory.
