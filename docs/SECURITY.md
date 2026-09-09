# Security boundary

- Online identity is an opaque guest session stored as a hashed token in
  PostgreSQL. The room code is only a locator; it is not authorization.
- Browser HTTP session/room calls go same-origin through `apps/web`'s own
  `src/app/api/*` routes, never directly to `apps/game-server`. Those routes
  hold the guest session as a host-only `HttpOnly` cookie and forward it
  server-to-server, authenticated by a shared `INTERNAL_SERVICE_TOKEN` the
  browser never receives; `apps/game-server` rejects any HTTP mutation
  missing that token, regardless of origin.
- Socket actions require a single-use, ~60s-lived ticket (minted by a
  same-origin route, bound to player + room, consumed atomically on the
  handshake that spends it) instead of a cookie, plus room membership.
  Mutations are validated with Zod, serialized under a locked room
  transaction, and deduped by `(room, player, eventId)`.
- Public and self projections are allowlisted. Words, assignments, pair IDs,
  and voter-to-target ballots are not sent before results.
- HTTP mutations also require the configured frontend origin as
  defense-in-depth. Discussion is limited per player; session, room
  creation, and ticket minting are limited per source IP (forwarded via
  `x-forwarded-for` from the BFF, since the backend no longer sees the
  browser's real IP directly).
- The backend currently runs as one authoritative instance. In-memory rate
  limits, the ticket store, and Socket.IO room broadcasts are not sufficient
  for horizontal scaling — would need a shared store (e.g. Redis) first.

Verified locally against a real Postgres + game-server (not just
typechecked): the service-token gate actually rejects unauthenticated direct
backend access, and a minted ticket joins its room exactly once — reuse,
forgery, and a room-code mismatch are all rejected. Still open: a private
PostgreSQL service, HTTPS end-to-end in production, the actual Render/Vercel
provider configuration (the production deployment currently has no env vars
set at all), and a real multi-browser smoke test against the live stack. Do
not treat a room code or client state as a secret or authorization
credential.
