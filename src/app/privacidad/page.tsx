import type { Metadata } from 'next'
import Link from 'next/link'
import Logo from '@/components/Logo'

export const metadata: Metadata = { title: 'Aviso de privacidad · TuTurno' }

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-6"><Logo /></div>
      <article className="card space-y-4 leading-relaxed">
        <h1 className="text-2xl font-bold">Aviso de privacidad</h1>
        <p className="text-sm text-slate-600">
          En cumplimiento de la Ley Estatutaria 1581 de 2012 sobre protección de datos personales.
        </p>

        <h2 className="text-lg font-bold">¿Quién es el responsable?</h2>
        <p>
          El responsable del tratamiento de tus datos es el <strong>negocio donde tomas tu turno</strong>.
          TuTurno es la plataforma tecnológica que le permite gestionar su fila y actúa como encargado del tratamiento.
        </p>

        <h2 className="text-lg font-bold">¿Qué datos recolectamos?</h2>
        <ul className="list-disc space-y-1 pl-6">
          <li><strong>Tu nombre</strong> (obligatorio), para que el negocio sepa a quién llamar.</li>
          <li><strong>Tu celular</strong> (opcional), solo si quieres que el negocio pueda contactarte.</li>
          <li>La hora de tu turno y su estado (en espera, atendido, ausente o cancelado).</li>
        </ul>
        <p>No recolectamos documento de identidad, ubicación ni ningún otro dato.</p>

        <h2 className="text-lg font-bold">¿Para qué los usamos?</h2>
        <p>
          Únicamente para gestionar tu turno, avisarte cuando se acerque y generar estadísticas de atención del negocio
          (por ejemplo, cuántas personas se atendieron y cuánto tiempo se esperó en promedio).
          No vendemos ni compartimos tus datos con terceros.
        </p>

        <h2 className="text-lg font-bold">¿Quién los puede ver?</h2>
        <p>
          Solo el negocio donde tomaste tu turno. La pantalla pública del local muestra <strong>únicamente números de turno</strong>,
          nunca nombres ni celulares.
        </p>

        <h2 className="text-lg font-bold">¿Cuánto tiempo se conservan?</h2>
        <p>Solo el tiempo necesario para operar la fila y generar las estadísticas del negocio.</p>

        <h2 className="text-lg font-bold">Tus derechos</h2>
        <p>
          Como titular puedes conocer, actualizar, rectificar y solicitar la supresión de tus datos, o revocar tu autorización.
          Para ejercer estos derechos, comunícate con el negocio donde tomaste tu turno.
        </p>
        <p>Tomar un turno es voluntario: al marcar la casilla de autorización aceptas este tratamiento.</p>

        <Link href="/" className="btn btn-secondary">← Volver al inicio</Link>
      </article>
    </main>
  )
}
