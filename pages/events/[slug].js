import Head from 'next/head'
import Image from 'next/image'
import { assetUrl } from '@/lib/url'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { getEventSlugs, getEventBySlug } from '@/lib/data'

export default function EventDetail({ event }) {
  if (!event) return null
  return (
    <>
      <Head>
  <title>{event.title} — VIC Events</title>
        <meta name="description" content={event.excerpt} />
      </Head>
      <div className="min-h-screen bg-vsie-900">
        <Navbar />
        <main id="main" className="py-24">
          <div className="container grid lg:grid-cols-12 gap-10">
            <article className="lg:col-span-8">
              <h1 className="text-3xl md:text-5xl font-bold tracking-tight">{event.title}</h1>
              <p className="mt-3 text-vsie-muted">{event.date} • {event.location}</p>
              <div className="mt-8 rounded-2xl overflow-hidden border border-white/10">
                <Image src={assetUrl(event.image)} alt="Event cover" width={1200} height={630} className="w-full h-auto" />
              </div>
              <div className="prose prose-invert mt-8 max-w-none">
                <p>{event.description}</p>
              </div>
            </article>
            <aside className="lg:col-span-4">
              <div className="sticky top-24 space-y-4 max-w-sm mx-auto w-full">
                <a href="#" className="block text-center rounded-xl px-6 py-3 bg-vsie-accent text-white font-semibold shadow hover:-translate-y-0.5 transition">Register now</a>
                <div className="rounded-xl bg-vsie-800/60 border border-white/10 p-5">
                  <h3 className="font-semibold">Details</h3>
                  <ul className="mt-3 text-vsie-muted space-y-1">
                    <li><strong>Date:</strong> {event.date}</li>
                    <li><strong>Time:</strong> {event.time}</li>
                    <li><strong>Venue:</strong> {event.location}</li>
                  </ul>
                </div>
              </div>
            </aside>
          </div>
        </main>
        <Footer />
      </div>
    </>
  )
}

export async function getStaticPaths() {
  const slugs = getEventSlugs()
  return {
    paths: slugs.map((slug) => ({ params: { slug } })),
    fallback: 'blocking'
  }
}

export async function getStaticProps({ params }) {
  const event = getEventBySlug(params.slug)
  return { props: { event } }
}
