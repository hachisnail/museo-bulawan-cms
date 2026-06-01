// apps/cms/next.config.mjs
import { withPayload } from '@payloadcms/next/withPayload'

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Suppress punycode deprecation and other node warnings
  serverExternalPackages: ['sharp']
}

export default withPayload(nextConfig)