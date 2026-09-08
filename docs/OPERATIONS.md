# Operations

The game server is authoritative and currently assumes one running instance.
PostgreSQL is the durable source of room state. The migration in
`db/migrations/001_initial.sql` is applied automatically by the local Compose
`postgres` image on a new volume.

## Local database

```sh
npm run db:up
npm run db:down
```

Back up a running local database:

```sh
docker compose exec -T postgres pg_dump -U between_words between_words > between_words.sql
```

Restore into an empty database:

```sh
docker compose exec -T postgres psql -U between_words between_words < between_words.sql
```

Do not remove the named volume during routine upgrades. Production backups,
retention, and migration execution must be supplied by the selected provider.
