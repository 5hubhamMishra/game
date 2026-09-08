# Between Words

## Local setup

```sh
npm run setup
```

For online mode, start PostgreSQL:

```sh
npm run db:up
```

## Development

```sh
npm run dev
npm run start -w apps/game-server
```

The web app is at `http://localhost:3000`; the game server is at
`http://localhost:8787`.

## Verification

```sh
npm run verify
```

Local Pass & Play works without Docker. Online mode requires PostgreSQL and
has not received a live multi-browser smoke test in this environment.

## Remaining external steps

- Provide PostgreSQL and `DATABASE_URL` for online deployment.
- Configure Vercel and the persistent backend with separate explicit
  preview/production origins before claiming online production readiness.
- Set Vercel's `NEXT_PUBLIC_GAME_SERVER_URL` to the configured backend URL.
