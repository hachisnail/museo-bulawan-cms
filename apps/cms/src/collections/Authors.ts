import type { CollectionConfig } from 'payload'

export const Authors: CollectionConfig = {
  slug: 'authors',
  admin: {
    useAsTitle: 'name',
    description: 'Museum staff and contributors who write articles.',
  },
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      label: 'Full Name',
    },
    {
      name: 'role',
      type: 'text',
      label: 'Title / Role',
      admin: {
        description: 'e.g., "Curator", "Registrar", "Museum Director"',
      },
    },
    {
      name: 'avatar',
      type: 'upload',
      relationTo: 'media',
      label: 'Profile Photo',
    },
    {
      name: 'bio',
      type: 'textarea',
      label: 'Short Biography',
      admin: {
        description: 'A brief bio displayed alongside their articles.',
      },
    },
    {
      name: 'email',
      type: 'email',
      label: 'Email',
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'externalId',
      type: 'text',
      unique: true,
      label: 'External User ID',
      admin: {
        description: 'Links this author to the main CMS user system (MariaDB ULID).',
        position: 'sidebar',
      },
    },
  ],
}
