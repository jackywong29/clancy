'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState, type ReactNode } from 'react'
import { Menu, X } from 'lucide-react'
import { ICONS, type NavItem } from '@/components/NavLink'

export function MobileNav({
  items,
  footer,
}: {
  items: NavItem[]
  footer?: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        aria-expanded={open}
        className="-ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-ash/60 text-ivory/70 hover:text-ivory lg:hidden"
      >
        <Menu size={18} aria-hidden />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 h-full w-full cursor-default bg-black/60"
          />
          <div className="absolute inset-y-0 left-0 flex w-[min(19rem,85vw)] flex-col border-r border-ash/60 bg-graphite shadow-2xl">
            <div className="flex items-center justify-between border-b border-ash/60 px-4 py-3">
              <span className="text-sm font-medium text-ivory/60">Menu</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-ash/60 text-ivory/70 hover:text-ivory"
              >
                <X size={18} aria-hidden />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto p-3">
              {items.map((item) => {
                const Icon = ICONS[item.icon]
                const active =
                  !item.external &&
                  (pathname === item.href ||
                    pathname.startsWith(`${item.href}/`))
                const className = `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                  active
                    ? 'bg-violet/15 font-medium text-ivory'
                    : 'text-ivory/70 hover:bg-carbon hover:text-ivory'
                }`
                if (item.external) {
                  return (
                    <a
                      key={item.href}
                      href={item.href}
                      target="_blank"
                      className={className}
                      onClick={() => setOpen(false)}
                    >
                      <Icon size={17} aria-hidden />
                      {item.label}
                    </a>
                  )
                }
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={className}
                    onClick={() => setOpen(false)}
                  >
                    <Icon size={17} aria-hidden />
                    {item.label}
                  </Link>
                )
              })}
            </nav>

            {footer && (
              <div className="space-y-3 border-t border-ash/60 p-4">
                {footer}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
