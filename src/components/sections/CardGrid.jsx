import Link from 'next/link'
import Image from 'next/image'
import { assetUrl } from '@/lib/url'

function Card({ item, type }) {
  const href = type === 'events' ? `/events/${item.slug}` : `/startups/${item.slug}`
  return (
    <Link href={href} className="group rounded-2xl bg-vsie-800/60 border border-white/10 p-5 hover:bg-white/5 transition block">
      {item.image && (
        <div className="rounded-xl overflow-hidden border border-white/5 aspect-[16/9]">
          <Image src={assetUrl(item.image)} alt={item.title || item.name} width={800} height={450} className="w-full h-full object-cover group-hover:scale-[1.02] transition" />
        </div>
      )}
      <div className="mt-4">
        <h3 className="text-lg font-semibold line-clamp-1">{item.title || item.name}</h3>
        <p className="mt-2 text-sm text-vsie-muted line-clamp-2">{item.excerpt || item.tagline}</p>
        <div className="mt-3 text-xs text-white/60">
          {type === 'events' ? (
            <span>{item.date} • {item.location}</span>
          ) : (
            <span>{item.sector} • {item.stage}</span>
          )}
        </div>
        {type === 'events' && (
          <div className="mt-4">
            <Link href={`/events/${item.slug}#register`} className="inline-block rounded-lg px-3 py-1.5 bg-vsie-accent text-white text-sm">Register now</Link>
          </div>
        )}
      </div>
    </Link>
  )
}

export default function CardGrid({ items = [], type }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {items.map((item) => (
        <Card key={item.slug} item={item} type={type} />
      ))}
    </div>
  )
}
