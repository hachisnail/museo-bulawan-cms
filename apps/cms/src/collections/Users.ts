import type { CollectionConfig } from 'payload'

export const Users: CollectionConfig = {
  slug: 'users',
  auth: true,
  admin: {
    useAsTitle: 'email',
    description: 'CMS admin accounts for content editors and writers.',
  },
  access: {
    // Only authenticated users can read the users list
    read: ({ req }) => !!req.user,
    create: ({ req }) => !!req.user,
    update: ({ req }) => !!req.user,
    delete: ({ req }) => !!req.user,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      label: 'Display Name',
    },
    {
      name: 'role',
      type: 'select',
      label: 'CMS Role',
      defaultValue: 'writer',
      options: [
        { label: 'Admin', value: 'admin' },
        { label: 'Editor', value: 'editor' },
        { label: 'Writer', value: 'writer' },
      ],
      admin: {
        position: 'sidebar',
      },
    },
  ],
}
