import { mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { chromium, firefox, webkit } from '@playwright/test'

const { version } = createRequire(import.meta.url)('@playwright/test/package.json') as {
  version: string
}

export default async function collectVersions() {
  const browsers: Record<string, string> = {}
  // Record actual launchable engine versions, not just installed package names.
  for (const type of [chromium, firefox, webkit]) {
    const browser = await type.launch()
    try {
      browsers[type.name()] = browser.version()
    } finally {
      await browser.close()
    }
  }
  mkdirSync('artifacts/m3-browser', { recursive: true })
  writeFileSync(
    'artifacts/m3-browser/versions.json',
    JSON.stringify(
      {
        collectedAt: new Date().toISOString(),
        node: process.version,
        playwright: version,
        browsers,
      },
      null,
      2,
    ),
  )
}
