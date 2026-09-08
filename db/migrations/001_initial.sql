create table if not exists guest_sessions (
  token_hash text primary key,
  player_id text not null unique,
  expires_at timestamptz not null
);
create table if not exists rooms (
  code char(6) primary key,
  host_id text not null,
  status text not null default 'LOBBY',
  revision bigint not null default 0,
  public_view jsonb not null default jsonb_build_object(
    'roomCode', '', 'hostId', '', 'phase', 'LOBBY', 'revision', 0,
    'players', jsonb_build_array(), 'clues', jsonb_build_array(),
    'discussion', jsonb_build_array(), 'deadline', null,
    'voting', null, 'earlyVoteRequest', null
  ),
  secret_state jsonb,
  expires_at timestamptz not null default now()+interval '2 hours'
);
create table if not exists memberships (
  room_code char(6) references rooms(code) on delete cascade,
  player_id text references guest_sessions(player_id) on delete cascade,
  display_name text not null,
  ready boolean not null default false,
  connected boolean not null default false,
  joined_at timestamptz not null default now(),
  primary key (room_code, player_id)
);
create unique index if not exists memberships_room_code_lower_name_key
  on memberships (room_code, lower(display_name));
create table if not exists action_receipts (
  room_code char(6) references rooms(code) on delete cascade,
  player_id text not null,
  event_id text not null,
  created_at timestamptz not null default now(),
  primary key (room_code, player_id, event_id)
);

alter table memberships add column if not exists last_seen_at timestamptz not null default now();
alter table rooms add column if not exists terminal_at timestamptz;
