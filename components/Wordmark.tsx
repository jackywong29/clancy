export function Wordmark({ size = 'text-xl' }: { size?: string }) {
  return (
    <span className={`font-medium tracking-tight ${size}`}>
      clancy<span className="text-violet">.</span>
    </span>
  )
}
