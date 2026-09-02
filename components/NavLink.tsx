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

export const ICONS = {
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

export type NavIcon = keyof typeof ICONS

export type NavItem = {
  href: string
  label: string
  icon: NavIcon
  external?: boolean
}

export function useNavActive(href: string, external = false) {
  const pathname = usePathname()
  return !external && (pathname === href || pathname.startsWith(`${href}/`))
}

export function NavLink({
  href,
  label,
  icon,
  external = false,
}: {
  href: string
  label: string
  icon: NavIcon
  external?: boolean
}) {
  const active = useNavActive(href, external)
  const Icon = ICONS[icon]
  const className = `flex shrink-0 items-center gap-1.5 border-b-2 pb-0.5 transition-colors ${
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
