import Head from 'next/head'
import Image from 'next/image'
import { assetUrl } from '@/lib/url'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { getStartupSlugs, getStartupBySlug } from '@/lib/data'

export default function StartupDetail({ startup }) {
  if (!startup) return null
  return (
    <>
      <Head>
        <title>{startup.name} — VSIE Startup</title>
        <meta name="description" content={startup.excerpt} />
      </Head>
      <div className="min-h-screen bg-vsie-900">
        <Navbar />
        <main id="main" className="py-24">
          <div className="container grid lg:grid-cols-12 gap-10">
            <article className="lg:col-span-8">
              <div className="flex items-center gap-4">
                {startup.logo && (
                  <Image src={assetUrl(startup.logo)} alt={`${startup.name} logo`} width={64} height={64} className="rounded-lg" />
                )}
                <div>
                  <h1 className="text-3xl md:text-5xl font-bold tracking-tight">{startup.name}</h1>
                  <p className="mt-2 text-vsie-muted">{startup.tagline}</p>
                </div>
              </div>
              <div className="prose prose-invert mt-8 max-w-none">
                <p>{startup.description}</p>
              </div>
              {startup.image && (
                <div className="mt-8 rounded-2xl overflow-hidden border border-white/10">
                  <Image src={assetUrl(startup.image)} alt={`${startup.name} demo`} width={1200} height={630} className="w-full h-auto" />
                </div>
              )}
            </article>
            <aside className="lg:col-span-4">
              <div className="sticky top-24 space-y-4 max-w-sm mx-auto w-full">
                {startup.website && (
                  <a href={startup.website} target="_blank" rel="noreferrer" className="block text-center rounded-xl px-6 py-3 bg-vsie-accent text-white font-semibold shadow hover:-translate-y-0.5 transition">Visit website</a>
                )}
                <div className="rounded-xl bg-vsie-800/60 border border-white/10 p-5">
                  <h3 className="font-semibold">Details</h3>
                  <ul className="mt-3 text-vsie-muted space-y-1">
                    <li><strong>Stage:</strong> {startup.stage}</li>
                    <li><strong>Sector:</strong> {startup.sector}</li>
                    <li><strong>Cohort:</strong> {startup.cohort}</li>
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
  const slugs = getStartupSlugs()
  return {
    paths: slugs.map((slug) => ({ params: { slug } })),
    fallback: 'blocking'
  }
}

export async function getStaticProps({ params }) {
  const startup = getStartupBySlug(params.slug)
  return { props: { startup } }
}
