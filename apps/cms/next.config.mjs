// apps/cms/next.config.mjs
import { withPayload } from '@payloadcms/next/withPayload'

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Suppress punycode deprecation and other node warnings
  serverExternalPackages: ['sharp'],
  
  webpack: (config, { webpack }) => {
    // Fix: Ignore missing SCSS imports dynamically called by @payloadcms/ui packages
    config.plugins.push(
      new webpack.IgnorePlugin({
        resourceRegExp: /\.scss$/,
        contextRegExp: /@payloadcms[\\/]ui/
      })
    );
    return config;
  }
}

export default withPayload(nextConfig)