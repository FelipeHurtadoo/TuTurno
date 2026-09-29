import Logo from './Logo'

export default function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-6 flex justify-center">
        <Logo />
      </div>
      <div className="card">
        <h1 className="text-xl font-bold">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-600">{subtitle}</p>}
        <div className="mt-5">{children}</div>
      </div>
    </main>
  )
}
