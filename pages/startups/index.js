import Head from 'next/head'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import Section from '@/components/layout/Section'
import CardGrid from '@/components/sections/CardGrid'
import { getAllStartups } from '@/lib/data'

export default function StartupsPage({ startups }) {
  return (
    <>
      <Head>
  <title>VIC — Startups</title>
      </Head>
      <div className="min-h-screen bg-vsie-900">
        <Navbar />
        <main id="main" className="py-24">
          <Section title="Startups" description="Companies incubated and accelerated by VIC at Vidya University.">
            <CardGrid items={startups} type="startups" />
          </Section>
        </main>
        <Footer />
      </div>
    </>
  )
}

export async function getStaticProps() {
  const startups = getAllStartups()
  return { props: { startups } }
}
