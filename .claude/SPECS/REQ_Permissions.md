# REQ: Permissions & Auth

## v0: No Authentication
- Single-user local application
- No login, no roles, no access control
- All data accessible to anyone who can reach the dev server

## Future Considerations
- If deployed on a shared network, may need basic auth
- Role-based access (viewer vs admin for config changes) is a P2+ consideration
- Settings page could require an "admin" toggle
