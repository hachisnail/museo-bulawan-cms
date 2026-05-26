import type { CollectionConfig } from 'payload'

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
            console.log('--- api-auth strategy called ---');
            const response = await fetch('http://localhost:3000/api/v1/auth/check', {
              headers: { cookie: cookieHeader },
            });
            
            if (!response.ok) {
              console.log('api-auth: check failed', response.status);
              return { user: null };
            }
            
            const data = await response.json();
            if (!data.valid || !data.user) {
              console.log('api-auth: invalid session');
              return { user: null };
            }

            console.log('api-auth: user found in API', data.user.email);
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
            const newUser = await payload.create({
              collection: 'users',
              overrideAccess: true,
              data: {
                email: data.user.email,
                name: `${data.user.fname} ${data.user.lname}`.trim(),
                role: data.user.role === 'admin' ? 'admin' : 'writer', 
                password: Math.random().toString(36).slice(-8) + 'Aa1!', // Dummy password required by Payload
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
