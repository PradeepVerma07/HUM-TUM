# API

All protected routes require an access token:

```http
Authorization: Bearer <access-token>
```

Refresh tokens are sent as HttpOnly cookies on `/api/auth/*`.

## Health

- `GET /health/live`
- `GET /health/ready`

## Auth

- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `POST /api/auth/logout-all`

## Dashboard

- `GET /api/bootstrap`

## Jobs

- `POST /api/jobs`
- `PATCH /api/jobs/:id` admin only

## Settings

- `PUT /api/settings` admin only

## Clients

- `POST /api/clients` admin only
- `PATCH /api/clients/:id` admin only

Client passwords require `password` and `confirmPassword`.

## Support Tickets

- `GET /api/support-tickets?page=1&limit=25&status=Open&priority=High&search=text&sort=updated_at&order=desc`
- `POST /api/support-tickets`
- `GET /api/support-tickets/:ticketNumber`
- `POST /api/support-tickets/:ticketNumber/replies`
- `PATCH /api/support-tickets/:ticketNumber` admin only
- `GET /api/support-tickets/:ticketNumber/attachments/:attachmentId`

Ticket creation uses multipart form data:

- `subject`
- `category`
- `priority`
- `description`
- `attachment` optional

Allowed attachments: PDF, DOC, DOCX, JPG, JPEG, PNG, ZIP.
