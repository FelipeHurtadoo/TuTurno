import Link from 'next/link'
import Logo from '@/components/Logo'

const steps = [
  { n: '1', title: 'Escanea', text: 'El cliente escanea el QR que pegaste en tu entrada. No instala nada.' },
  { n: '2', title: 'Espera donde quiera', text: 'Ve su posición en tiempo real y sigue con su día mientras llega su turno.' },
  { n: '3', title: 'Recibe el aviso', text: 'Le avisamos en su celular cuando falten pocas personas.' },
]

const benefits = [
  'Sin aplicación para el cliente ni equipos extra para ti.',
  'Panel simple: llamar siguiente, marcar ausente, ver estadísticas del día.',
  'Pantalla pública para TV o tablet con el turno en atención.',
  'Gratis para empezar. Pasa a un plan pago solo si creces.',
]

export default function Home() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
        <Logo />
        <nav className="flex items-center gap-2" aria-label="Cuenta">
          <Link href="/login" className="btn btn-secondary">Iniciar sesión</Link>
          <Link href="/registro" className="btn btn-primary hidden sm:inline-flex">Registrar mi negocio</Link>
        </nav>
      </header>

      <main>
        <section className="mx-auto max-w-3xl px-4 py-14 text-center">
          <h1 className="text-4xl font-extrabold leading-tight sm:text-5xl">
            Acaba con las filas en tu negocio
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-slate-700">
            Tus clientes toman turno con un código QR y ven su posición desde el celular.
            Tú atiendes con orden, sin aglomeraciones y con datos de tu atención.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/registro" className="btn btn-primary w-full text-base sm:w-auto">Crear mi cuenta gratis</Link>
            <Link href="/login" className="btn btn-secondary w-full text-base sm:w-auto">Ya tengo cuenta</Link>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-4 pb-14" aria-labelledby="how">
          <h2 id="how" className="mb-6 text-center text-2xl font-bold">Cómo funciona</h2>
          <ol className="grid gap-4 sm:grid-cols-3">
            {steps.map((s) => (
              <li key={s.n} className="card">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-700 font-bold text-white" aria-hidden="true">{s.n}</span>
                <h3 className="mt-3 text-lg font-bold">{s.title}</h3>
                <p className="mt-1 text-slate-700">{s.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mx-auto max-w-3xl px-4 pb-16" aria-labelledby="why">
          <h2 id="why" className="mb-4 text-center text-2xl font-bold">Pensado para negocios pequeños</h2>
          <ul className="space-y-2">
            {benefits.map((b) => (
              <li key={b} className="card flex items-start gap-3 !p-4">
                <span aria-hidden="true" className="text-emerald-700">✔</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <footer className="border-t border-slate-200 py-6 text-center text-sm text-slate-600">
        TuTurno · Proyecto académico, Universidad del Quindío ·{' '}
        <Link href="/privacidad" className="underline">Aviso de privacidad</Link>
      </footer>
    </div>
  )
}
