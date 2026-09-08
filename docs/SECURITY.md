# Security boundary

- Online identity is an opaque guest session stored as a hashed token in
  PostgreSQL. The room code is only a locator; it is not authorization.
- Socket actions require the session cookie and room membership. Mutations are
  validated with Zod, serialized under a locked room transaction, and deduped
  by `(room, player, eventId)`.
- Public and self projections are allowlisted. Words, assignments, pair IDs,
  and voter-to-target ballots are not sent before results.
- HTTP mutations require the configured frontend origin. Discussion is limited
  per player; session and room creation are limited per source IP.
- The backend currently runs as one authoritative instance. In-memory rate
  limits and Socket.IO room broadcasts are not sufficient for horizontal
  scaling.

Production online play still requires a trusted same-origin session/ticket
boundary, a private PostgreSQL service, HTTPS, provider configuration, and a
real multi-browser smoke test. Do not treat a room code or client state as a
secret or authorization credential.
