'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutGrid,
  Plus,
  SquareCheck,
  Calendar,
  Users,
  Columns3,
  Megaphone,
  Globe,
  PenLine,
  Settings2,
  BookUser,
  ExternalLink,
} from 'lucide-react'

const ICONS = {
  board: LayoutGrid,
  add: Plus,
  tasks: SquareCheck,
  calendar: Calendar,
  people: BookUser,
  stages: Columns3,
  broadcasts: Megaphone,
  sites: Globe,
  team: Users,
  edit: PenLine,
  customize: Settings2,
  view: ExternalLink,
} as const

export function NavLink({
  href,
  label,
  icon,
  external = false,
}: {
  href: string
  label: string
  icon: keyof typeof ICONS
  external?: boolean
}) {
  const pathname = usePathname()
  const active = !external && (pathname === href || pathname.startsWith(`${href}/`))
  const Icon = ICONS[icon]
  const className = `flex items-center gap-1.5 border-b-2 pb-0.5 transition-colors ${
    active
      ? 'border-violet font-medium text-ivory'
      : 'border-transparent text-ivory/60 hover:text-ivory'
  }`

  if (external) {
    return (
      <a href={href} target="_blank" className={className}>
        <Icon size={15} aria-hidden />
        {label}
      </a>
    )
  }
  return (
    <Link href={href} className={className}>
      <Icon size={15} aria-hidden />
      {label}
    </Link>
  )
}
