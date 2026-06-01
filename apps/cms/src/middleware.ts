import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// ─── Allowed origins that may embed the CMS in an iframe ─────────
const ALLOWED_ORIGINS = [
  'http://localhost:5173',  // panel-admin (Vite dev)
  'http://localhost:5174',  // panel-admin (Vite dev fallback port)
]

export function middleware(request: NextRequest) {
  const url = request.nextUrl

  if (url.pathname.startsWith('/admin')) {
    const origin = request.headers.get('origin')
    const referer = request.headers.get('referer')
    const secFetchDest = request.headers.get('sec-fetch-dest')

    const isAllowedOrigin = origin && ALLOWED_ORIGINS.some(o => origin.startsWith(o))
    const isAllowedReferer = referer && ALLOWED_ORIGINS.some(o => referer.startsWith(o))

    // Allow if the request comes from a trusted admin panel origin.
    // This covers: initial iframe load, navigation within the iframe,
    // and sub-resource fetches (scripts, styles, images, XHR/fetch).
    // Browsers may send Origin, Referer, or both — checking either is enough.
    if (isAllowedOrigin || isAllowedReferer) {
      const response = NextResponse.next()
      response.headers.set(
        'Content-Security-Policy',
        `frame-ancestors 'self' ${ALLOWED_ORIGINS.join(' ')}`
      )
      response.headers.delete('X-Powered-By')
      return response
    }

    // Allow internal navigation within the CMS iframe (e.g., clicking links
    // inside the Payload admin UI). These are same-origin requests where the
    // Referer points to the CMS itself.
    const cmsOrigin = `${url.protocol}//${url.host}`
    const isCmsInternalNav = referer && referer.startsWith(cmsOrigin)

    if (isCmsInternalNav) {
      const response = NextResponse.next()
      response.headers.set(
        'Content-Security-Policy',
        `frame-ancestors 'self' ${ALLOWED_ORIGINS.join(' ')}`
      )
      response.headers.delete('X-Powered-By')
      return response
    }

    // Allow sub-resource requests (scripts, styles, images, fonts, etc.)
    // These are needed for the CMS UI to render inside the iframe and often
    // don't carry Origin or Referer headers.
    if (secFetchDest && secFetchDest !== 'document' && secFetchDest !== 'iframe') {
      const response = NextResponse.next()
      response.headers.set(
        'Content-Security-Policy',
        `frame-ancestors 'self' ${ALLOWED_ORIGINS.join(' ')}`
      )
      response.headers.delete('X-Powered-By')
      return response
    }

    // Everything else (direct browser access) is blocked.
    return new NextResponse(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Access Denied</title>
          <style>
            body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; background-color: #09090b; color: #fafafa; margin: 0; }
            .container { text-align: center; padding: 2rem; border: 1px solid #27272a; border-radius: 8px; background: #18181b; }
            h1 { color: #ef4444; margin-top: 0; }
            a { color: #3b82f6; text-decoration: none; }
            a:hover { text-decoration: underline; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Access Denied</h1>
            <p>The CMS Payload interface cannot be accessed directly.</p>
            <p>Please access it through the <a href="http://localhost:5173/articles">Admin Panel</a>.</p>
          </div>
        </body>
      </html>
    `, {
      status: 403,
      headers: { 'Content-Type': 'text/html' }
    })
  }

  return NextResponse.next()
}

export const config = {
  // Apply middleware to all /admin paths, but not /api or static files
  matcher: ['/admin/:path*'],
}
