#!/usr/bin/env node
import https from 'node:https'

function get(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      let data = ''
      res.on('data', (c) => (data += c))
      res.on('end', () => resolve({ status: res.statusCode, data }))
    })
    req.on('error', reject)
  })
}

async function main() {
  const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL
  const worker = process.env.WORKER_URL
  if (!supabase) throw new Error('NEXT_PUBLIC_SUPABASE_URL not set')

  const healthUrl = `${supabase}/functions/v1/diag-health`
  console.log('Checking:', healthUrl)
  const a = await get(healthUrl)
  console.log('diag-health:', a.status, a.data)
  if (a.status !== 200) process.exit(2)

  if (worker) {
    const workerUrl = `${worker.replace(/\/$/, '')}/health`
    console.log('Checking worker:', workerUrl)
    const b = await get(workerUrl)
    console.log('worker/health:', b.status, b.data)
    if (b.status !== 200) process.exit(3)
  } else {
    console.log('WORKER_URL not set, skipping worker health check')
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
