// The paths anyone may open without signing in; proxy.ts sends every other
// signed-out request to /login. /plancy/* holds plancy's privacy and support
// pages, which the App Store links to, so they must open for anyone.
export function isPublicPath(pathname: string): boolean {
  return (
    pathname === '/' ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/signup') ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/s/') ||
    pathname.startsWith('/i/') ||
    pathname === '/plancy' ||
    pathname.startsWith('/plancy/')
  )
}
