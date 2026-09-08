import { createHash, randomBytes, randomInt } from 'node:crypto'
import { createServer } from 'node:http'
import { Pool } from 'pg'
import { Server } from 'socket.io'
import { publicRoomViewSchema, socketActions } from '@bw/contracts'

const port = Number(process.env.PORT ?? 8787)
const origin = process.env.FRONTEND_ORIGIN ?? 'http://localhost:3000'
const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function token() { return randomBytes(32).toString('base64url') }
function hash(value: string) { return createHash('sha256').update(value).digest('hex') }
function roomCode() { return Array.from({ length: 6 }, () => alphabet[randomInt(alphabet.length)]).join('') }
function json(response: import('node:http').ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' })
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

const http = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`)
    if (request.method === 'GET' && url.pathname === '/health') {
      await pool.query('select 1')
      return json(response, 200, { ok: true })
    }
    if (request.method === 'POST' && url.pathname === '/sessions') {
      const session = token(); const playerId = randomBytes(16).toString('hex')
      await pool.query('insert into guest_sessions (token_hash, player_id, expires_at) values ($1,$2,now()+interval \'30 days\')', [hash(session), playerId])
      response.setHeader('set-cookie', `bw_session=${session}; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000`)
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
              roomCode: code, hostId: member.rows[0].player_id, phase: 'LOBBY', revision: 0,
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
    if (request.method === 'GET' && match) {
      const result = await pool.query('select public_view from rooms where code=$1 and expires_at>now()', [match[1]])
      return result.rows[0] ? json(response, 200, publicRoomViewSchema.parse(result.rows[0].public_view)) : json(response, 404, { code: 'ROOM_NOT_FOUND' })
    }
    return json(response, 404, { code: 'NOT_FOUND' })
  } catch (error) { json(response, error instanceof Error && error.message === 'PAYLOAD_TOO_LARGE' ? 413 : 500, { code: 'SERVER_ERROR' }) }
})

const io = new Server(http, { cors: { origin, credentials: true }, transports: ['websocket', 'polling'] })
io.on('connection', (socket) => {
  socket.on('joinRoom', async (payload: unknown, acknowledge: (result: unknown) => void) => {
    const parsed = socketActions.setReady.safeParse(payload)
    if (!parsed.success) return acknowledge({ ok: false, code: 'INVALID_PAYLOAD' })
    acknowledge({ ok: false, code: 'NOT_IMPLEMENTED', message: 'Use the room HTTP endpoint until membership tickets are enabled.' })
  })
})

if (process.argv[1]?.endsWith('index.ts') || process.argv[1]?.endsWith('index.js')) {
  http.listen(port, () => console.log(`game-server listening on ${port}`))
  process.on('SIGTERM', () => { io.close(); void pool.end().finally(() => http.close()) })
}
