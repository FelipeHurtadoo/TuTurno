// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// ---- Mock de Supabase: rpc() programable + canal Realtime que podemos disparar a mano ----
const rpcMock = vi.fn()
const realtime: { onChange: (() => void) | null } = { onChange: null }

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    rpc: (...args: unknown[]) => rpcMock(...args),
    auth: { signOut: vi.fn() },
    channel: () => {
      const ch = {
        on: (_type: string, _filter: unknown, cb: () => void) => {
          realtime.onChange = cb
          return ch
        },
        subscribe: (cb?: (s: string) => void) => {
          cb?.('SUBSCRIBED')
          return ch
        },
      }
      return ch
    },
    removeChannel: vi.fn(),
  }),
}))

const router = { push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }
vi.mock('next/navigation', () => ({ useRouter: () => router }))

const alerts = vi.hoisted(() => ({
  vibrate: vi.fn(),
  beep: vi.fn(),
  showSystemNotification: vi.fn(),
  unlockAudio: vi.fn(),
  enableNotifications: vi.fn(),
  getNotifState: vi.fn(() => 'default'),
}))
vi.mock('@/lib/browser-alerts', () => alerts)

import TicketView from '@/components/TicketView'
import JoinForm from '@/components/JoinForm'
import PanelClient from '@/components/PanelClient'
import type { AdminSnapshot } from '@/lib/types'

const TOKEN = '3f2b8c1e-9a4d-4e6b-8c1f-0a1b2c3d4e5f'
const ticket = (over: Record<string, unknown>) => ({
  found: true, expired: false, status: 'waiting', number: 7, customer_name: 'Laura',
  business_id: 'b1', business_name: 'Peluquería Ana', business_slug: 'pelu-ana',
  now_serving: 3, people_ahead: 5, estimated_wait_seconds: null, ...over,
})
const reply = (data: unknown) => Promise.resolve({ data, error: null })

beforeEach(() => {
  rpcMock.mockReset()
  Object.values(alerts).forEach((f) => f.mockClear())
  Object.values(router).forEach((f) => f.mockClear())
  realtime.onChange = null
  localStorage.clear()
})
afterEach(cleanup)

describe('TicketView · flujo del cliente (RF04, RF08)', () => {
  it('avisa una sola vez cuando se acerca y otra cuando lo llaman', async () => {
    rpcMock.mockImplementation(() => reply(ticket({ people_ahead: 5 })))
    render(<TicketView token={TOKEN} />)

    expect(await screen.findByText('Faltan 5 personas antes de ti')).toBeTruthy()
    expect(alerts.vibrate).not.toHaveBeenCalled()

    // Realtime avisa: ahora faltan 2 → aviso "se acerca"
    rpcMock.mockImplementation(() => reply(ticket({ people_ahead: 2 })))
    await act(async () => realtime.onChange?.())
    expect(await screen.findByText('Faltan 2 personas antes de ti')).toBeTruthy()
    expect(screen.getByText(/Tu turno se acerca/)).toBeTruthy()
    expect(alerts.vibrate).toHaveBeenCalledTimes(1)
    expect(alerts.showSystemNotification).toHaveBeenLastCalledWith('Tu turno se acerca', expect.stringContaining('Turno 7'), expect.any(String))

    // Faltan 1 → NO se repite el aviso
    rpcMock.mockImplementation(() => reply(ticket({ people_ahead: 1 })))
    await act(async () => realtime.onChange?.())
    expect(await screen.findByText('Falta 1 persona antes de ti')).toBeTruthy()
    expect(alerts.vibrate).toHaveBeenCalledTimes(1)

    // Lo llaman → aviso "es tu turno"
    rpcMock.mockImplementation(() => reply(ticket({ status: 'called', people_ahead: 0 })))
    await act(async () => realtime.onChange?.())
    expect(await screen.findByText(/¡Es tu turno! Acércate a Peluquería Ana/)).toBeTruthy()
    expect(alerts.vibrate).toHaveBeenCalledTimes(2)
    expect(alerts.showSystemNotification).toHaveBeenLastCalledWith('¡Es tu turno!', expect.any(String), expect.any(String))

    // Lo atienden → pantalla final con opción de nuevo turno
    rpcMock.mockImplementation(() => reply(ticket({ status: 'attended' })))
    await act(async () => realtime.onChange?.())
    expect(await screen.findByText(/Atención finalizada/)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Tomar un nuevo turno' }).getAttribute('href')).toBe('/n/pelu-ana')
    expect(screen.queryByText('Salir de la fila')).toBeNull()
  })

  it('muestra "turno no encontrado" con un token desconocido', async () => {
    rpcMock.mockImplementation(() => reply({ found: false }))
    render(<TicketView token={TOKEN} />)
    expect(await screen.findByText('Turno no encontrado')).toBeTruthy()
  })

  it('un turno de otro día se muestra como vencido y no dispara avisos', async () => {
    rpcMock.mockImplementation(() => reply(ticket({ expired: true, people_ahead: 0 })))
    render(<TicketView token={TOKEN} />)
    expect(await screen.findByText('Este turno era de otro día')).toBeTruthy()
    expect(alerts.vibrate).not.toHaveBeenCalled()
  })

  it('salir de la fila pide confirmación y llama a cancel_my_ticket', async () => {
    rpcMock.mockImplementation((fn: string) => reply(fn === 'get_ticket_status' ? ticket({}) : { cancelled: true }))
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<TicketView token={TOKEN} />)
    fireEvent.click(await screen.findByText('Salir de la fila'))
    await waitFor(() => expect(rpcMock).toHaveBeenCalledWith('cancel_my_ticket', { p_token: TOKEN }))
    confirmSpy.mockRestore()
  })
})

describe('JoinForm · ingreso del cliente (RF03)', () => {
  it('exige aceptar el tratamiento de datos antes de llamar al servidor', async () => {
    render(<JoinForm slug="pelu-ana" businessName="Peluquería Ana" accepting />)
    fireEvent.change(await screen.findByLabelText('Tu nombre'), { target: { value: 'Laura' } })
    fireEvent.click(screen.getByRole('button', { name: 'Tomar mi turno' }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/tratamiento de datos/)
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('envía nombre, celular, dispositivo y consentimiento, y lleva al turno', async () => {
    rpcMock.mockImplementation(() => reply({ id: 'x', number: 4, token: TOKEN, already_had: false }))
    render(<JoinForm slug="pelu-ana" businessName="Peluquería Ana" accepting />)
    fireEvent.change(await screen.findByLabelText('Tu nombre'), { target: { value: '  Laura ' } })
    fireEvent.change(screen.getByLabelText(/Celular/), { target: { value: '300 123 4567' } })
    fireEvent.click(screen.getByLabelText(/Autorizo el tratamiento/))
    fireEvent.click(screen.getByRole('button', { name: 'Tomar mi turno' }))

    await waitFor(() => expect(router.push).toHaveBeenCalledWith(`/t/${TOKEN}`))
    expect(rpcMock).toHaveBeenCalledWith('join_queue', expect.objectContaining({
      p_slug: 'pelu-ana', p_name: 'Laura', p_phone: '300 123 4567', p_consent: true,
      p_device: expect.stringMatching(/^[0-9a-f-]{36}$/),
    }))
    expect(localStorage.getItem('tuturno:ticket:pelu-ana')).toBe(TOKEN)
  })

  it('muestra el error amigable cuando se alcanzó el límite diario', async () => {
    rpcMock.mockImplementation(() => Promise.resolve({ data: null, error: { message: 'LIMITE_DIARIO' } }))
    render(<JoinForm slug="pelu-ana" businessName="Peluquería Ana" accepting />)
    fireEvent.change(await screen.findByLabelText('Tu nombre'), { target: { value: 'Laura' } })
    fireEvent.click(screen.getByLabelText(/Autorizo el tratamiento/))
    fireEvent.click(screen.getByRole('button', { name: 'Tomar mi turno' }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/límite de turnos de hoy/)
    expect(router.push).not.toHaveBeenCalled()
  })

  it('si el celular ya tiene un turno activo, redirige a él en vez de mostrar el formulario', async () => {
    localStorage.setItem('tuturno:ticket:pelu-ana', TOKEN)
    rpcMock.mockImplementation(() => reply(ticket({ status: 'waiting' })))
    render(<JoinForm slug="pelu-ana" businessName="Peluquería Ana" accepting />)
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith(`/t/${TOKEN}`))
  })

  it('con un turno viejo ya finalizado, limpia el token y muestra el formulario', async () => {
    localStorage.setItem('tuturno:ticket:pelu-ana', TOKEN)
    rpcMock.mockImplementation(() => reply(ticket({ status: 'attended' })))
    render(<JoinForm slug="pelu-ana" businessName="Peluquería Ana" accepting />)
    expect(await screen.findByLabelText('Tu nombre')).toBeTruthy()
    expect(localStorage.getItem('tuturno:ticket:pelu-ana')).toBeNull()
  })

  it('si el negocio no acepta más turnos, no muestra el formulario', () => {
    render(<JoinForm slug="pelu-ana" businessName="Peluquería Ana" accepting={false} />)
    return screen.findByText(/alcanzó su límite de turnos de hoy/).then((el) => expect(el).toBeTruthy())
  })
})

describe('PanelClient · panel del negocio (RF05, RF06, RF09)', () => {
  const business = { id: 'b1', name: 'Peluquería Ana', slug: 'pelu-ana', plan: 'free' as const, daily_limit: 30 }
  const mk = (over: Partial<AdminSnapshot['tickets'][number]>) => ({
    id: 'id-' + over.number, number: 1, customer_name: 'X', customer_phone: null, status: 'waiting' as const,
    source: 'qr' as const, created_at: '2026-09-28T15:00:00Z', called_at: null, finished_at: null, ...over,
  })
  const snapshot = (tickets: AdminSnapshot['tickets']): AdminSnapshot => ({
    stats: { issued: tickets.length, waiting: 2, called: 0, attended: 1, absent: 0, cancelled: 0, avg_wait_seconds: 600, plan: 'free', daily_limit: 30 },
    tickets,
  })

  it('muestra estadísticas y llama al siguiente con los parámetros correctos', async () => {
    const initial = snapshot([mk({ number: 1, customer_name: 'Ana', status: 'attended' }), mk({ number: 2, customer_name: 'Beto' }), mk({ number: 3, customer_name: 'Carla' })])
    rpcMock.mockImplementation((fn: string) => (fn === 'get_admin_snapshot' ? reply(initial) : Promise.resolve({ data: {}, error: null })))
    render(<PanelClient business={business} initial={initial} />)

    expect(screen.getByText('10 min')).toBeTruthy() // espera promedio
    expect(screen.getByText('3 / 30')).toBeTruthy() // turnos hoy / límite del plan gratuito
    expect(screen.getByText('Beto')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Llamar siguiente' }))
    await waitFor(() => expect(rpcMock).toHaveBeenCalledWith('call_next', { p_business_id: 'b1', p_resolve_current: null }))
  })

  it('con un turno en atención ofrece cerrar y llamar al siguiente en una sola acción', async () => {
    const initial = snapshot([mk({ number: 1, customer_name: 'Ana', status: 'called' }), mk({ number: 2, customer_name: 'Beto' })])
    rpcMock.mockImplementation((fn: string) => (fn === 'get_admin_snapshot' ? reply(initial) : Promise.resolve({ data: {}, error: null })))
    render(<PanelClient business={business} initial={initial} />)

    fireEvent.click(screen.getByRole('button', { name: /Atendido y llamar siguiente/ }))
    await waitFor(() => expect(rpcMock).toHaveBeenCalledWith('call_next', { p_business_id: 'b1', p_resolve_current: 'attended' }))
    fireEvent.click(screen.getByRole('button', { name: /Ausente y llamar siguiente/ }))
    await waitFor(() => expect(rpcMock).toHaveBeenCalledWith('call_next', { p_business_id: 'b1', p_resolve_current: 'absent' }))
  })

  it('traduce los errores de la base de datos a mensajes claros', async () => {
    const initial = snapshot([mk({ number: 2, customer_name: 'Beto' })])
    rpcMock.mockImplementation((fn: string) =>
      fn === 'get_admin_snapshot' ? reply(initial) : Promise.resolve({ data: null, error: { message: 'TURNO_EN_CURSO' } }))
    render(<PanelClient business={business} initial={initial} />)
    fireEvent.click(screen.getByRole('button', { name: 'Llamar siguiente' }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/Primero marca el turno actual/)
  })

  it('si la sesión expiró, envía al login', async () => {
    const initial = snapshot([mk({ number: 2, customer_name: 'Beto' })])
    rpcMock.mockImplementation((fn: string) =>
      fn === 'get_admin_snapshot' ? reply(initial) : Promise.resolve({ data: null, error: { message: 'NO_AUTENTICADO' } }))
    render(<PanelClient business={business} initial={initial} />)
    fireEvent.click(screen.getByRole('button', { name: 'Llamar siguiente' }))
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/login'))
  })
})
