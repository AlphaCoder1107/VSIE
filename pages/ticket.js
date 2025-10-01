import Head from 'next/head'

export default function Ticket() {
  const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams()
  const code = params.get('code') || ''
  const id = params.get('id') || ''
  const title = code ? `VIC Ticket ${code}` : 'VIC Ticket'
  const qrApi = code ? `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(JSON.stringify({ id, code }))}` : ''
  return (
    <div className="min-h-screen bg-[#0B1220] text-white p-6">
      <Head><title>{title}</title></Head>
      <div className="max-w-xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Your Ticket</h1>
        {code ? (
          <>
            <p className="mb-4">Registration code: <b>{code}</b></p>
            <div className="bg-black/40 rounded-lg p-4 inline-block">
              <img src={qrApi} alt="QR" width={320} height={320} />
            </div>
            <p className="mt-4 text-sm text-white/70">Keep this page open at entry. You may also save a screenshot.</p>
          </>
        ) : (
          <p className="text-white/80">Missing code. Please open the ticket link from your email.</p>
        )}
      </div>
    </div>
  )
}
