#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

const outDir = path.join(process.cwd(), 'out')
const manifestPath = path.join(outDir, 'routes-manifest.json')

if (!fs.existsSync(outDir)) {
  console.error('Out directory not found:', outDir)
  process.exit(0)
}

// Minimal manifest to satisfy some hosts expecting Next.js artifacts
const manifest = {
  version: 3,
  basePath: '',
  pages404: true,
  redirects: [],
  rewrites: { beforeFiles: [], afterFiles: [], fallback: [] },
  headers: [],
}

try {
  fs.writeFileSync(manifestPath, JSON.stringify(manifest))
  console.log('Wrote routes-manifest.json')
} catch (e) {
  console.warn('Could not write routes-manifest.json:', e.message)
}
