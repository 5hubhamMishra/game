import { createHash, randomBytes, randomInt } from 'node:crypto'
import { createServer } from 'node:http'
import { Pool } from 'pg'
import { Server } from 'socket.io'
import { pickPair } from '@bw/content'
import {
  DEFAULT_SETTINGS, MAX_PLAYERS, MIN_PLAYERS, abortGame, acceptEarlyVote, acknowledgeWord, activePlayers,
  advanceFromResolution, requestEarlyVote, secureRng, settleOverdue, startGame,
  isMinority, submitClue, submitVote, winningPlayers, wordFor, type EngineContext, type GameState,
} from '@bw/game-core'
import { discussionMessageSchema, publicRoomViewSchema, resultsViewSchema, selfViewSchema, socketActions, type DiscussionMessage, type ResultsView } from '@bw/contracts'

const port = Number(process.env.PORT ?? 8787)
const origin = process.env.FRONTEND_ORIGIN ?? 'http://localhost:3000'
const secureCookies = process.env.NODE_ENV === 'production' ? '; Secure' : ''
const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const MAX_ONLINE_PLAYERS = MAX_PLAYERS
const discussionPosts = new Map<string, number[]>()
const httpRequests = new Map<string, number[]>()

function token() { return randomBytes(32).toString('base64url') }
function hash(value: string) { return createHash('sha256').update(value).digest('hex') }
function roomCode() { return Array.from({ length: 6 }, () => alphabet[randomInt(alphabet.length)]).join('') }
function allowDiscussionPost(roomCode: string, playerId: string, now: number) {
  const key = `${roomCode}:${playerId}`
  const recent = (discussionPosts.get(key) ?? []).filter((timestamp) => timestamp > now - 10_000)
  if (recent.length >= 5) return false
  if (recent.length === 0) discussionPosts.delete(key)
  discussionPosts.set(key, [...recent, now])
  return true
}
function allowHttpRequest(ip: string, now: number, limit: number) {
  const recent = (httpRequests.get(ip) ?? []).filter((timestamp) => timestamp > now - 60_000)
  if (recent.length >= limit) return false
  if (recent.length === 0) httpRequests.delete(ip)
  httpRequests.set(ip, [...recent, now])
  return true
}
type SecretState = { game: GameState | null; discussion: DiscussionMessage[]; recentPairIds?: string[]; scores?: Record<string, number>; minorityCount?: number }
const emptySecret: SecretState = { game: null, discussion: [], recentPairIds: [], scores: {} }
function json(response: import('node:http').ServerResponse, status: number, body: unknown) {
  response.writeHead(status, {
    'access-control-allow-credentials': 'true',
    'access-control-allow-headers': 'content-type',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-origin': origin,
    'cache-control': 'no-store',
    'content-type': 'application/json',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
    vary: 'Origin',
  })
  response.end(JSON.stringify(body))
}
async function body(request: import('node:http').IncomingMessage) {
  const chunks: Buffer[] = []
  for await (const chunk of request) chunks.push(Buffer.from(chunk))
  if (Buffer.concat(chunks).length > 100_000) throw new Error('PAYLOAD_TOO_LARGE')
  return JSON.parse(Buffer.concat(chunks).toString() || '{}') as Record<string, unknown>
}
function cookies(request: import('node:http').IncomingMessage) {
  return Object.fromEntries((request.headers.cookie ?? '').split(';').filter(Boolean).map((part) => {
    const [key, ...value] = part.trim().split('='); return [key, value.join('=')]
  }))
}
function sessionFromHeaders(headers: import('node:http').IncomingHttpHeaders) {
  const raw = headers.cookie ?? ''
  const value = raw.split(';').map((part) => part.trim()).find((part) => part.startsWith('bw_session='))
  return value?.slice('bw_session='.length) || null
}
async function playerForSession(session: string | null) {
  if (!session) return null
  const result = await pool.query(
    'select player_id from guest_sessions where token_hash=$1 and expires_at>now()',
    [hash(session)],
  )
  return result.rows[0]?.player_id as string | undefined ?? null
}
async function roomView(roomCode: string) {
  const result = await pool.query('select public_view from rooms where code=$1 and expires_at>now()', [roomCode])
  if (!result.rows[0]) return null
  const members = await pool.query<{ id: string; name: string; ready: boolean; connected: boolean }>(
    'select player_id as id, display_name as name, ready, connected from memberships where room_code=$1 order by joined_at',
    [roomCode],
  )
  const view = publicRoomViewSchema.parse(result.rows[0].public_view)
  return {
    ...view,
    players: members.rows.map((member) => ({
      ...view.players.find((player) => player.id === member.id),
      id: member.id, name: member.name, ready: member.ready, connected: member.connected,
      eliminated: view.players.find((player) => player.id === member.id)?.eliminated ?? false,
    })),
  }
}
function publicView(code: string, hostId: string, revision: number, members: Array<{ id: string; name: string; ready: boolean; connected: boolean }>, secret: SecretState) {
  const game = secret.game
  const eliminated = new Set(game?.eliminated ?? [])
  return publicRoomViewSchema.parse({
    roomCode: code, hostId, phase: game?.phase ?? 'LOBBY', cycle: game?.cycle ?? null, maxCycles: game?.settings.maxCycles ?? DEFAULT_SETTINGS.maxCycles, revision, settings: { minorityCount: game?.settings.minorityCount ?? secret.minorityCount ?? 1 },
    players: members.map((member) => ({ ...member, eliminated: eliminated.has(member.id) })),
    clues: game?.clues ?? [], discussion: secret.discussion, deadline: game?.deadline ?? null,
    voting: game?.phase === 'VOTING' ? { round: game.votingRound, submitted: game.ballots.length, eligible: activePlayers(game).length } : null,
    earlyVoteRequest: game?.earlyVoteRequestedBy ?? null,
  })
}
function selfView(code: string, hostId: string, revision: number, members: Array<{ id: string; name: string; ready: boolean; connected: boolean }>, secret: SecretState, playerId: string, reveal = false) {
  const game = secret.game
  const revealPhases = new Set(['PRIVATE_REVEAL', 'CLUES', 'DISCUSSION', 'VOTING', 'RESOLUTION'])
  return selfViewSchema.parse({
    ...publicView(code, hostId, revision, members, secret),
    self: {
      playerId,
      acknowledged: game?.acknowledged.includes(playerId) ?? false,
      word: reveal && game && revealPhases.has(game.phase) && game.players.includes(playerId) ? wordFor(game, playerId) : null,
    },
  })
}
function terminalResults(code: string, revision: number, secret: SecretState): ResultsView | null {
  const game = secret.game
  if (!game || game.phase !== 'RESULTS' || !game.winner || !game.winReason) return null
  return resultsViewSchema.parse({
    roomCode: code, revision, phase: 'RESULTS', wordA: game.pair.wordA, wordB: game.pair.wordB,
    majorityWord: game.majorityWord,
    assignments: game.players.map((id) => ({ playerId: id, word: wordFor(game, id), group: isMinority(game, id) ? 'minority' : 'majority' })),
    tallies: game.tallies, winner: game.winner, reason: game.winReason,
    scores: Object.fromEntries(game.players.map((id) => [id, secret.scores?.[id] ?? 0])),
  })
}
async function lockedRoom(client: import('pg').PoolClient, code: string) {
  const room = await client.query<{ host_id: string; revision: string; secret_state: SecretState | null }>(
    'select host_id, revision, secret_state from rooms where code=$1 and expires_at>now() for update', [code],
  )
  if (!room.rows[0]) return null
  const members = await client.query<{ id: string; name: string; ready: boolean; connected: boolean }>(
    'select player_id as id, display_name as name, ready, connected from memberships where room_code=$1 order by joined_at', [code],
  )
  return { hostId: room.rows[0].host_id, revision: Number(room.rows[0].revision), secret: room.rows[0].secret_state ?? emptySecret, members: members.rows }
}
function applyGameAction(roomCode: string, action: string, playerId: string, payload: Record<string, unknown>, room: Awaited<ReturnType<typeof lockedRoom>>, ctx: EngineContext): SecretState {
  if (!room) throw new Error('ROOM_NOT_FOUND')
  const game = room.secret.game
  if (action === 'startGame') {
    if (playerId !== room.hostId) throw new Error('NOT_HOST')
    if (game && !['RESULTS', 'ABORTED'].includes(game.phase)) throw new Error('ALREADY_STARTED')
    if (room.members.length < MIN_PLAYERS || room.members.length > MAX_PLAYERS || room.members.some((member) => member.id !== room.hostId && !member.ready)) throw new Error('NOT_ALL_READY')
    const settings = { ...DEFAULT_SETTINGS, minorityCount: room.secret.minorityCount ?? 1 }
    const recentPairIds = room.secret.recentPairIds ?? []
    const pair = pickPair(ctx.rng, { difficulties: settings.difficulties, excludeIds: recentPairIds })
      ?? pickPair(ctx.rng, { difficulties: settings.difficulties })
    if (!pair) throw new Error('NO_PAIR_AVAILABLE')
    return { game: startGame(room.members.map((member) => member.id), settings, pair, ctx), discussion: [], recentPairIds: [...recentPairIds, pair.id].slice(-20), scores: room.secret.scores ?? {} }
  }
  if (action === 'cancelGame') {
    if (playerId !== room.hostId || !game) throw new Error('NOT_HOST')
    return { ...room.secret, game: abortGame(game) }
  }
  if (action === 'setSettings') {
    if (playerId !== room.hostId) throw new Error('NOT_HOST')
    if (game) throw new Error('ALREADY_STARTED')
    const minorityCount = Number(payload.minorityCount)
    if (!Number.isInteger(minorityCount) || minorityCount < 1 || minorityCount > Math.min(3, Math.floor((room.members.length - 1) / 2))) throw new Error('INVALID_MINORITY_COUNT')
    return { ...room.secret, minorityCount }
  }
  // requestRematch is handled by the caller before reaching this function
  // (it needs to gate on all members' ready flags, not just phase) — no
  // branch for it here.
  if (!game) throw new Error('WRONG_PHASE')
  switch (action) {
    case 'acknowledgeWord': return { ...room.secret, game: acknowledgeWord(game, playerId, ctx) }
    case 'submitClue': return { ...room.secret, game: submitClue(game, playerId, String(payload.text), ctx) }
    case 'requestEarlyVote': return { ...room.secret, game: requestEarlyVote(game, playerId) }
    case 'acceptEarlyVote': return { ...room.secret, game: acceptEarlyVote(game, playerId, ctx) }
    case 'submitVote': return { ...room.secret, game: submitVote(game, playerId, (payload.targetId as string | null) ?? null, ctx) }
    case 'continueFromResolution': return { ...room.secret, game: advanceFromResolution(game, ctx) }
    case 'postDiscussion': {
      if (game.phase !== 'DISCUSSION') throw new Error('WRONG_PHASE')
      // ponytail: process-local limiter; use shared rate limiting if multiplayer is scaled out.
      if (!allowDiscussionPost(roomCode, playerId, ctx.now)) throw new Error('RATE_LIMITED')
      const message = discussionMessageSchema.parse({ id: randomBytes(12).toString('hex'), playerId, text: payload.text, createdAt: ctx.now })
      return { ...room.secret, discussion: [...room.secret.discussion, message].slice(-200) }
    }
    default: throw new Error('NOT_SUPPORTED')
  }
}
async function settleOverdueRooms() {
  const client = await pool.connect()
  const broadcasts: unknown[] = []
  try {
    await client.query('begin')
    const due = await client.query<{ code: string }>(
      "select code from rooms where expires_at>now() and public_view->>'deadline' is not null and (public_view->>'deadline')::bigint <= $1 for update skip locked limit 20",
      [Date.now()],
    )
    for (const row of due.rows) {
      const room = await lockedRoom(client, row.code)
      if (!room?.secret.game) continue
      const ctx: EngineContext = { now: Date.now(), rng: secureRng() }
      const game = settleOverdue(room.secret.game, ctx)
      if (game === room.secret.game) continue
      const secret = { ...room.secret, game }
      const revision = room.revision + 1
      const view = publicView(row.code, room.hostId, revision, room.members, secret)
      await client.query("update rooms set revision=$1, status=$2, secret_state=$3, public_view=$4, terminal_at=case when $2 in ('RESULTS','ABORTED') and terminal_at is null then now() else terminal_at end where code=$5", [revision, view.phase, secret, view, row.code])
      broadcasts.push({ code: row.code, view })
    }
    await client.query('commit')
    for (const item of broadcasts as Array<{ code: string; view: unknown }>) io.to(item.code).emit('roomSnapshot', item.view)
  } catch {
    await client.query('rollback')
  } finally { client.release() }
}
async function purgeExpiredData() {
  await pool.query("delete from rooms where status in ('RESULTS','ABORTED') and terminal_at <= now()-interval '24 hours'")
  await pool.query('delete from guest_sessions where expires_at<=now()')
}
async function transferAbsentHosts() {
  const client = await pool.connect()
  const codes: string[] = []
  try {
    await client.query('begin')
    const rooms = await client.query<{ code: string }>(
      "select r.code from rooms r join memberships host on host.room_code=r.code and host.player_id=r.host_id where r.expires_at>now() and host.connected=false and host.last_seen_at<=now()-interval '30 seconds' for update of r skip locked limit 20",
    )
    for (const room of rooms.rows) {
      const candidate = await client.query<{ player_id: string }>(
        'select player_id from memberships where room_code=$1 and connected=true order by joined_at limit 1',
        [room.code],
      )
      if (!candidate.rows[0]) continue
      await client.query(
        "update rooms set host_id=$1, revision=revision+1, public_view=jsonb_set(public_view, '{hostId}', to_jsonb($1::text), false) where code=$2",
        [candidate.rows[0].player_id, room.code],
      )
      codes.push(room.code)
    }
    await client.query('commit')
    for (const code of codes) {
      const view = await roomView(code)
      if (view) io.to(code).emit('roomSnapshot', view)
    }
  } catch {
    await client.query('rollback')
  } finally { client.release() }
}

const http = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`)
    if (request.headers.origin && request.headers.origin !== origin) return json(response, 403, { code: 'ORIGIN_NOT_ALLOWED' })
    if (request.method === 'OPTIONS') return json(response, 204, null)
    const ip = request.socket.remoteAddress ?? 'unknown'
    if (request.method === 'POST' && (url.pathname === '/sessions' || url.pathname === '/rooms') && !allowHttpRequest(ip, Date.now(), 20)) {
      return json(response, 429, { code: 'RATE_LIMITED' })
    }
    if (request.method === 'GET' && url.pathname === '/health') {
      await pool.query('select 1')
      return json(response, 200, { ok: true })
    }
    if (request.method === 'POST' && url.pathname === '/sessions') {
      const session = token(); const playerId = randomBytes(16).toString('hex')
      await pool.query('insert into guest_sessions (token_hash, player_id, expires_at) values ($1,$2,now()+interval \'30 days\')', [hash(session), playerId])
      response.setHeader('set-cookie', `bw_session=${session}; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000${secureCookies}`)
      return json(response, 201, { playerId })
    }
    const match = url.pathname.match(/^\/rooms\/([A-Z2-9]{6})$/)
    if (request.method === 'POST' && url.pathname === '/rooms') {
      const data = await body(request); const name = typeof data.name === 'string' ? data.name.trim() : ''
      if (!name || name.length > 40) return json(response, 400, { code: 'INVALID_NAME' })
      const session = cookies(request).bw_session
      if (!session) return json(response, 401, { code: 'SESSION_REQUIRED' })
      const client = await pool.connect()
      try {
        await client.query('begin')
        const member = await client.query('select player_id from guest_sessions where token_hash=$1 and expires_at>now()', [hash(session)])
        if (!member.rows[0]) { await client.query('rollback'); return json(response, 401, { code: 'SESSION_EXPIRED' }) }
        let code = roomCode()
        for (let attempt = 0; attempt < 5; attempt++) {
          try {
            await client.query('insert into rooms (code, host_id, revision, public_view) values ($1,$2,0,$3)', [code, member.rows[0].player_id, {
              roomCode: code, hostId: member.rows[0].player_id, phase: 'LOBBY', cycle: null, maxCycles: DEFAULT_SETTINGS.maxCycles, revision: 0, settings: { minorityCount: 1 },
              players: [], clues: [], discussion: [], deadline: null, voting: null, earlyVoteRequest: null,
            }])
            break
          }
          catch (error) { if ((error as { code?: string }).code !== '23505' || attempt === 4) throw error; code = roomCode() }
        }
        await client.query('insert into memberships (room_code, player_id, display_name) values ($1,$2,$3)', [code, member.rows[0].player_id, name])
        await client.query('commit')
        return json(response, 201, { code })
      } catch (error) { await client.query('rollback'); throw error } finally { client.release() }
    }
    const joinMatch = url.pathname.match(/^\/rooms\/([A-Z2-9]{6})\/members$/)
    if (request.method === 'POST' && joinMatch) {
      const session = cookies(request).bw_session
      const playerId = await playerForSession(session)
      if (!playerId) return json(response, 401, { code: 'SESSION_REQUIRED' })
      const data = await body(request); const name = typeof data.name === 'string' ? data.name.trim() : ''
      if (!name || name.length > 40) return json(response, 400, { code: 'INVALID_NAME' })
      const client = await pool.connect()
      try {
        await client.query('begin')
        const room = await client.query(
          "select 1 from rooms where code=$1 and status='LOBBY' and expires_at>now() for update",
          [joinMatch[1]],
        )
        if (!room.rows[0]) { await client.query('rollback'); return json(response, 404, { code: 'ROOM_NOT_FOUND' }) }
        const existing = await client.query('select 1 from memberships where room_code=$1 and player_id=$2', [joinMatch[1], playerId])
        if (existing.rows[0]) { await client.query('commit'); return json(response, 200, { code: joinMatch[1] }) }
        const count = await client.query('select count(*)::int as count from memberships where room_code=$1', [joinMatch[1]])
        if (count.rows[0].count >= MAX_ONLINE_PLAYERS) { await client.query('rollback'); return json(response, 409, { code: 'ROOM_FULL' }) }
        await client.query('insert into memberships (room_code, player_id, display_name) values ($1,$2,$3)', [joinMatch[1], playerId, name])
        await client.query('commit')
        return json(response, 201, { code: joinMatch[1] })
      } catch (error) {
        await client.query('rollback')
        if ((error as { code?: string }).code === '23505') return json(response, 409, { code: 'NAME_TAKEN' })
        throw error
      } finally { client.release() }
    }
    if (request.method === 'GET' && match) {
      const view = await roomView(match[1]!)
      return view ? json(response, 200, view) : json(response, 404, { code: 'ROOM_NOT_FOUND' })
    }
    return json(response, 404, { code: 'NOT_FOUND' })
  } catch (error) {
    if (error instanceof Error && error.message === 'PAYLOAD_TOO_LARGE') return json(response, 413, { code: 'PAYLOAD_TOO_LARGE' })
    if (error instanceof SyntaxError) return json(response, 400, { code: 'INVALID_JSON' })
    json(response, 500, { code: 'SERVER_ERROR' })
  }
})

const io = new Server(http, { cors: { origin, credentials: true }, transports: ['websocket', 'polling'] })
io.use(async (socket, next) => {
  try {
    const playerId = await playerForSession(sessionFromHeaders(socket.handshake.headers))
    if (!playerId) return next(new Error('SESSION_REQUIRED'))
    socket.data.playerId = playerId
    next()
  } catch { next(new Error('SESSION_UNAVAILABLE')) }
})
io.on('connection', (socket) => {
  const playerId = socket.data.playerId as string
  socket.on('joinRoom', async (payload: unknown, acknowledge: (result: unknown) => void) => {
    const parsed = socketActions.joinRoom.safeParse(payload)
    if (!parsed.success) return acknowledge({ ok: false, code: 'INVALID_PAYLOAD' })
    const roomCode = parsed.data.roomCode
    socket.data.roomCode = roomCode
    const member = await pool.query(
      'select display_name from memberships where room_code=$1 and player_id=$2',
      [roomCode, playerId],
    )
    if (!member.rows[0]) return acknowledge({ ok: false, code: 'MEMBERSHIP_REQUIRED' })
    await socket.join(roomCode)
    await pool.query('update memberships set connected=true, last_seen_at=now() where room_code=$1 and player_id=$2', [roomCode, playerId])
    const view = await roomView(roomCode)
    acknowledge({ ok: true, room: view, self: null, playerId, name: member.rows[0].display_name })
    if (view) socket.to(roomCode).emit('roomSnapshot', view)
  })
  socket.on('setReady', async (payload: unknown, acknowledge: (result: unknown) => void) => {
    const parsed = socketActions.setReady.safeParse(payload)
    if (!parsed.success) return acknowledge({ ok: false, code: 'INVALID_PAYLOAD' })
    const roomCode = [...socket.rooms].find((room) => room !== socket.id)
    if (!roomCode) return acknowledge({ ok: false, code: 'ROOM_REQUIRED' })
    const client = await pool.connect()
      try {
        await client.query('begin')
        const roomState = await client.query<{ status: string }>('select status from rooms where code=$1 and expires_at>now() for update', [roomCode])
        if (!roomState.rows[0]) { await client.query('rollback'); return acknowledge({ ok: false, code: 'ROOM_NOT_FOUND' }) }
        if (roomState.rows[0].status !== 'LOBBY') { await client.query('rollback'); return acknowledge({ ok: false, code: 'WRONG_PHASE' }) }
        const receipt = await client.query('select 1 from action_receipts where room_code=$1 and player_id=$2 and event_id=$3', [roomCode, playerId, parsed.data.eventId])
      if (!receipt.rows[0]) {
        const updated = await client.query(
          'update memberships set ready=$1, last_seen_at=now() where room_code=$2 and player_id=$3 returning 1',
          [parsed.data.ready, roomCode, playerId],
        )
        if (!updated.rows[0]) { await client.query('rollback'); return acknowledge({ ok: false, code: 'MEMBERSHIP_REQUIRED' }) }
        await client.query('insert into action_receipts (room_code, player_id, event_id) values ($1,$2,$3)', [roomCode, playerId, parsed.data.eventId])
      }
      await client.query('commit')
      const view = await roomView(roomCode)
      acknowledge({ ok: true, room: view })
      if (view) io.to(roomCode).emit('roomSnapshot', view)
    } catch (error) {
      await client.query('rollback')
      acknowledge({ ok: false, code: 'SERVER_ERROR' })
      } finally { client.release() }
  })
  for (const action of Object.keys(socketActions).filter((name) => name !== 'joinRoom' && name !== 'setReady')) {
    socket.on(action, async (payload: unknown, acknowledge: (result: unknown) => void) => {
      const parsed = socketActions[action as keyof typeof socketActions].safeParse(payload)
      if (!parsed.success) return acknowledge({ ok: false, code: 'INVALID_PAYLOAD' })
      const roomCode = [...socket.rooms].find((room) => room !== socket.id)
      if (!roomCode) return acknowledge({ ok: false, code: 'ROOM_REQUIRED' })
      const client = await pool.connect()
      try {
        await client.query('begin')
        const room = await lockedRoom(client, roomCode)
        if (!room || !room.members.some((member) => member.id === playerId)) {
          await client.query('rollback'); return acknowledge({ ok: false, code: 'MEMBERSHIP_REQUIRED' })
        }
        if (action === 'removeMember') {
          const targetId = (parsed.data as { playerId?: string }).playerId
          if (playerId !== room.hostId) { await client.query('rollback'); return acknowledge({ ok: false, code: 'NOT_HOST' }) }
          if (room.secret.game || !targetId || targetId === room.hostId || !room.members.some((member) => member.id === targetId)) {
            await client.query('rollback'); return acknowledge({ ok: false, code: room.secret.game ? 'WRONG_PHASE' : 'INVALID_MEMBER' })
          }
          const members = room.members.filter((member) => member.id !== targetId)
          const revision = room.revision + 1
          const view = publicView(roomCode, room.hostId, revision, members, room.secret)
          await client.query('delete from memberships where room_code=$1 and player_id=$2', [roomCode, targetId])
          await client.query('update rooms set revision=$1, public_view=$2 where code=$3', [revision, view, roomCode])
          await client.query('insert into action_receipts (room_code, player_id, event_id) values ($1,$2,$3)', [roomCode, playerId, parsed.data.eventId])
          await client.query('commit')
          for (const peer of await io.in(roomCode).fetchSockets()) if (peer.data.playerId === targetId) { peer.emit('removedFromRoom'); peer.disconnect(true) }
          acknowledge({ ok: true, room: view })
          io.to(roomCode).emit('roomSnapshot', view)
          return
        }
        if (action === 'revealWord') {
          await client.query('commit')
          return acknowledge({ ok: true, room: publicView(roomCode, room.hostId, room.revision, room.members, room.secret), self: selfView(roomCode, room.hostId, room.revision, room.members, room.secret, playerId, true) })
        }
        if (action === 'getResults') {
          const results = terminalResults(roomCode, room.revision, room.secret)
          await client.query('commit')
          return results ? acknowledge({ ok: true, results }) : acknowledge({ ok: false, code: 'RESULTS_NOT_READY' })
        }
        const receipt = await client.query('select 1 from action_receipts where room_code=$1 and player_id=$2 and event_id=$3', [roomCode, playerId, parsed.data.eventId])
        if (receipt.rows[0]) {
          await client.query('commit')
          const snapshot = publicView(roomCode, room.hostId, room.revision, room.members, room.secret)
          return acknowledge({ ok: true, room: snapshot, results: terminalResults(roomCode, snapshot.revision, room.secret) })
        }
        if (parsed.data.expectedRevision !== undefined && parsed.data.expectedRevision !== room.revision) {
          await client.query('rollback'); return acknowledge({ ok: false, code: 'STALE_REVISION' })
        }
        const ctx: EngineContext = { now: Date.now(), rng: secureRng() }
        if (room.secret.game) room.secret = { ...room.secret, game: settleOverdue(room.secret.game, ctx) }
        let next: SecretState
        if (action === 'requestRematch') {
          if (!room.secret.game || !['RESULTS', 'ABORTED'].includes(room.secret.game.phase)) {
            await client.query('rollback'); return acknowledge({ ok: false, code: 'WRONG_PHASE' })
          }
          room.members = room.members.map((member) => member.id === playerId ? { ...member, ready: true } : member)
          await client.query('update memberships set ready=true, last_seen_at=now() where room_code=$1 and player_id=$2', [roomCode, playerId])
          next = room.members.every((member) => member.ready)
            ? { ...emptySecret, recentPairIds: room.secret.recentPairIds ?? [], scores: room.secret.scores ?? {} }
            : room.secret
        } else {
          next = applyGameAction(roomCode, action, playerId, parsed.data, room, ctx)
        }
        if (next.game?.phase === 'RESULTS' && room.secret.game?.phase !== 'RESULTS') {
          const scores = { ...(room.secret.scores ?? {}) }
          for (const id of winningPlayers(next.game)) scores[id] = (scores[id] ?? 0) + 1
          next = { ...next, scores }
          room.members = room.members.map((member) => ({ ...member, ready: false }))
          await client.query('update memberships set ready=false where room_code=$1', [roomCode])
        }
        const revision = room.revision + 1
        const view = publicView(roomCode, room.hostId, revision, room.members, next)
        await client.query("update rooms set revision=$1, status=$2, secret_state=$3, public_view=$4, terminal_at=case when $2 in ('RESULTS','ABORTED') and terminal_at is null then now() else terminal_at end where code=$5", [revision, view.phase, next, view, roomCode])
        await client.query('insert into action_receipts (room_code, player_id, event_id) values ($1,$2,$3)', [roomCode, playerId, parsed.data.eventId])
        await client.query('commit')
        const results = terminalResults(roomCode, revision, next)
        acknowledge({ ok: true, room: view, results })
        io.to(roomCode).emit('roomSnapshot', view)
        if (results) io.to(roomCode).emit('roomResults', results)
      } catch (error) {
        await client.query('rollback')
        acknowledge({ ok: false, code: error instanceof Error ? error.message : 'SERVER_ERROR' })
      } finally { client.release() }
    })
  }
  socket.on('disconnect', async () => {
    const roomCode = socket.data.roomCode
    if (!roomCode) return
    const stillConnected = (await io.in(roomCode).fetchSockets()).some((peer) => peer.data.playerId === playerId)
    if (stillConnected) return
    await pool.query('update memberships set connected=false, last_seen_at=now() where room_code=$1 and player_id=$2', [roomCode, playerId])
    await pool.query(
      "update rooms set expires_at=least(expires_at, now()+interval '10 minutes') where code=$1 and status not in ('LOBBY','RESULTS','ABORTED') and not exists (select 1 from memberships where room_code=$1 and connected=true)",
      [roomCode],
    )
    const view = await roomView(roomCode)
    if (view) io.to(roomCode).emit('roomSnapshot', view)
  })
})

if (process.argv[1]?.endsWith('index.ts') || process.argv[1]?.endsWith('index.js')) {
  http.listen(port, () => console.log(`game-server listening on ${port}`))
  const recoveryTimer = setInterval(() => void settleOverdueRooms(), 1000)
  const hostTimer = setInterval(() => void transferAbsentHosts(), 1000)
  const purgeTimer = setInterval(() => void purgeExpiredData().catch(() => undefined), 60_000)
  recoveryTimer.unref()
  hostTimer.unref()
  purgeTimer.unref()
  process.on('SIGTERM', () => { clearInterval(recoveryTimer); clearInterval(hostTimer); clearInterval(purgeTimer); io.close(); void pool.end().finally(() => http.close()) })
}
