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
  secret: process.env.PAYLOAD_SECRET || 'CHANGE-ME-IN-PRODUCTION',

  // ─── TypeScript ───────────────────────────────
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },

  // ─── Image Processing ─────────────────────────
  sharp,

  // ─── CORS (allow admin panel and existing frontend) ─
  cors: [
    'http://localhost:5173',   // panel-admin (Vite)
    'http://localhost:3000',   // api (Express)
    'http://localhost:4321',   // landing (Astro)
    'http://localhost:4322',   // panel-visitor (Astro)
  ],

  // ─── Upload Limits ────────────────────────────
  upload: {
    limits: {
      fileSize: 20 * 1024 * 1024, // 20MB
    },
  },
})
