# Testing

## Commands

```bash
npm run lint
npm run format:check
npm run typecheck
npm run test
npm run test:integration
npm run test:e2e
npm run build
```

## Current Coverage

Initial unit tests cover:

- Password strength validation
- TAT calculation behavior

## Required Expansion

Add integration tests for:

- Valid and invalid login
- Rate limiting
- Locked/archived/suspended users
- Admin-only routes
- Client ownership and IDOR checks
- Ticket creation and replies
- Attachment upload/download permissions
- Invalid file rejection
- Pagination

Add Playwright tests for:

- Admin setup/login
- Client login
- Job creation/view isolation
- Support ticket user/admin conversation
- Attachment flow
- Logout and expired session handling
