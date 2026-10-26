import { createRequire } from 'node:module'
import { writeFileSync } from 'node:fs'
import { chromium } from '@playwright/test'

const require = createRequire(import.meta.url)
const browser = await chromium.launch({ headless: true })
try {
  writeFileSync(
    'artifacts/m3-cloud/versions.json',
    JSON.stringify(
      {
        collectedAt: new Date().toISOString(),
        node: process.version,
        playwright: require('@playwright/test/package.json').version,
        chromium: browser.version(),
      },
      null,
      2,
    ),
  )
} finally {
  await browser.close()
}
