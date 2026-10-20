import { createHmac, timingSafeEqual } from 'node:crypto'
import { readPreviewIdentity, type PreviewIdentity } from '../../src/server/db/preview-target'
import type { PreviewRecord } from './reconcile'

export const stateMarker = '<!-- proleague-preview:v1 -->'

export function createStateCodec(secret: string) {
  if (!/^[a-fA-F0-9]{64}$/.test(secret))
    throw new Error('PREVIEW_STATE_KEY requires 32 random bytes encoded as hex')
  const sign = (domain: string, value: string) =>
    createHmac('sha256', Buffer.from(secret, 'hex'))
      .update(`proleague-preview/${domain}\0${value}`)
      .digest('hex')
  function validate(record: PreviewRecord, pr: number) {
    if (
      record.pr !== pr ||
      !Number.isSafeInteger(pr) ||
      pr < 1 ||
      !/^[a-f0-9]{40}$/.test(record.sha) ||
      !Number.isFinite(Date.parse(record.expiresAt)) ||
      !['reserved', 'prepared', 'ready', 'cleaned'].includes(record.phase) ||
      Object.keys(record).some(
        (key) =>
          ![
            'pr',
            'sha',
            'expiresAt',
            'phase',
            'identity',
            'serviceId',
            'deployId',
            'migrationHash',
          ].includes(key),
      )
    )
      throw new Error('Invalid Preview ownership record')
    if (record.identity && readPreviewIdentity(JSON.stringify(record.identity)).pullRequest !== pr)
      throw new Error('Ownership binding differs from PR')
    if (record.serviceId && !/^srv-[a-z0-9]+$/.test(record.serviceId))
      throw new Error('Invalid service identity')
    if (record.deployId && !/^dep-[a-z0-9]+$/.test(record.deployId))
      throw new Error('Invalid deployment identity')
    if (record.migrationHash && !/^[a-f0-9]{64}$/.test(record.migrationHash))
      throw new Error('Invalid migration identity')
  }
  return {
    encode(record: PreviewRecord) {
      validate(record, record.pr)
      return `${stateMarker}\n\`\`\`json\n${JSON.stringify({ record, signature: sign('record/v1', JSON.stringify(record)) }, null, 2)}\n\`\`\``
    },
    decode(body: string, pr: number): PreviewRecord {
      if (
        body.length > 16_384 ||
        !body.startsWith(`${stateMarker}\n\`\`\`json\n`) ||
        !body.endsWith('\n```')
      )
        throw new Error('Invalid Preview ownership record')
      const { record, signature } = JSON.parse(
        body.slice(`${stateMarker}\n\`\`\`json\n`.length, -4),
      )
      validate(record, pr)
      const expected = sign('record/v1', JSON.stringify(record))
      if (
        typeof signature !== 'string' ||
        !/^[a-f0-9]{64}$/.test(signature) ||
        !timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
      )
        throw new Error('Preview ownership signature differs')
      return record
    },
    annotation(pr: number, expiresAt: string) {
      return {
        repository: 'DMV22/Pro-League',
        pull_request: String(pr),
        expires_at: expiresAt,
        signature: sign('branch/v1', `${pr}/${expiresAt}`),
      }
    },
    owns(annotation: Record<string, string>, pr: number, expiresAt: string) {
      return (
        annotation.repository === 'DMV22/Pro-League' &&
        annotation.pull_request === String(pr) &&
        annotation.expires_at === expiresAt &&
        annotation.signature === sign('branch/v1', `${pr}/${expiresAt}`)
      )
    },
    readerPassword(identity: PreviewIdentity) {
      readPreviewIdentity(JSON.stringify(identity))
      // Stable per branch incarnation; no plaintext credential in public state/artifacts.
      return createHmac('sha256', Buffer.from(secret, 'hex'))
        .update(
          `proleague-preview/reader/v1/${identity.projectId}/${identity.branchId}/${identity.pullRequest}`,
        )
        .digest('base64url')
    },
  }
}

export type StateCodec = ReturnType<typeof createStateCodec>
