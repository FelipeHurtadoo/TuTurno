'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * Mantiene una pantalla sincronizada con la fila (RNF03: cambios en ≤ 3 s).
 *  - Principal: Supabase Realtime (avisa al instante cuando cambia algo en el negocio).
 *  - Respaldo: si Realtime no está conectado, consulta cada 3 s; si lo está, cada 20 s de seguridad.
 *  - Además refresca al volver a la pestaña o recuperar internet (el celular suspende pestañas).
 * Devuelve true si Realtime está conectado.
 */
export function useQueueSync(businessId: string | null, refresh: () => void, enabled = true): boolean {
  const [connected, setConnected] = useState(false)
  const refreshRef = useRef(refresh)

  useEffect(() => {
    refreshRef.current = refresh
  }, [refresh])

  useEffect(() => {
    if (!businessId || !enabled) return
    const supabase = createClient()
    const channel = supabase
      .channel(`queue:${businessId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'queue_state', filter: `business_id=eq.${businessId}` },
        () => refreshRef.current()
      )
      .subscribe((status) => {
        const ok = status === 'SUBSCRIBED'
        setConnected(ok)
        if (ok) refreshRef.current() // cubre cambios ocurridos entre la carga y la suscripción
      })
    return () => {
      setConnected(false)
      void supabase.removeChannel(channel)
    }
  }, [businessId, enabled])

  useEffect(() => {
    if (!businessId || !enabled) return
    const interval = setInterval(() => refreshRef.current(), connected ? 20_000 : 3_000)
    const onWake = () => {
      if (document.visibilityState === 'visible') refreshRef.current()
    }
    document.addEventListener('visibilitychange', onWake)
    window.addEventListener('online', onWake)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onWake)
      window.removeEventListener('online', onWake)
    }
  }, [businessId, enabled, connected])

  return connected
}
