import Image from 'next/image'
import { assetUrl } from '@/lib/url'

export default function FeatureSplit() {
  return (
    <section id="about" className="py-16 md:py-24">
      <div className="container grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        <div className="lg:col-span-5">
          <p className="text-sm text-vsie-accent font-medium">Programs & Support</p>
          <h2 className="mt-2 text-3xl md:text-5xl font-bold tracking-tight">A better pathway from idea to impact</h2>
          <p className="mt-4 text-vsie-muted">From ideation bootcamps to acceleration and investor connects, VSIE offers hands-on guidance at every stage.</p>
          <ul className="mt-6 space-y-3 text-white/90">
            <li className="flex gap-3"><span className="text-vsie-accent">•</span> Mentor network of founders and alumni</li>
            <li className="flex gap-3"><span className="text-vsie-accent">•</span> Prototype labs and cloud credits</li>
            <li className="flex gap-3"><span className="text-vsie-accent">•</span> Pitch practice and demo days</li>
          </ul>
        </div>
        <div className="relative lg:col-span-7">
          <div className="rounded-2xl bg-vsie-800/60 border border-white/10 p-3 shadow-lg">
            <Image src={assetUrl('/images/mockups/dashboard.svg')} alt="VSIE dashboard mockup" width={1200} height={800} className="rounded-xl" />
          </div>
        </div>
      </div>
    </section>
  )
}
