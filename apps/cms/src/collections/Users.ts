import type { CollectionConfig } from 'payload'
import crypto from 'crypto'

const API_URL = process.env.API_URL || 'http://localhost:3000'

export const Users: CollectionConfig = {
  slug: 'users',
  auth: {
    strategies: [
      {
        name: 'api-auth',
        authenticate: async ({ headers, payload }) => {
          const cookieHeader = headers.get('cookie');
          if (!cookieHeader || !cookieHeader.includes('connect.sid')) {
            return { user: null };
          }
          
          try {
            const apiBaseUrl = process.env.INTERNAL_API_URL || process.env.API_URL || process.env.PUBLIC_API_URL || 'http://localhost:3000';
            const response = await fetch(`${apiBaseUrl}/api/v1/auth/check`, {
              headers: { cookie: cookieHeader },
            });
            
            if (!response.ok) {
              return { user: null };
            }
            
            const data = await response.json();
            if (!data.valid || !data.user) {
              return { user: null };
            }

            // Find existing user in Payload
            const { docs } = await payload.find({
              collection: 'users',
              where: { email: { equals: data.user.email } },
              overrideAccess: true, // EXPLICITLY bypass access control
            });
            
            if (docs.length > 0) {
              return { user: docs[0], collection: 'users' };
            }

            // Auto-create user if not found
            // Use cryptographically secure random password (Payload requires one but it's never used for login)
            const dummyPassword = crypto.randomBytes(32).toString('base64url')
            const newUser = await payload.create({
              collection: 'users',
              overrideAccess: true,
              data: {
                email: data.user.email,
                name: `${data.user.fname} ${data.user.lname}`.trim(),
                role: data.user.role === 'admin' ? 'admin' : 'writer', 
                password: dummyPassword,
              },
            });
            return { user: newUser, collection: 'users' };
          } catch (error) {
            console.error('API Auth check failed', error);
            return { user: null };
          }
        },
      },
    ],
  },
  admin: {
    useAsTitle: 'email',
    description: 'CMS admin accounts for content editors and writers.',
  },
  access: {
    // All authenticated users can see the user list (for relationship dropdowns)
    read: ({ req }) => !!req.user,
    // Only admins can create, update, or delete users
    create: ({ req }) => req.user?.role === 'admin',
    update: ({ req }) => {
      if (!req.user) return false
      // Admins can update anyone; others can only update themselves
      if (req.user.role === 'admin') return true
      return { id: { equals: req.user.id } }
    },
    delete: ({ req }) => req.user?.role === 'admin',
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
