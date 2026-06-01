// apps/cms/next.config.mjs
import { withPayload } from '@payloadcms/next/withPayload'

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Suppress punycode deprecation and other node warnings
  serverExternalPackages: ['sharp'],
  // Removed webpack config for now to debug scss issue
}

export default withPayload(nextConfig)