#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

const cwd = process.cwd()
const outDir = path.join(cwd, 'out')
const nextDir = path.join(cwd, '.next')
const manifestPath = path.join(outDir, 'routes-manifest.json')
const nextRoutesManifestPath = path.join(nextDir, 'routes-manifest.json')
const nextPrerenderManifestPath = path.join(nextDir, 'prerender-manifest.json')

if (!fs.existsSync(outDir)) {
  console.error('Out directory not found:', outDir)
  process.exit(0)
}

try {
  if (fs.existsSync(nextRoutesManifestPath)) {
    // Prefer the real manifest produced by next build
    fs.copyFileSync(nextRoutesManifestPath, manifestPath)
    console.log('Copied routes-manifest.json from .next to out')
  } else {
    // Try to synthesize from prerender-manifest (Next 14 export flow)
    let staticRoutes = []
    try {
      if (fs.existsSync(nextPrerenderManifestPath)) {
        const pm = JSON.parse(fs.readFileSync(nextPrerenderManifestPath, 'utf8'))
        staticRoutes = Object.keys(pm.routes || {}).map((r) => ({ page: r }))
      }
    } catch {}

    const manifest = {
      version: 3,
      basePath: '',
      pages404: true,
      redirects: [],
      rewrites: { beforeFiles: [], afterFiles: [], fallback: [] },
      headers: [],
      dynamicRoutes: [],
      staticRoutes,
      dataRoutes: [],
      i18n: null,
    }
    fs.writeFileSync(manifestPath, JSON.stringify(manifest))
    console.log('Synthesized routes-manifest.json from prerender manifest (or wrote minimal)')
  }
} catch (e) {
  console.warn('Could not write routes-manifest.json:', e.message)
}
