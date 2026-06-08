import React from 'react'

export const CustomLogin: React.FC = () => {
  const adminUrlEnv = typeof process.env.NEXT_PUBLIC_ADMIN_URL === 'string' 
    ? process.env.NEXT_PUBLIC_ADMIN_URL 
    : (typeof process.env.PUBLIC_ADMIN_URL === 'string' ? process.env.PUBLIC_ADMIN_URL : '');
  
  let adminUrl = adminUrlEnv.split(',')[0]?.trim() || 'http://localhost:5173/';
  
  if (adminUrl && !adminUrl.startsWith('http://') && !adminUrl.startsWith('https://')) {
    if (adminUrl.startsWith('localhost') || adminUrl.startsWith('127.0.0.1')) {
      adminUrl = `http://${adminUrl}`;
    } else {
      adminUrl = `https://${adminUrl}`;
    }
  }

  if (!adminUrl.endsWith('/')) {
    adminUrl = `${adminUrl}/`;
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      backgroundColor: '#f3f4f6',
      padding: '2rem'
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '3rem',
        borderRadius: '8px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        textAlign: 'center',
        maxWidth: '400px'
      }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem', color: '#111827' }}>
          Authentication Required
        </h1>
        <p style={{ color: '#4b5563', marginBottom: '2rem' }}>
          This CMS uses centralized authentication. Please log in through the main administrative portal to access the content management system.
        </p>
        <a 
          href={adminUrl} 
          style={{
            display: 'inline-block',
            backgroundColor: '#2563eb',
            color: 'white',
            padding: '0.75rem 1.5rem',
            borderRadius: '0.375rem',
            textDecoration: 'none',
            fontWeight: '500',
            transition: 'background-color 0.2s'
          }}
        >
          Go to Main Portal
        </a>
      </div>
    </div>
  )
}
