import Link from 'next/link'

export function ClientTabs({
  clientId,
  active,
}: {
  clientId: string
  active: 'details' | 'intake' | 'brief' | 'crm-brief'
}) {
  const tabs = [
    { key: 'details', label: 'Details', href: `/clients/${clientId}` },
    { key: 'intake', label: 'Intake', href: `/clients/${clientId}/intake` },
    { key: 'brief', label: 'Website brief', href: `/clients/${clientId}/brief` },
    { key: 'crm-brief', label: 'CRM brief', href: `/clients/${clientId}/crm-brief` },
  ]

  return (
    <nav className="mb-6 flex gap-4 border-b border-ash/60 text-sm">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          className={
            tab.key === active
              ? 'border-b-2 border-violet pb-2 font-medium'
              : 'pb-2 text-ivory/60 hover:text-ivory'
          }
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  )
}
