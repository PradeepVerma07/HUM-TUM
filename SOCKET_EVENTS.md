# Socket Events

Socket.IO connections must authenticate with the current access token:

```ts
io(API_URL || undefined, { auth: { token } });
```

Rejected connections:

- Missing token
- Invalid token
- Expired token
- Suspended account
- Archived account
- Locked account

## Rooms

- `admin`
- `user:<userId>`
- `client:<clientId>`
- `ticket:<ticketNumber>`
- `job:<jobId>`

## Server To Client

### `connected`

Emitted after successful authentication.

```json
{ "at": "2026-07-29T00:00:00.000Z" }
```

### `data:changed`

Emitted only to authorised rooms.

```json
{ "at": "2026-07-29T00:00:00.000Z" }
```

## Client To Server

No client-originated socket mutation events are currently supported. All writes go through authenticated HTTP APIs.
