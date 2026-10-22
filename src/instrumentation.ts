export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { registerPreviewBuild } = await import('./server/rendering/preview-startup')
    registerPreviewBuild()
  }
}
