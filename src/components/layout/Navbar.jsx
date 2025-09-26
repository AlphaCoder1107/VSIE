import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Disclosure } from '@headlessui/react'
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline'

const nav = [
  { name: 'Home', href: '/' },
  { name: 'Startups', href: '/startups' },
  { name: 'Events', href: '/events' },
  { name: 'About', href: '#about' }
]

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10)
    onScroll()
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <Disclosure as="nav" className={`fixed inset-x-0 top-0 z-50 transition-colors ${scrolled ? 'bg-vsie-900/80 backdrop-blur supports-[backdrop-filter]:bg-vsie-900/60' : 'bg-transparent'}`}>
      {({ open }) => (
        <>
          <div className="mx-auto max-w-7xl px-6 md:px-12">
            <div className="relative flex h-16 items-center justify-between">
              <div className="flex flex-1 items-center justify-start">
                <Link href="/" className="flex items-center gap-3" aria-label="VSIE Home">
                  <img
                    src="/images/hero/logo.png"
                    onError={(e) => {
                      if (e.currentTarget.getAttribute('data-fallback') === 'true') return
                      e.currentTarget.src = '/images/hero/logo.svg'
                      e.currentTarget.setAttribute('data-fallback', 'true')
                    }}
                    alt="VSIE logo"
                    className="h-10 w-auto"
                    height={40}
                  />
                  <span className="sr-only">VSIE</span>
                </Link>
              </div>
              <div className="hidden md:flex items-center gap-8 text-sm text-vsie-muted">
                {nav.map((item) => (
                  <Link key={item.name} href={item.href} className="hover:text-white transition-colors">
                    {item.name}
                  </Link>
                ))}
                <Link href="#apply" className="rounded-xl px-4 py-2 bg-vsie-accent text-white font-medium shadow hover:-translate-y-0.5 transition">Apply now</Link>
              </div>
              <div className="md:hidden">
                <Disclosure.Button className="inline-flex items-center justify-center rounded-md p-2 text-white hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-vsie-accent">
                  <span className="sr-only">Open main menu</span>
                  {open ? <XMarkIcon className="h-6 w-6" /> : <Bars3Icon className="h-6 w-6" />}
                </Disclosure.Button>
              </div>
            </div>
          </div>

          <Disclosure.Panel className="md:hidden">
            <div className="space-y-1 px-6 pb-6 pt-2 bg-vsie-900/95">
              {nav.map((item) => (
                <Link key={item.name} href={item.href} className="block rounded-md px-3 py-2 text-base text-white hover:bg-white/10">
                  {item.name}
                </Link>
              ))}
              <Link href="#apply" className="block rounded-md px-3 py-2 text-base bg-vsie-accent text-white font-medium">Apply now</Link>
            </div>
          </Disclosure.Panel>
        </>
      )}
    </Disclosure>
  )
}
