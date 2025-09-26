import Head from 'next/head'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import Section from '@/components/layout/Section'
import CardGrid from '@/components/sections/CardGrid'
import { getAllEvents } from '@/lib/data'

export default function EventsPage({ events }) {
  return (
    <>
      <Head>
        <title>VSIE — Events</title>
      </Head>
      <div className="min-h-screen bg-vsie-900">
        <Navbar />
        <main id="main" className="py-24">
          <Section title="Events" description="Workshops, hackathons, and demo days organized by VSIE.">
            <CardGrid items={events} type="events" />
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
