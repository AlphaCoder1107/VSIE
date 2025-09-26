import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="border-t border-white/10 mt-16">
      <div className="container mx-auto px-6 md:px-12 py-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
        <div>
          <div className="flex items-center gap-3">
            <img
              src="/images/hero/logo.png"
              onError={(e) => {
                if (e.currentTarget.getAttribute('data-fallback') === 'true') return
                e.currentTarget.src = '/images/hero/logo.svg'
                e.currentTarget.setAttribute('data-fallback', 'true')
              }}
              alt="VSIE logo"
              className="h-8 w-auto"
              height={32}
            />
            <span className="sr-only">VSIE</span>
          </div>
          <p className="mt-4 text-vsie-muted max-w-xs">Vidya Startup & Innovation Incubation Ecosystem at Vidya University.</p>
        </div>
        <div>
          <h4 className="font-semibold">Explore</h4>
          <ul className="mt-3 space-y-2 text-vsie-muted">
            <li><Link href="/startups" className="hover:text-white">Startups</Link></li>
            <li><Link href="/events" className="hover:text-white">Events</Link></li>
            <li><a className="hover:text-white" href="#programs">Programs</a></li>
          </ul>
        </div>
        <div>
          <h4 className="font-semibold">Contact</h4>
          <ul className="mt-3 space-y-2 text-vsie-muted">
            <li><a href="mailto:vsie@vidya.edu">vsie@vidya.edu</a></li>
            <li>Vidya University, Innovation Hub</li>
          </ul>
        </div>
        <div>
          <h4 className="font-semibold">Newsletter</h4>
          <p className="mt-3 text-vsie-muted">Get updates on programs and events.</p>
          <form className="mt-4 flex gap-2">
            <input aria-label="Email" type="email" placeholder="you@example.com" className="flex-1 rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-vsie-accent" />
            <button className="rounded-lg px-4 py-2 bg-vsie-accent text-white font-medium">Subscribe</button>
          </form>
        </div>
      </div>
      <div className="border-t border-white/10 py-6 text-center text-sm text-vsie-muted">© {new Date().getFullYear()} VSIE — Vidya University. All rights reserved.</div>
    </footer>
  )
}
