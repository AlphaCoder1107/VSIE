import Head from 'next/head'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import Section from '@/components/layout/Section'
import CardGrid from '@/components/sections/CardGrid'
import { getAllEvents } from '@/lib/data'
import { useEffect, useState } from 'react'
import { fetchPublicEvents } from '@/lib/publicEvents'

export default function EventsPage({ events }) {
  const [liveEvents, setLiveEvents] = useState(events)
  useEffect(() => {
    fetchPublicEvents(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, 200)
      .then((rows) => { if (rows && rows.length) setLiveEvents(rows) })
      .catch(() => {})
  }, [])
  return (
    <>
      <Head>
  <title>VIC — Events</title>
      </Head>
      <div className="min-h-screen bg-vsie-900">
        <Navbar />
        <main id="main" className="py-24">
          <Section title="Events" description="Workshops, hackathons, and demo days organized by VIC.">
            <CardGrid items={liveEvents} type="events" />
          </Section>
        </main>
        <Footer />
      </div>
    </>
  )
}

export async function getStaticProps() {
  const events = getAllEvents()
  return { props: { events } }
}
