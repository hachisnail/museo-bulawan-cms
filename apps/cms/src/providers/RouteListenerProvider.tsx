'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect } from 'react'

export const RouteListenerProvider = ({ children }: { children: React.ReactNode }) => {
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: 'PAYLOAD_ROUTE_CHANGE', pathname }, '*')
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
          backgroundColor: '#000',
          borderBottom: '1px solid #222',
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
              color: '#a1a1aa',
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
            onMouseOver={(e) => e.currentTarget.style.color = '#fff'}
            onMouseOut={(e) => e.currentTarget.style.color = '#a1a1aa'}
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