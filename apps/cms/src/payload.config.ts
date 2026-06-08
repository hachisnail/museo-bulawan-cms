import path from 'path'
import { fileURLToPath } from 'url'
import { buildConfig } from 'payload'
import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import sharp from 'sharp'

// Collections
import { Users } from './collections/Users'
import { Articles } from './collections/Articles'
import { Categories } from './collections/Categories'
import { Authors } from './collections/Authors'
import { Media } from './collections/Media'

import fs from 'fs'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

// Ensure the local data directory exists so SQLite doesn't crash on fresh pulls
const dataDir = path.resolve(process.cwd(), 'data')
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
}

// Parse allowed CORS origins from environment variables dynamically
const CORS_ORIGINS = [
  ...(process.env.PUBLIC_ADMIN_URL || '')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean),
  ...(process.env.PUBLIC_API_URL || '')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean),
  ...(process.env.PUBLIC_LANDING_URL || '')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean),
  ...(process.env.PUBLIC_VISITOR_URL || '')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean),
  ...(process.env.CORS_ORIGINS || '')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean),
  ...(process.env.PUBLIC_CORS_ORIGINS || '')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean),
].map(url => {
  if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
    // If it's a localhost URL, use http, otherwise use https
    if (url.startsWith('localhost') || url.startsWith('127.0.0.1')) {
      return `http://${url}`
    }
    return `https://${url}`
  }
  return url
})

if (CORS_ORIGINS.length === 0) {
  CORS_ORIGINS.push(
    'http://localhost:5173', // panel-admin (Vite)
    'http://localhost:3000', // api (Express)
    'http://localhost:4321', // landing (Astro)
    'http://localhost:4322'  // panel-visitor (Astro)
  )
}

export default buildConfig({
  admin: {
    user: Users.slug,
    meta: {
      titleSuffix: ' — Museo Bulawan',
      description: 'Museo Bulawan Content Management System',
    },
    importMap: {
      baseDir: path.resolve(dirname),
    },
    components: {
      providers: ['@/providers/RouteListenerProvider#RouteListenerProvider'],
    },
  },

  // ─── Collections ──────────────────────────────
  collections: [Users, Articles, Categories, Authors, Media],

  // ─── Rich Text Default ────────────────────────
  editor: lexicalEditor(),

  // ─── Database ─────────────────────────────────
  db: sqliteAdapter({
    client: {
      url: process.env.DATABASE_URI || 'file:./data/payload.db',
    },
  }),

  // ─── Security ─────────────────────────────────
  secret: (() => {
    if (!process.env.PAYLOAD_SECRET) {
      throw new Error(
        'FATAL: PAYLOAD_SECRET environment variable is not set. ' +
        'Create an apps/cms/.env file with a strong random PAYLOAD_SECRET value.'
      )
    }
    return process.env.PAYLOAD_SECRET
  })(),

  // ─── TypeScript ───────────────────────────────
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },

  // ─── Image Processing ─────────────────────────
  sharp: sharp as any,

  // ─── CORS (allow admin panel and existing frontend) ─
  cors: CORS_ORIGINS,

  // ─── GraphQL (disabled — REST API is used exclusively) ─
  graphQL: {
    disable: true,
  },

  // ─── Upload Limits ────────────────────────────
  upload: {
    limits: {
      fileSize: 20 * 1024 * 1024, // 20MB
    },
  },

  // ─── Seed default categories on first boot ────
  onInit: async (payload) => {
    const defaultCategories = [
      { name: 'Article', slug: 'article', description: 'General articles and publications' },
      { name: 'News', slug: 'news', description: 'Museum news and announcements' },
      { name: 'Event', slug: 'event', description: 'Upcoming and past museum events' },
    ]

    for (const cat of defaultCategories) {
      const existing = await payload.find({
        collection: 'categories',
        where: { slug: { equals: cat.slug } },
        limit: 1,
      })
      if (existing.docs.length === 0) {
        await payload.create({
          collection: 'categories',
          data: cat,
        })
        payload.logger.info(`Seeded default category: ${cat.name}`)
      }
    }
  },
})
