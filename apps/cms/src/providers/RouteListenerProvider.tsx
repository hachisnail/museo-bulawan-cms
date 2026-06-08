'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect } from 'react'

// Target origin for postMessage — restrict to the trusted admin panel only
const ADMIN_ORIGIN = process.env.NEXT_PUBLIC_ADMIN_ORIGIN || 'http://localhost:5173'

export const RouteListenerProvider = ({ children }: { children: React.ReactNode }) => {
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: 'PAYLOAD_ROUTE_CHANGE', pathname }, ADMIN_ORIGIN)
    }
  }, [pathname])

  // Only show inside an article editor (e.g. /admin/collections/articles/create or /id)
  // Not on the list view (/admin/collections/articles)
  const isEditing = pathname && pathname.startsWith('/admin/collections/articles/') && pathname.replace('/admin/collections/articles', '').length > 1;

  return (
    <>
      {isEditing && (
        <div style={{
          padding: '12px 24px',
          backgroundColor: '#ffffff',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          position: 'sticky',
          top: 0,
          zIndex: 50,
          width: '100%'
        }}>
          <button 
            onClick={() => router.push('/admin/collections/articles')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: '#64748b',
              cursor: 'pointer',
              background: 'none',
              border: 'none',
              fontSize: '13px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              transition: 'color 0.2s',
              padding: 0
            }}
            onMouseOver={(e) => e.currentTarget.style.color = '#0f172a'}
            onMouseOut={(e) => e.currentTarget.style.color = '#64748b'}
          >
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Articles List
          </button>
        </div>
      )}
      {children}
    </>
  )
}