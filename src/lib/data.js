import events from '@/data/events.json'
import startups from '@/data/startups.json'

// Events
export function getAllEvents() {
  return events.sort((a, b) => new Date(a.date) - new Date(b.date))
}

export function getUpcomingEvents(limit = 3) {
  return getAllEvents().slice(0, limit)
}

export function getEventSlugs() {
  return events.map((e) => e.slug)
}

export function getEventBySlug(slug) {
  return events.find((e) => e.slug === slug)
}

// Startups
export function getAllStartups() {
  return startups
}

export function getFeaturedStartups(limit = 3) {
  return startups.slice(0, limit)
}

export function getStartupSlugs() {
  return startups.map((s) => s.slug)
}

export function getStartupBySlug(slug) {
  return startups.find((s) => s.slug === slug)
}
