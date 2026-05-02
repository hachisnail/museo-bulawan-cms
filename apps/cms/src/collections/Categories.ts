import type { CollectionConfig } from 'payload'

export const Categories: CollectionConfig = {
  slug: 'categories',
  admin: {
    useAsTitle: 'name',
    description: 'Organize articles by topic. Categories appear in navigation and filters.',
  },
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      label: 'Category Name',
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      label: 'URL Slug',
      admin: {
        description: 'URL-friendly identifier (e.g., "museum-news").',
        position: 'sidebar',
      },
    },
    {
      name: 'description',
      type: 'textarea',
      label: 'Description',
    },
    {
      name: 'color',
      type: 'text',
      label: 'Accent Color',
      admin: {
        description: 'Hex color code for UI badges (e.g., "#D4AF37").',
        position: 'sidebar',
      },
    },
  ],
}
