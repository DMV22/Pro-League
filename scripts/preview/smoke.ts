import { verifyPublicPreview } from './readiness'

await verifyPublicPreview(process.env.PREVIEW_ORIGIN ?? '', Number(process.env.PREVIEW_PR))
console.info('Preview desktop/mobile server-HTML and noindex smoke passed')
