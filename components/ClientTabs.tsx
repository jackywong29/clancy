import Link from 'next/link'

export function ClientTabs({
  clientId,
  active,
}: {
  clientId: string
  active: 'details' | 'intake' | 'brief'
}) {
  const tabs = [
    { key: 'details', label: 'Details', href: `/clients/${clientId}` },
    { key: 'intake', label: 'Intake', href: `/clients/${clientId}/intake` },
    { key: 'brief', label: 'Build brief', href: `/clients/${clientId}/brief` },
  ]

  return (
    <nav className="mb-6 flex gap-4 border-b border-mist/50 text-sm">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          className={
            tab.key === active
              ? 'border-b-2 border-violet pb-2 font-medium'
              : 'pb-2 text-graphite/60 hover:text-graphite'
          }
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  )
}
