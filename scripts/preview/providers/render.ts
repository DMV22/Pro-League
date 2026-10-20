import { absent, type JsonClient } from '../http'
import {
  assertPreviewDatabaseUrl,
  readPreviewIdentity,
  type PreviewIdentity,
} from '../../../src/server/db/preview-target'

type Service = {
  id: string
  name: string
  ownerId: string
  branch: string
  repo: string
  serviceDetails: { url: string; parentServer?: { id: string } }
}
type Deploy = { id: string; status: string; commit?: { id: string } }
const origin = (pr: number) => `https://pro-league-development-pr-${pr}.onrender.com`
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export function createRender(
  client: JsonClient,
  config: { baseServiceId: string; ownerId: string },
  sleep = pause,
) {
  async function service(id: string, pr: number, branch: string) {
    const value = await client.get<Service>(`/services/${encodeURIComponent(id)}`)
    if (
      value.id !== id ||
      id === config.baseServiceId ||
      value.ownerId !== config.ownerId ||
      value.name !== `pro-league-development PR #${pr}` ||
      value.repo.replace(/\.git$/, '') !== 'https://github.com/DMV22/Pro-League' ||
      value.branch !== branch ||
      value.serviceDetails.url !== origin(pr) ||
      value.serviceDetails.parentServer?.id !== config.baseServiceId
    )
      throw new Error('Render identity differs; never mutate this service')
    return value
  }
  async function variable(id: string, key: string) {
    try {
      return (await client.get<{ value: string }>(`/services/${id}/env-vars/${key}`)).value
    } catch (error) {
      if (!absent(error)) throw error
      return undefined
    }
  }
  async function find(pr: number, branch: string) {
    let cursor = ''
    for (let page = 0; page < 50; page++) {
      const rows = await client.get<{ service: Service; cursor: string }[]>(
        `/services?ownerId=${encodeURIComponent(config.ownerId)}&includePreviews=true&limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`,
      )
      const matches = rows.filter((row) => row.service.name === `pro-league-development PR #${pr}`)
      if (matches.length > 1) throw new Error('Ambiguous Render Preview')
      if (matches[0]) return service(matches[0].service.id, pr, branch)
      if (rows.length < 100) return undefined
      const next = rows.at(-1)!.cursor
      if (!next || next === cursor) throw new Error('Render pagination stalled')
      cursor = next
    }
    throw new Error('Render pagination limit reached')
  }
  return {
    service,
    find,
    async unknownPreviews(known: Set<string>) {
      const unknown: string[] = []
      let cursor = ''
      for (let page = 0; page < 50; page++) {
        const rows = await client.get<{ service: Service; cursor: string }[]>(
          `/services?ownerId=${encodeURIComponent(config.ownerId)}&includePreviews=true&limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`,
        )
        unknown.push(
          ...rows
            .filter(
              ({ service }) =>
                service.serviceDetails.parentServer?.id === config.baseServiceId &&
                !known.has(service.id),
            )
            .map(({ service }) => service.id),
        )
        if (rows.length < 100) return unknown
        const next = rows.at(-1)!.cursor
        if (!next || next === cursor) throw new Error('Render pagination stalled')
        cursor = next
      }
      throw new Error('Render pagination limit reached')
    },
    async base() {
      const base = await client.get<Service>(`/services/${config.baseServiceId}`)
      if (
        base.id !== config.baseServiceId ||
        base.ownerId !== config.ownerId ||
        base.name !== 'pro-league-development' ||
        base.branch !== 'develop' ||
        base.serviceDetails.url !== 'https://pro-league-development.onrender.com' ||
        base.serviceDetails.parentServer ||
        base.repo.replace(/\.git$/, '') !== 'https://github.com/DMV22/Pro-League'
      )
        throw new Error('Base Render service differs')
      if (
        (await variable(base.id, 'DATABASE_URL')) ||
        (await variable(base.id, 'PREVIEW_DATABASE_IDENTITY'))
      )
        throw new Error('Base service must not supply shared database credentials to Previews')
    },
    async waitForService(pr: number, branch: string) {
      for (let attempt = 0; attempt < 30; attempt++) {
        const found = await find(pr, branch)
        if (found) return found
        await sleep(10_000)
      }
      throw new Error('Render Preview did not appear')
    },
    async bindAndDeploy(
      id: string,
      branch: string,
      identity: PreviewIdentity,
      databaseUrl: string,
      sha: string,
    ) {
      await service(id, identity.pullRequest, branch)
      assertPreviewDatabaseUrl(databaseUrl, identity, 'runtime')
      if (!/^[a-f0-9]{40}$/.test(sha)) throw new Error('Invalid deployment revision')
      const previousUrl = await variable(id, 'DATABASE_URL')
      if (previousUrl) assertPreviewDatabaseUrl(previousUrl, identity, 'runtime')
      const previousIdentity = await variable(id, 'PREVIEW_DATABASE_IDENTITY')
      if (
        previousIdentity &&
        JSON.stringify(readPreviewIdentity(previousIdentity)) !== JSON.stringify(identity)
      )
        throw new Error('Inherited Render binding differs')
      await client.patch(`/services/${id}`, { autoDeployTrigger: 'off' })
      await client.put(`/services/${id}/env-vars/DATABASE_URL`, { value: databaseUrl })
      await client.put(`/services/${id}/env-vars/PREVIEW_DATABASE_IDENTITY`, {
        value: JSON.stringify(identity),
      })
      const deploy = await client.post<Deploy>(`/services/${id}/deploys`, {
        commitId: sha,
        clearCache: 'do_not_clear',
      })
      if (!/^dep-[a-z0-9]+$/.test(deploy.id)) throw new Error('Deployment identity missing')
      return { serviceId: id, deployId: deploy.id }
    },
    async live(id: string, deployId: string, pr: number, branch: string, sha: string) {
      await service(id, pr, branch)
      for (let attempt = 0; attempt < 90; attempt++) {
        const deploy = await client.get<Deploy>(`/services/${id}/deploys/${deployId}`)
        if (deploy.commit?.id !== sha) throw new Error('Render deployed a different commit')
        if (deploy.status === 'live') return
        if (
          ![
            'created',
            'queued',
            'build_in_progress',
            'update_in_progress',
            'pre_deploy_in_progress',
          ].includes(deploy.status)
        )
          throw new Error('Render deployment failed')
        await sleep(10_000)
      }
      throw new Error('Render readiness timeout')
    },
    async remove(id: string, pr: number, branch: string) {
      try {
        await service(id, pr, branch)
      } catch (error) {
        if (absent(error)) return
        throw error
      }
      await client.delete(`/services/${id}`)
      try {
        await client.get(`/services/${id}`)
      } catch (error) {
        if (absent(error)) return
        throw error
      }
      throw new Error('Render removal not yet confirmed')
    },
  }
}
