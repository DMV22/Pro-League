const externalBaseUrl = process.env.LHCI_BASE_URL
const baseUrl = externalBaseUrl ? new URL(externalBaseUrl).origin : 'http://127.0.0.1:3200'
const escapedBaseUrl = baseUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const isRenderServicePreview = /^pro-league-development-pr-\d+\.onrender\.com$/.test(
  new URL(baseUrl).hostname,
)
// Temporary #96 waiver for the provisional UI. Baseline and manual runs stay strict.
const performanceLevel =
  isRenderServicePreview && process.env.LHCI_PREVIEW_PERFORMANCE === 'diagnostic' ? 'warn' : 'error'

const collect = {
  url: [`${baseUrl}/`, `${baseUrl}/admin`],
  numberOfRuns: 3,
  settings: {
    chromeFlags: '--headless=new --no-sandbox',
    // Retain the actual measured navigations, not a second diagnostic run.
    ...(isRenderServicePreview && { saveAssets: true }),
  },
}

if (!externalBaseUrl) {
  collect.startServerCommand = 'pnpm start:lighthouse'
  collect.startServerReadyPattern = 'Ready'
  collect.startServerReadyTimeout = 120_000
}

module.exports = {
  ci: {
    collect,
    assert: {
      assertMatrix: [
        {
          matchingUrlPattern: `^${escapedBaseUrl}/$`,
          assertions: {
            'categories:performance': [
              performanceLevel,
              { aggregationMethod: 'median', minScore: 0.9 },
            ],
            'categories:accessibility': ['error', { aggregationMethod: 'median', minScore: 1 }],
            'categories:best-practices': ['error', { aggregationMethod: 'median', minScore: 0.9 }],
            'largest-contentful-paint': [
              performanceLevel,
              { aggregationMethod: 'median', maxNumericValue: 2500 },
            ],
            'cumulative-layout-shift': [
              'error',
              { aggregationMethod: 'median', maxNumericValue: 0.1 },
            ],
            'total-blocking-time': [
              performanceLevel,
              { aggregationMethod: 'median', maxNumericValue: 200 },
            ],
            // Render deliberately sets noindex on PR Previews, so crawlability is not applicable there.
            ...(!isRenderServicePreview && {
              'categories:seo': ['error', { aggregationMethod: 'median', minScore: 0.9 }],
            }),
          },
        },
        {
          matchingUrlPattern: `^${escapedBaseUrl}/admin$`,
          assertions: {
            'categories:performance': [
              performanceLevel,
              { aggregationMethod: 'median', minScore: 0.85 },
            ],
            'categories:accessibility': ['error', { aggregationMethod: 'median', minScore: 1 }],
            'categories:best-practices': ['error', { aggregationMethod: 'median', minScore: 0.9 }],
            'cumulative-layout-shift': [
              'error',
              { aggregationMethod: 'median', maxNumericValue: 0.1 },
            ],
          },
        },
      ],
    },
    upload: {
      target: 'filesystem',
      outputDir: './artifacts/lighthouse',
    },
  },
}
