import { spawn, type ChildProcess } from 'node:child_process'
import { createServer, connect, type Socket } from 'node:net'
import { once } from 'node:events'
import pg from 'pg'

/** Isolated fault injection outside the app: no test HTTP route or production bypass. */
export async function startPublicCacheServer(url: string) {
  const parsed = new URL(url)
  if (
    !['postgres:', 'postgresql:'].includes(parsed.protocol) ||
    !['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname) ||
    !['proleague_public_cache_local', 'proleague_public_cache_ci'].includes(
      decodeURIComponent(parsed.pathname.slice(1)),
    ) ||
    parsed.search ||
    parsed.hash
  )
    throw new Error(
      'Cache browser tests require a dedicated loopback public-cache test database, never Golden/application/production data',
    )
  const fixtures = new pg.Client({ connectionString: url })
  await fixtures.connect()
  const competitionId = '01990000-0000-7000-8000-000000009411'
  const seasonId = '01990000-0000-7000-8000-000000009413'
  await fixtures.query('BEGIN')
  try {
    await fixtures.query(
      "insert into app.competitions(id,display_name,visibility) values($1,'Кеш-тест (синтетичний)','public') on conflict(id) do nothing",
      [competitionId],
    )
    await fixtures.query(
      "insert into app.competition_slugs(id,competition_id,display_slug,normalized_slug,valid_from_at) values('01990000-0000-7000-8000-000000009412',$1,'cache-browser-cup','cache-browser-cup',now()) on conflict(id) do nothing",
      [competitionId],
    )
    await fixtures.query(
      "update app.competitions set display_name='Кеш-тест (синтетичний)',visibility='public',current_slug_id='01990000-0000-7000-8000-000000009412' where id=$1",
      [competitionId],
    )
    await fixtures.query(
      "insert into app.seasons(id,competition_id,name,timezone,visibility) values($1,$2,'Кеш-сезон (синтетичний)','Europe/Kyiv','public') on conflict(id) do nothing",
      [seasonId, competitionId],
    )
    await fixtures.query(
      "insert into app.season_slugs(id,competition_id,season_id,display_slug,normalized_slug,valid_from_at) values('01990000-0000-7000-8000-000000009414',$1,$2,'cache-browser-season','cache-browser-season',now()) on conflict(id) do nothing",
      [competitionId, seasonId],
    )
    await fixtures.query(
      "update app.seasons set visibility='public',current_slug_id='01990000-0000-7000-8000-000000009414' where id=$1",
      [seasonId],
    )
    await fixtures.query('COMMIT')
  } catch (error) {
    await fixtures.query('ROLLBACK')
    await fixtures.end()
    throw error
  }

  let online = true
  const upstreamHost = parsed.hostname
  const upstreamPort = Number(parsed.port || 5432)
  const sockets = new Set<Socket>()
  const proxy = createServer((client) => {
    if (!online) {
      client.destroy()
      return
    }
    const upstream = connect({ host: upstreamHost, port: upstreamPort })
    for (const socket of [client, upstream]) {
      sockets.add(socket)
      socket.on('error', () => {
        client.destroy()
        upstream.destroy()
      })
      socket.on('close', () => {
        sockets.delete(socket)
        client.destroy()
        upstream.destroy()
      })
    }
    client.pipe(upstream)
    upstream.pipe(client)
  })
  proxy.listen(0, '127.0.0.1')
  await once(proxy, 'listening')
  const proxyAddress = proxy.address()
  if (!proxyAddress || typeof proxyAddress === 'string') throw new Error('No proxy port')
  const appPortReservation = createServer()
  appPortReservation.listen(0, '127.0.0.1')
  await once(appPortReservation, 'listening')
  const appAddress = appPortReservation.address()
  if (!appAddress || typeof appAddress === 'string') throw new Error('No app port')
  const port = appAddress.port
  await new Promise<void>((resolve, reject) =>
    appPortReservation.close((error) => (error ? reject(error) : resolve())),
  )
  parsed.hostname = '127.0.0.1'
  parsed.port = String(proxyAddress.port)
  let child: ChildProcess | undefined
  let logs = ''
  const start = () => {
    child = spawn(
      process.execPath,
      [
        'node_modules/next/dist/bin/next',
        'start',
        '--hostname',
        '127.0.0.1',
        '--port',
        String(port),
      ],
      {
        env: { ...process.env, DATABASE_URL: parsed.toString() },
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    )
    for (const stream of [child.stdout, child.stderr])
      stream?.on('data', (chunk) => {
        logs = (logs + String(chunk)).slice(-8_000)
      })
  }
  const stop = async () => {
    if (child && child.exitCode === null) {
      const exited = once(child, 'exit')
      child.kill()
      await exited
    }
    child = undefined
  }
  start()
  return {
    baseURL: `http://127.0.0.1:${port}`,
    competitionPath: '/competitions/cache-browser-cup',
    seasonPath: '/competitions/cache-browser-cup/seasons/cache-browser-season',
    logs: () => logs,
    offline() {
      online = false
      for (const socket of sockets) socket.destroy()
    },
    online() {
      online = true
    },
    async rename() {
      await fixtures.query(
        "update app.competitions set display_name='Оновлений кеш-тест (синтетичний)' where id=$1",
        [competitionId],
      )
    },
    async hide() {
      await fixtures.query("update app.competitions set visibility='private' where id=$1", [
        competitionId,
      ])
    },
    async restart() {
      await stop()
      start()
    },
    async close() {
      await stop()
      for (const socket of sockets) socket.destroy()
      await new Promise<void>((resolve, reject) =>
        proxy.close((error) => (error ? reject(error) : resolve())),
      )
      try {
        await fixtures.query("update app.competitions set visibility='private' where id=$1", [
          competitionId,
        ])
        await fixtures.query("update app.seasons set visibility='private' where id=$1", [seasonId])
      } finally {
        await fixtures.end()
      }
    },
  }
}
