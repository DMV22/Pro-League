'use client'

import dynamic from 'next/dynamic'

// Keep the SDK behind a client-side split point. Importing it dynamically
// from a Server Component can still add its scripts to the initial page.
export const LazyClerkControls = dynamic(() => import('./clerk-controls'))
