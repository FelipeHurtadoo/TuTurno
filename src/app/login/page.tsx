import type { Metadata } from 'next'
import AuthShell from '@/components/AuthShell'
import LoginForm from '@/components/LoginForm'

export const metadata: Metadata = { title: 'Iniciar sesión · TuTurno' }

export default function LoginPage() {
  return (
    <AuthShell title="Inicia sesión" subtitle="Accede al panel de tu negocio.">
      <LoginForm />
    </AuthShell>
  )
}
