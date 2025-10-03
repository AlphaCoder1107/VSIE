import Head from 'next/head'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import Section from '@/components/layout/Section'
import Hero from '@/components/sections/Hero'
import FeatureSplit from '@/components/sections/FeatureSplit'
import CardGrid from '@/components/sections/CardGrid'
import { getFeaturedStartups, getUpcomingEvents } from '@/lib/data'
import { useEffect, useState } from 'react'
import { fetchPublicEvents } from '@/lib/publicEvents'

export default function Home({ startups, events }) {
  const [liveEvents, setLiveEvents] = useState(events)
  useEffect(() => {
    fetchPublicEvents(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, 50)
      .then((rows) => { if (rows && rows.length) setLiveEvents(rows) })
      .catch(() => {})
  }, [])
  return (
    <>
      <Head>
  <title>VIC — Vidya Innovation Centre</title>
  <meta name="description" content="Launch college startups faster. VIC at Vidya University helps students, alumni, and faculty build, validate, and scale their ventures." />
  <meta name="keywords" content="Vidya Innovation Centre, VIC, Vidya University startups, college incubator, hackathon, bootcamp, entrepreneurship" />
  <link rel="canonical" href="https://alphacoder1107.github.io/VSIE/" />
  <meta property="og:title" content="VIC — Vidya Innovation Centre" />
  <meta property="og:description" content="Launch college startups faster at VIC." />
        <meta property="og:type" content="website" />
  <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'CollegeOrUniversity',
    name: 'VIC — Vidya Innovation Centre',
    url: 'https://alphacoder1107.github.io/VSIE/',
    sameAs: [],
    department: {
      '@type': 'Organization',
      name: 'Innovation & Entrepreneurship',
    },
    potentialAction: {
      '@type': 'SearchAction',
      target: 'https://alphacoder1107.github.io/VSIE/?q={search_term_string}',
      'query-input': 'required name=search_term_string'
    }
  }) }} />
      </Head>
      <div className="min-h-screen bg-vsie-900">
        <Navbar />
        <main id="main">
          <Hero />
          <FeatureSplit />
         <Section title="Upcoming events" description="Join our workshops, hackathons, and demo days.">
           <CardGrid items={liveEvents} type="events" />
         </Section>
             <Section title="Featured startups" description="A glimpse of ventures incubated at VIC.">
               <CardGrid items={startups} type="startups" />
             </Section>
        </main>
        <Footer />
      </div>
    </>
  )
}

export async function getStaticProps() {
  const startups = getFeaturedStartups()
  const events = getUpcomingEvents()
  return { props: { startups, events } }
}
