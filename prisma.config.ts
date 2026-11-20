import { defineConfig, env } from 'prisma/config'

export default defineConfig({
  schema: './prisma/schema.prisma',
  migrations: {
    path: './prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // Prisma CLI schema operations need a session/direct connection, not the
    // Supabase transaction pooler used by the application at runtime.
    url: env('DIRECT_URL'),
  },
})
