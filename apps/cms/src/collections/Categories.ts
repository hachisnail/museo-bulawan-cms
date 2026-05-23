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
  hooks: {
    beforeChange: [
      async ({ data }) => {
        // Auto-generate slug from name if not provided
        if (data?.name && !data?.slug) {
          data.slug = data.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '')
        }
        return data
      },
    ],
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
      unique: true,
      label: 'URL Slug',
      admin: {
        description: 'Auto-generated from name. Override for custom URLs.',
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
