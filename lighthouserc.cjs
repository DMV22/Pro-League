module.exports = {
  ci: {
    collect: {
      startServerCommand: 'pnpm start:lighthouse',
      startServerReadyPattern: 'Ready',
      startServerReadyTimeout: 120_000,
      url: ['http://127.0.0.1:3200/', 'http://127.0.0.1:3200/admin'],
      numberOfRuns: 3,
      settings: {
        chromeFlags: '--headless=new --no-sandbox',
      },
    },
    assert: {
      assertMatrix: [
        {
          matchingUrlPattern: '^http://127\\.0\\.0\\.1:3200/$',
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
          matchingUrlPattern: '^http://127\\.0\\.0\\.1:3200/admin$',
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
