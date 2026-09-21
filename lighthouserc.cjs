const externalBaseUrl = process.env.LHCI_BASE_URL
const baseUrl = externalBaseUrl ? new URL(externalBaseUrl).origin : 'http://127.0.0.1:3200'
const escapedBaseUrl = baseUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const collect = {
  url: [`${baseUrl}/`, `${baseUrl}/admin`],
  numberOfRuns: 3,
  settings: {
    chromeFlags: '--headless=new --no-sandbox',
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
            'categories:performance': ['error', { aggregationMethod: 'median', minScore: 0.9 }],
            'categories:accessibility': ['error', { aggregationMethod: 'median', minScore: 1 }],
            'categories:best-practices': ['error', { aggregationMethod: 'median', minScore: 0.9 }],
            'largest-contentful-paint': [
              'error',
              { aggregationMethod: 'median', maxNumericValue: 2500 },
            ],
            'cumulative-layout-shift': [
              'error',
              { aggregationMethod: 'median', maxNumericValue: 0.1 },
            ],
            'total-blocking-time': ['error', { aggregationMethod: 'median', maxNumericValue: 200 }],
            'categories:seo': ['error', { aggregationMethod: 'median', minScore: 0.9 }],
          },
        },
        {
          matchingUrlPattern: `^${escapedBaseUrl}/admin$`,
          assertions: {
            'categories:performance': ['error', { aggregationMethod: 'median', minScore: 0.85 }],
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
