import { redirect } from 'next/navigation'

/**
 * Root page — redirects to the Payload admin panel.
 * This CMS app is API + Admin only — no public frontend.
 */
export default function RootPage() {
  redirect('/admin')
}
