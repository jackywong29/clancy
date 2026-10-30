import Link from 'next/link'
import styles from './plancy.module.css'

// plancy's public pages (privacy, support), linked from its App Store listing.
// Public by isPublicPath (lib/public-paths.ts); the words come from the plancy
// repo, copied into content/plancy/ by its scripts/legal-pages.mjs.
export default function PlancyLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link href="/plancy/support" className={styles.wordmark}>
          plancy<span className={styles.dot}>.</span>
        </Link>
      </header>
      <main className={styles.main}>{children}</main>
      <footer className={styles.footer}>
        <nav aria-label="plancy">
          <Link href="/plancy/privacy">Privacy policy</Link>
          <Link href="/plancy/support">Support</Link>
          <a href="mailto:support@clancyhq.com">support@clancyhq.com</a>
        </nav>
        <p>© 2026 Clancy Sdn. Bhd. · Company registration no. 202501050621 (1652029-H)</p>
      </footer>
    </div>
  )
}
