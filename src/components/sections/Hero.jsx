import Link from 'next/link'
import { assetUrl } from '@/lib/url'

export default function Hero() {
  return (
    <header className="relative bg-cover bg-center" style={{ backgroundImage: `url(${assetUrl('/images/hero/hero.svg')})` }}>
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 to-black/40" aria-hidden></div>
  <div className="container mx-auto px-6 md:px-12 py-28 text-center relative z-10">
  <p className="inline-block mb-4 text-vsie-accent font-semibold text-xl md:text-2xl lg:text-3xl px-3 py-1 rounded-full bg-black/30 ring-1 ring-white/10 backdrop-blur-sm drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]">VIC at Vidya University</p>
        <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold text-white leading-tight">Launch college startups faster</h1>
        <p className="mt-6 text-lg text-vsie-muted max-w-2xl mx-auto">Programs, mentorship, funding access, and labs to help students and alumni build, validate, and scale their ventures.</p>
        <div className="mt-8 flex justify-center gap-4">
          <Link href="#apply" className="rounded-xl px-6 py-3 bg-vsie-accent text-white font-semibold shadow hover:-translate-y-0.5 transition">Apply now</Link>
          <Link href="/events" className="rounded-xl px-6 py-3 border border-white/10 text-white/90 hover:bg-white/10 transition">View events →</Link>
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-vsie-900 to-transparent" aria-hidden></div>
    </header>
  )
}
