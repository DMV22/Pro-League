const origin = process.env.PLAYWRIGHT_BASE_URL
if (!/^https:\/\/pro-league-development-pr-[1-9]\d*\.onrender\.com$/.test(origin ?? ''))
  throw new Error('Explicit isolated Preview origin required')

module.exports = {
  ci: {
    collect: {
      url: [
        `${origin}/competitions/golden-cup`,
        `${origin}/competitions/golden-cup/seasons/2026-golden`,
      ],
      numberOfRuns: 3,
      settings: {
        chromeFlags: '--headless=new --no-sandbox',
        formFactor: 'mobile',
        onlyCategories: ['performance', 'accessibility', 'best-practices'],
        saveAssets: true,
      },
    },
    upload: { target: 'filesystem', outputDir: './artifacts/m3-cloud/routes' },
  },
}
