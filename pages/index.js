import Head from 'next/head'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import Section from '@/components/layout/Section'
import Hero from '@/components/sections/Hero'
import FeatureSplit from '@/components/sections/FeatureSplit'
import CardGrid from '@/components/sections/CardGrid'
import { getFeaturedStartups, getUpcomingEvents } from '@/lib/data'

export default function Home({ startups, events }) {
  return (
    <>
      <Head>
  <title>VIC — Vidya Innovation Centre</title>
  <meta name="description" content="Launch college startups faster. VIC at Vidya University helps students, alumni, and faculty build, validate, and scale their ventures." />
  <meta property="og:title" content="VIC — Vidya Innovation Centre" />
  <meta property="og:description" content="Launch college startups faster at VIC." />
        <meta property="og:type" content="website" />
      </Head>
      <div className="min-h-screen bg-vsie-900">
        <Navbar />
        <main id="main">
          <Hero />
          <FeatureSplit />
             <Section title="Upcoming events" description="Join our workshops, hackathons, and demo days.">
               <CardGrid items={events} type="events" />
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
