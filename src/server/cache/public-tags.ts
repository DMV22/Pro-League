// Versioned infrastructure registry; domain/application never import next/cache.
export const publicTags = {
  portal: () => 'public:v1:portal',
  competition: (id: string) => `public:v1:competition:${id}`,
  season: (id: string) => `public:v1:season:${id}`,
  schedule: (id: string) => `public:v1:season-schedule:${id}`,
  standings: (id: string) => `public:v1:season-standings:${id}`,
}
