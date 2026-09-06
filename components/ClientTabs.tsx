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
    <nav className="-mx-4 mb-6 flex gap-4 overflow-x-auto border-b border-ash/60 px-4 text-sm sm:mx-0 sm:px-0">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          className={
            tab.key === active
              ? 'shrink-0 whitespace-nowrap border-b-2 border-violet pb-2 font-medium'
              : 'shrink-0 whitespace-nowrap pb-2 text-ivory/60 hover:text-ivory'
          }
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  )
}
