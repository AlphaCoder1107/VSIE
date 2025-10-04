#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

const cwd = process.cwd()
const outDir = path.join(cwd, 'out')
const nextDir = path.join(cwd, '.next')
const manifestPath = path.join(outDir, 'routes-manifest.json')
const nextManifestPath = path.join(nextDir, 'routes-manifest.json')

if (!fs.existsSync(outDir)) {
  console.error('Out directory not found:', outDir)
  process.exit(0)
}

try {
  if (fs.existsSync(nextManifestPath)) {
    // Prefer the real manifest produced by next build
    fs.copyFileSync(nextManifestPath, manifestPath)
    console.log('Copied routes-manifest.json from .next to out')
  } else {
    // Fallback minimal manifest
    const manifest = {
      version: 3,
      basePath: '',
      pages404: true,
      redirects: [],
      rewrites: { beforeFiles: [], afterFiles: [], fallback: [] },
      headers: [],
      dynamicRoutes: [],
      staticRoutes: [],
      dataRoutes: [],
      i18n: null,
    }
    fs.writeFileSync(manifestPath, JSON.stringify(manifest))
    console.log('Wrote minimal routes-manifest.json')
  }
} catch (e) {
  console.warn('Could not write routes-manifest.json:', e.message)
}
