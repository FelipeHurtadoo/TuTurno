import Link from 'next/link'
import Logo from '@/components/Logo'

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10 text-center">
      <div className="mb-6 flex justify-center"><Logo /></div>
      <div className="card">
        <h1 className="text-xl font-bold">No encontramos esta página</h1>
        <p className="mt-2 text-slate-600">
          Si escaneaste un código QR, verifica que sea el del negocio correcto o pídele al negocio que te lo muestre de nuevo.
        </p>
        <Link href="/" className="btn btn-primary mt-5 w-full">Ir al inicio</Link>
      </div>
    </main>
  )
}
