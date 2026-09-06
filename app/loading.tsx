import { RouteLoader } from '@/components/BrandLoader'

// Root loading boundary. App Router inherits this into every segment that
// doesn't define its own, so one file covers pipeline, clients, records, crm,
// tasks, calendar, broadcasts, people, team, sites, stages, notifications,
// login, signup and the landing page. Public client sites override it in
// app/s/loading.tsx with an unbranded loader.
export default function Loading() {
  return <RouteLoader />
}
