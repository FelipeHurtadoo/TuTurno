import Link from 'next/link'
import Logo from '@/components/Logo'
import { formatCOP, PLANS } from '@/lib/plans'

const steps = [
  { n: '1', title: 'Escanea', text: 'El cliente escanea el QR que pegaste en tu entrada. No instala nada.' },
  { n: '2', title: 'Espera donde quiera', text: 'Ve su posición en tiempo real y sigue con su día mientras llega su turno.' },
  { n: '3', title: 'Recibe el aviso', text: 'Le avisamos en su celular cuando falten pocas personas.' },
]

const benefits = [
  'Sin aplicación para el cliente ni equipos extra para ti.',
  'Panel simple: llamar siguiente, marcar ausente, ver estadísticas del día.',
  'Pantalla pública para TV o tablet con el turno en atención.',
  'Gratis para empezar. Pasa al plan Pro solo si creces.',
]

const comparison: Array<[string, string | boolean, string | boolean]> = [
  ['Precio mensual', formatCOP(PLANS.free.price), `${formatCOP(PLANS.pro.price)} COP`],
  ['Turnos por día', 'Hasta 30', 'Ilimitados'],
  ['Código QR y afiche', true, true],
  ['Fila en tiempo real y avisos al cliente', true, true],
  ['Panel de atención', true, true],
  ['Pantalla pública (TV / tablet)', true, true],
  ['Logo de tu negocio', true, true],
  ['Estadísticas del día', true, true],
  ['Soporte prioritario', false, true],
]

function cell(v: string | boolean) {
  if (v === true) return <span className="font-bold text-emerald-700" aria-label="Incluido">✔</span>
  if (v === false) return <span className="text-slate-400" aria-label="No incluido">—</span>
  return <span className="font-semibold">{v}</span>
}

export default function Home() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
        <Logo />
        <nav className="flex items-center gap-2" aria-label="Cuenta">
          <a href="#planes" className="btn btn-secondary hidden md:inline-flex">Planes</a>
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

        <section id="planes" className="scroll-mt-6 bg-slate-100/70 px-4 py-16" aria-labelledby="plans">
          <div className="mx-auto max-w-5xl">
            <h2 id="plans" className="text-center text-2xl font-bold sm:text-3xl">Planes y precios</h2>
            <p className="mx-auto mt-2 max-w-xl text-center text-slate-700">
              Empieza gratis y cámbiate a Pro cuando tu fila lo necesite. Puedes solicitar el cambio desde tu panel en cualquier momento.
            </p>

            <div className="mt-10 grid gap-6 md:grid-cols-2">
              {[PLANS.free, PLANS.pro].map((plan) => {
                const pro = plan.id === 'pro'
                return (
                  <article
                    key={plan.id}
                    className={`relative flex flex-col rounded-2xl p-6 shadow-sm sm:p-8 ${
                      pro ? 'bg-indigo-700 text-white ring-2 ring-indigo-700' : 'bg-white ring-1 ring-slate-200'
                    }`}
                    aria-labelledby={`plan-${plan.id}`}
                  >
                    {pro && (
                      <span className="absolute -top-3 right-6 rounded-full bg-amber-300 px-3 py-1 text-xs font-bold uppercase tracking-wide text-amber-950">
                        Recomendado si creces
                      </span>
                    )}
                    <h3 id={`plan-${plan.id}`} className="text-xl font-bold">Plan {plan.name}</h3>
                    <p className={`mt-1 text-sm ${pro ? 'text-indigo-100' : 'text-slate-600'}`}>{plan.tagline}</p>
                    <p className="mt-6 flex items-baseline gap-2">
                      <span className="text-4xl font-extrabold tracking-tight sm:text-5xl">{formatCOP(plan.price)}</span>
                      <span className={`text-sm ${pro ? 'text-indigo-100' : 'text-slate-600'}`}>
                        {plan.price > 0 ? 'COP ' : ''}{plan.period}
                      </span>
                    </p>
                    <ul className="mt-6 flex-1 space-y-3">
                      {plan.features.map((f) => (
                        <li key={f} className="flex items-start gap-3">
                          <span aria-hidden="true" className={pro ? 'text-amber-300' : 'text-emerald-700'}>✔</span>
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                    <Link
                      href="/registro"
                      className={`btn mt-8 w-full text-base ${pro ? 'bg-white text-indigo-800 hover:bg-indigo-50' : 'btn-primary'}`}
                    >
                      {pro ? 'Empezar y pasarme a Pro' : 'Crear mi cuenta gratis'}
                    </Link>
                  </article>
                )
              })}
            </div>

            <div className="card mt-10 overflow-x-auto !p-0">
              <table className="w-full min-w-[480px] text-left text-sm">
                <caption className="sr-only">Comparación de planes</caption>
                <thead>
                  <tr className="border-b border-slate-200">
                    <th scope="col" className="px-5 py-3 font-semibold">Qué incluye</th>
                    <th scope="col" className="px-5 py-3 text-center font-semibold">Gratuito</th>
                    <th scope="col" className="px-5 py-3 text-center font-semibold text-indigo-800">Pro</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {comparison.map(([label, free, pro]) => (
                    <tr key={label}>
                      <th scope="row" className="px-5 py-3 font-medium">{label}</th>
                      <td className="px-5 py-3 text-center">{cell(free)}</td>
                      <td className="px-5 py-3 text-center">{cell(pro)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-center text-xs text-slate-600">
              El plan Pro se paga por transferencia. Al solicitarlo desde tu panel te contactamos para coordinar el pago y lo activamos.
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 py-6 text-center text-sm text-slate-600">
        TuTurno · Proyecto académico, Universidad del Quindío ·{' '}
        <Link href="/privacidad" className="underline">Aviso de privacidad</Link>
      </footer>
    </div>
  )
}
