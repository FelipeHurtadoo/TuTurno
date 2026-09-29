import type { Metadata } from 'next'
import AuthShell from '@/components/AuthShell'
import RegisterForm from '@/components/RegisterForm'

export const metadata: Metadata = { title: 'Registrar negocio · TuTurno' }

export default function RegistroPage() {
  return (
    <AuthShell title="Registra tu negocio" subtitle="Es gratis y toma menos de un minuto.">
      <RegisterForm />
    </AuthShell>
  )
}
