# TuTurno

Sistema de **filas virtuales** para negocios pequeños (peluquerías, consultorios, notarías…).
El cliente toma turno escaneando un QR —sin instalar nada— y ve su posición en tiempo real desde el celular.
El negocio tiene un panel para llamar al siguiente, marcar ausentes y ver estadísticas.

**Stack (100 % capa gratuita):** Next.js 15 (App Router) + TypeScript · Tailwind CSS 3 · Supabase (Postgres + Auth + Realtime) · `qrcode` · Zod · Vitest · Vercel.

---

## 1. Puesta en marcha (≈ 10 minutos)

**Requisitos:** Node.js 20 o superior (LTS) y una cuenta gratuita en [supabase.com](https://supabase.com).

### Paso 1 · Crear el proyecto en Supabase
1. En Supabase: **New project** (guarda la contraseña de la base de datos; no la usaremos en la app).
2. Espera a que termine de crearse.

### Paso 2 · Crear las tablas y funciones
1. Abre **SQL Editor → New query**.
2. Pega **todo** el contenido de [`supabase/schema.sql`](supabase/schema.sql) y pulsa **Run**. Debe terminar en *Success*.
   Es re-ejecutable: si lo corres otra vez no pierdes datos.
3. Verifica Realtime: **Database → Publications → supabase_realtime** debe incluir la tabla `queue_state`
   (el script la agrega solo; si no aparece, actívala a mano en esa pantalla).

### Paso 3 · Configurar el registro de usuarios
**Authentication → Sign In / Providers → Email:**
- Para **desarrollo**, desactiva *Confirm email* (así entras al panel apenas te registras).
- Para **producción**, déjalo activado y, en **Authentication → URL Configuration**, agrega tu dirección en *Site URL* y en *Redirect URLs* (`https://tu-app.vercel.app/**` y `http://localhost:3000/**`).
  La app ya trae la ruta `/auth/callback` para el enlace del correo.

> Los nombres exactos de los menús pueden variar un poco: Supabase actualiza su panel con frecuencia.

### Paso 4 · Variables de entorno
1. En Supabase: **Project Settings → API** (o *API Keys*) y copia la **Project URL** y la clave **anon** (o *publishable*).
2. Copia el archivo de ejemplo y complétalo:
   ```bash
   cp .env.example .env.local        # en Windows (CMD): copy .env.example .env.local
   ```
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...   # o sb_publishable_...
   ```
   ⚠️ **Nunca** pongas aquí la clave `service_role` / `secret`. La app no la necesita y, si la expones, cualquiera podría saltarse toda la seguridad.

### Paso 5 · Ejecutar
```bash
npm install
npm run dev
```
Abre <http://localhost:3000>.

### Probar el flujo completo (3 minutos)
1. **Registro:** *Registrar mi negocio* → crea la cuenta → llegas al panel.
2. **Cliente:** en el panel, pulsa **Copiar enlace** y ábrelo en otra pestaña (mejor en modo incógnito o en tu celular) → escribe un nombre, acepta y *Tomar mi turno*. Repite con 2–3 "clientes" (ventanas de incógnito distintas).
3. **Panel:** pulsa **Llamar siguiente**. En la pestaña del cliente, el estado cambia solo (y suena el aviso si activaste los avisos).
4. **Pantalla pública:** pulsa **Pantalla pública** en el panel (pensada para un TV o tablet). Solo muestra números.
5. **QR:** pulsa **Código QR** para descargarlo o imprimir el afiche.

### Probar con tu celular (misma red Wi-Fi)
```bash
npm run dev:lan
```
Abre el panel desde el computador usando **`http://TU-IP-LOCAL:3000`** (no `localhost`) para que el QR apunte a esa dirección.
Si no conecta, revisa el firewall de tu sistema operativo.
Sobre `http://IP-local` las **notificaciones del sistema no están disponibles** (los navegadores las exigen sobre HTTPS); sí funcionan el aviso en pantalla, la vibración y el sonido. Con la app desplegada (HTTPS) funciona todo.

---

## 2. Despliegue en Vercel (gratis)
1. Sube el proyecto a GitHub (`.env.local` **no** se sube: está en `.gitignore`).
2. En [vercel.com](https://vercel.com): **Add New → Project** → importa el repositorio.
3. En *Environment Variables* agrega `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. **Deploy.** Luego agrega la URL final en Supabase (*Site URL* / *Redirect URLs*, paso 3).
5. Descarga el QR **desde la dirección pública** (no desde localhost) para imprimirlo.

> Las variables `NEXT_PUBLIC_*` se incrustan en el *build*: si las cambias, vuelve a desplegar (o reinicia `npm run dev`).

---

## 3. Pruebas

| Comando | Qué prueba |
|---|---|
| `npm test` | 38 pruebas: validaciones, mensajes de error, lógica de avisos, y los componentes de React (flujo del cliente, panel, errores). |
| `npm run typecheck` | TypeScript estricto. |
| `npm run build` | Build de producción. |
| `./tests-sql/run.sh` | 60 pruebas de seguridad y lógica de la base de datos + concurrencia. Ver abajo. |

**Pruebas SQL** (`tests-sql/`): corren `schema.sql` contra un PostgreSQL local desechable y ejecutan cada llamada con los roles reales `anon` y `authenticated`. Comprueban, entre otras cosas: que un anónimo no puede leer `tickets`; que un negocio no puede ver ni tocar los turnos de otro; que nadie puede ponerse plan *pro*; que la pantalla pública no filtra nombres; el flujo llamar/atender/ausente; el límite diario; y que **25 clientes escaneando a la vez reciben 1000 números distintos sin huecos**, y que con límite 30 y 200 intentos simultáneos se emiten exactamente 30.
```bash
PGHOST=localhost PGUSER=postgres PGPASSWORD=tu_clave ./tests-sql/run.sh   # Linux/macOS/WSL
```
Requiere `psql` (y `pgbench` para la parte de concurrencia). **Crea y borra la base `tuturno_test`**: nunca la apuntes a una base real.

---

## 4. Seguridad: cómo está protegido

- **RLS activo en todas las tablas y cero escrituras directas.** El navegador nunca hace `insert/update/delete` sobre tablas: todo pasa por funciones SQL (`SECURITY DEFINER`) que validan la entrada.
- **Aislamiento entre negocios.** Cada función del panel comprueba en la base de datos que `auth.uid()` sea el dueño del negocio; no depende del frontend.
- **Rol/plan no manipulables.** El dueño no puede cambiar su `plan` ni su `daily_limit`. El límite del plan gratuito se aplica **en el servidor**, atómicamente.
- **Clientes sin cuenta.** Solo pueden ver *su* turno mediante un token aleatorio (UUID) y jamás leen la tabla de turnos. La pantalla pública devuelve **solo números**.
- **Mínimo privilegio.** Las funciones se revocan de `PUBLIC/anon` y se otorgan una por una; las internas no son invocables desde la API.
- **Sesión.** El servidor valida con `getUser()` (no `getSession()`) y `/panel` se verifica en el middleware **y otra vez** en cada página. Si Supabase no responde, se trata como no autenticado.
- **Sin `service_role` en la app.** Solo se usa la clave pública.
- **Cabeceras HTTP** (`X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`) y validación de entrada con Zod en el cliente **y** restricciones `CHECK` en la base.
- **Dependencias:** `npm audit` sin vulnerabilidades al momento de entregar (se fuerza `postcss` ≥ 8.5.28 con `overrides`).
- **Datos personales (Ley 1581):** casilla de autorización obligatoria (queda registrada en `consent_at`), celular opcional, aviso de privacidad en `/privacidad` y función `purge_old_tickets(dias)` para borrar turnos antiguos (ver el ejemplo de `pg_cron` al final de `schema.sql`).

### Límites conocidos (léelos antes de usarlo con clientes reales)
- **No hay anti-spam en el ingreso a la fila.** Alguien malintencionado podría llenar el cupo diario de un negocio con nombres falsos. Mitigaciones actuales: un turno activo por celular y el tope diario. Siguiente paso recomendado: CAPTCHA (p. ej. Cloudflare Turnstile) o limitación por IP.
- `queue_state` es legible por cualquiera (contiene solo `business_id` y una marca de tiempo) para que Realtime funcione sin exponer datos personales. Revela que un negocio existe y cuándo tuvo actividad, nada más.
- Los avisos funcionan **solo con la pestaña/navegador abiertos** (no hay notificaciones push con la app cerrada). Es un "mejor esfuerzo" que depende del navegador y del sistema operativo.
- El texto de `/privacidad` es una plantilla razonable, **no asesoría legal**: revísalo antes de un uso comercial.
- Contraseñas: la app exige mínimo 8 caracteres; ajusta la política en *Authentication* de Supabase si quieres algo más estricto.
- El plan gratuito de Supabase pausa proyectos inactivos y tiene respaldos limitados; considéralo para un uso real.

---

## 5. Estructura

```
supabase/schema.sql        Tablas, RLS, funciones SQL y permisos (el corazón de la seguridad)
tests-sql/                 Pruebas de la base de datos (roles, RLS, lógica, concurrencia)
tests/                     Pruebas unitarias y de componentes (Vitest)
public/sw.js               Service worker mínimo para notificaciones en Android
src/middleware.ts          Protege /panel y refresca la sesión
src/lib/                   Validaciones (Zod), errores amigables, avisos, clientes de Supabase, hook Realtime
src/components/            JoinForm, TicketView, PanelClient, PublicBoard, Poster…
src/app/
  page.tsx                 Inicio
  login, registro          Acceso de administradores
  panel, panel/afiche      Panel del negocio y QR imprimible (protegidos)
  n/[slug]                 El cliente toma turno (destino del QR)
  t/[token]                El cliente ve su turno en tiempo real
  pantalla/[slug]          Pantalla pública para TV/tablet
  privacidad               Aviso de privacidad
```

## 6. Trazabilidad de requisitos

Los códigos RF/RNF de esta tabla y de los comentarios del código corresponden a mi lectura del documento del proyecto;
**verifica que coincidan con tu numeración** antes de citarlos.

| Requisito | Dónde se implementa |
|---|---|
| RF01 Registro del negocio | `RegisterForm`, `CreateBusinessForm`, `register_business()` |
| RF02 QR del negocio (descargar/imprimir) | `Poster`, `/panel/afiche` |
| RF03 Cliente toma turno sin app | `/n/[slug]`, `JoinForm`, `join_queue()` |
| RF04 Ver posición en tiempo real | `/t/[token]`, `TicketView`, `get_ticket_status()`, `useQueueSync` |
| RF05 Llamar siguiente | `PanelClient`, `call_next()` |
| RF06 Marcar atendido / ausente | `resolve_ticket()`, `call_next(p_resolve_current)` |
| RF07 Pantalla pública | `/pantalla/[slug]`, `get_public_board()` |
| RF08 Aviso de proximidad | `lib/notify.ts`, `lib/browser-alerts.ts`, `public/sw.js` |
| RF09 Estadísticas del día | `get_admin_snapshot()`, tarjetas del panel |
| RF10 Límite del plan gratuito | `_create_ticket()` (servidor), `get_join_info().accepting` |
| RNF03 Actualización ≤ 3 s | Realtime + *fallback* de sondeo cada 3 s (`useQueueSync`) |
| RNF04 Sin turnos duplicados | Bloqueo por negocio + `UNIQUE (negocio, día, número)`; probado con `pgbench` |
| RNF05 Aislamiento entre negocios | RLS + comprobación de dueño en cada función; probado en `tests-sql/` |
| RNF06 Datos mínimos | Solo nombre (+ celular opcional); pantalla pública solo con números |
| RNF07 Usabilidad/accesibilidad | Mobile-first, objetivos táctiles de 44 px, etiquetas, foco visible, `aria-live` |

**Fuera de alcance (MVP):** varias sedes o módulos por negocio, pagos del plan Pro, SMS/WhatsApp, notificaciones push con la app cerrada.
