import Link from 'next/link'

export default function Logo({ href = '/', dark = false }: { href?: string; dark?: boolean }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2 font-bold" aria-label="TuTurno, ir al inicio">
      <span
        aria-hidden="true"
        className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-700 text-sm font-extrabold text-white"
      >
        T
      </span>
      <span className={dark ? 'text-white' : 'text-slate-900'}>TuTurno</span>
    </Link>
  )
}
