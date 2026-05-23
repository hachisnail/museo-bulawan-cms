import type { CollectionConfig } from 'payload'
import {
  lexicalEditor,
  BlocksFeature,
} from '@payloadcms/richtext-lexical'

/**
 * Custom block: Artifact Highlight
 * Allows article authors to embed a styled museum artifact card inside articles.
 */
const ArtifactHighlightBlock = {
  slug: 'artifactHighlight',
  labels: {
    singular: 'Artifact Highlight',
    plural: 'Artifact Highlights',
  },
  fields: [
    {
      name: 'catalogNumber',
      type: 'text' as const,
      required: true,
      label: 'Catalog Number',
      admin: {
        description: 'e.g., CAT-2026-00042',
      },
    },
    {
      name: 'artifactName',
      type: 'text' as const,
      required: true,
      label: 'Artifact Name',
    },
    {
      name: 'description',
      type: 'textarea' as const,
      label: 'Brief Description',
    },
    {
      name: 'image',
      type: 'upload' as const,
      relationTo: 'media',
      label: 'Artifact Image',
    },
  ],
}

/**
 * Custom block: Call to Action
 * A styled banner with a heading, text, and link button.
 */
const CallToActionBlock = {
  slug: 'callToAction',
  labels: {
    singular: 'Call to Action',
    plural: 'Calls to Action',
  },
  fields: [
    {
      name: 'heading',
      type: 'text' as const,
      required: true,
      label: 'Heading',
    },
    {
      name: 'text',
      type: 'textarea' as const,
      label: 'Body Text',
    },
    {
      name: 'linkLabel',
      type: 'text' as const,
      label: 'Button Text',
      defaultValue: 'Learn More',
    },
    {
      name: 'linkUrl',
      type: 'text' as const,
      label: 'Button URL',
    },
    {
      name: 'style',
      type: 'select' as const,
      label: 'Style',
      defaultValue: 'default',
      options: [
        { label: 'Default (Gold)', value: 'default' },
        { label: 'Dark', value: 'dark' },
        { label: 'Light', value: 'light' },
      ],
    },
  ],
}

/**
 * Custom block: Image Gallery
 * A grid of images with optional captions.
 */
const ImageGalleryBlock = {
  slug: 'imageGallery',
  labels: {
    singular: 'Image Gallery',
    plural: 'Image Galleries',
  },
  fields: [
    {
      name: 'images',
      type: 'array' as const,
      label: 'Gallery Images',
      minRows: 1,
      maxRows: 12,
      fields: [
        {
          name: 'image',
          type: 'upload' as const,
          relationTo: 'media',
          required: true,
        },
        {
          name: 'caption',
          type: 'text' as const,
        },
      ],
    },
    {
      name: 'layout',
      type: 'select' as const,
      label: 'Gallery Layout',
      defaultValue: 'grid',
      options: [
        { label: 'Grid (2 columns)', value: 'grid' },
        { label: 'Masonry', value: 'masonry' },
        { label: 'Carousel', value: 'carousel' },
      ],
    },
  ],
}

/**
 * Custom block: Columns Layout
 * Allows users to split the rich text into 2 or 3 columns.
 */
const ColumnsBlock = {
  slug: 'columns',
  labels: {
    singular: 'Column Layout',
    plural: 'Column Layouts',
  },
  fields: [
    {
      name: 'layoutType',
      type: 'select' as const,
      label: 'Number of Columns',
      defaultValue: 'two',
      options: [
        { label: '2 Columns (50/50)', value: 'two' },
        { label: '3 Columns (33/33/33)', value: 'three' },
      ],
      admin: {
        description: 'Select how many columns you want side-by-side.',
      },
    },
    {
      name: 'columnOne',
      type: 'richText' as const,
      label: 'Left Column',
      // Explicit minimal editor prevents infinite recursion from BlocksFeature
      editor: lexicalEditor({ features: ({ defaultFeatures }) => defaultFeatures }),
    },
    {
      name: 'columnTwo',
      type: 'richText' as const,
      label: 'Middle/Right Column',
      editor: lexicalEditor({ features: ({ defaultFeatures }) => defaultFeatures }),
    },
    {
      name: 'columnThree',
      type: 'richText' as const,
      label: 'Right Column (if 3 columns)',
      editor: lexicalEditor({ features: ({ defaultFeatures }) => defaultFeatures }),
      admin: {
        condition: (data, siblingData) => siblingData.layoutType === 'three',
      },
    },
  ],
}

export const Articles: CollectionConfig = {
  slug: 'articles',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'category', 'author', '_status', 'publishedAt'],
    description: 'Museum articles, news, and publications.',
    listSearchableFields: ['title', 'excerpt'],
  },
  // Enable draft/publish workflow with version history
  versions: {
    drafts: {
      autosave: {
        interval: 1500, // Save draft every 1.5 seconds while editing
      },
    },
    maxPerDoc: 25, // Keep up to 25 versions per article
  },
  access: {
    // Published articles are public; drafts require authentication
    read: ({ req }) => {
      if (req.user) return true
      return {
        _status: {
          equals: 'published',
        },
      }
    },
    create: ({ req }) => !!req.user,
    update: ({ req }) => {
      if (!req.user) return false
      // Admins and editors can update any article
      if (req.user.role === 'admin' || req.user.role === 'editor') return true
      // Writers can only update their own articles
      return {
        author: {
          equals: req.user.id,
        },
      }
    },
    delete: ({ req }) => {
      if (!req.user) return false
      // Only admins and editors can delete articles
      return req.user.role === 'admin' || req.user.role === 'editor'
    },
  },
  hooks: {
    beforeChange: [
      async ({ data, operation, req, originalDoc }) => {
        // Auto-generate slug from title if not provided or if title changed
        if (data?.title && (!data?.slug || (operation === 'update' && data.title !== originalDoc?.title && data.slug === originalDoc?.slug))) {
          let baseSlug = data.title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '')
          
          // Guard against empty slug (e.g. title was only special characters)
          if (!baseSlug) {
            baseSlug = `article-${Date.now()}`
          }
          
          let slug = baseSlug
          let count = 1
          const MAX_ATTEMPTS = 100
          
          // Ensure slug is unique (bounded loop to prevent infinite iteration)
          while (count <= MAX_ATTEMPTS) {
            const existing = await req.payload.find({
              collection: 'articles',
              where: { slug: { equals: slug } },
              limit: 1,
            })
            if (existing.docs.length === 0 || (operation === 'update' && existing.docs[0].id === originalDoc?.id)) {
              break
            }
            slug = `${baseSlug}-${count}`
            count++
          }
          
          data.slug = slug
        }
        
        // Auto-assign author to current user if empty
        if (operation === 'create' && req.user && !data?.author) {
          data.author = req.user.id
        }
        
        // Auto-set publishedAt if status changes to published
        if (data?._status === 'published' && !data?.publishedAt) {
          data.publishedAt = new Date().toISOString()
        }
        
        return data
      },
    ],
  },
  fields: [
    // ─── Header Fields (Matched to Wireframe) ────────
    {
      name: 'title',
      type: 'text',
      required: true,
      label: 'Article Title',
      admin: {
        placeholder: 'Title of the News or Event',
      },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'author',
          type: 'relationship',
          relationTo: 'users',
          label: 'Author',
          required: true,
          admin: {
            description: 'Automatically assigned to you if left blank.',
            width: '33%',
          },
        },
        {
          name: 'publishedAt',
          type: 'date',
          label: 'Date',
          admin: {
            date: {
              pickerAppearance: 'dayOnly',
            },
            width: '33%',
          },
        },
        {
          name: 'coverImage',
          type: 'upload',
          relationTo: 'media',
          label: 'Cover Image',
          admin: {
            width: '33%',
          },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'address',
          type: 'text',
          label: 'Address / Location',
          admin: {
            width: '50%',
          },
        },
        {
          name: 'category',
          type: 'relationship',
          relationTo: 'categories',
          label: 'Category',
          admin: {
            width: '50%',
          },
        },
      ],
    },

    // ─── Main Content (WYSIWYG Body) ───────────────
    {
      name: 'content',
      type: 'richText',
      required: true,
      label: 'Body',
      editor: lexicalEditor({
        features: ({ defaultFeatures }) => [
          ...defaultFeatures,
          // Only add BlocksFeature — all other features (Heading, Link, List, etc.)
          // are already included in defaultFeatures.
          BlocksFeature({
            blocks: [
              ColumnsBlock,
              ArtifactHighlightBlock,
              CallToActionBlock,
              ImageGalleryBlock,
            ],
          }),
        ],
      }),
    },

    // ─── Sidebar / Metadata ─────────────────────────
    {
      name: 'slug',
      type: 'text',
      unique: true,
      label: 'URL Slug',
      admin: {
        position: 'sidebar',
        description: 'Auto-generated from title. Override for custom URLs.',
      },
    },
    {
      name: 'excerpt',
      type: 'textarea',
      label: 'Excerpt / Summary',
      maxLength: 500,
      admin: {
        position: 'sidebar',
        description: 'Short summary shown in article cards and SEO meta descriptions.',
      },
    },
    {
      name: 'tags',
      type: 'array',
      label: 'Tags',
      admin: {
        position: 'sidebar',
      },
      fields: [
        {
          name: 'tag',
          type: 'text',
          required: true,
        },
      ],
    },
    {
      name: 'featured',
      type: 'checkbox',
      label: 'Featured Article',
      defaultValue: false,
      admin: {
        position: 'sidebar',
        description: 'Featured articles appear prominently on the homepage.',
      },
    },

    // ─── SEO ────────────────────────────────────
    {
      name: 'seo',
      type: 'group',
      label: 'SEO Settings',
      admin: {
        description: 'Override auto-generated SEO values.',
        position: 'sidebar',
      },
      fields: [
        {
          name: 'metaTitle',
          type: 'text',
          label: 'Meta Title',
          maxLength: 70,
        },
        {
          name: 'metaDescription',
          type: 'textarea',
          label: 'Meta Description',
          maxLength: 160,
        },
        {
          name: 'ogImage',
          type: 'upload',
          relationTo: 'media',
          label: 'Social Share Image',
        },
      ],
    },
  ],
}
