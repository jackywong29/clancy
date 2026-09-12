import path from 'node:path'
import type { NextConfig } from 'next'

// Pinned because a stray package-lock.json in the home directory makes
// Turbopack infer ~/ as the workspace root, which resolves modules from the
// wrong tree (the "stray npm install in the parent folder" breakage).
const nextConfig: NextConfig = {
  turbopack: { root: path.dirname(new URL(import.meta.url).pathname) },
}

export default nextConfig
