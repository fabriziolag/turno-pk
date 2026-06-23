# 🚐 Turno PK · Organizador de furgón compartido

App web (PWA instalable) para organizar el **furgón compartido del colegio**: quién lleva a
los niños a su casa cada día, en qué orden, y avisar a los apoderados — todo compartido y
**en vivo** entre las familias.

## ✨ Qué hace

- **☀️ Hoy** — cada apoderado confirma si su hijo va, quién retira, y manda el plan del día
  por WhatsApp o lo agenda al calendario (.ics).
- **🗺️ Ruta** — orden de entrega óptimo en mapa (el hijo del conductor queda siempre al
  final), marcar "entregado" con aviso, y navegar con Waze.
- **📅 Turnos** — grilla semanal de quién va y quién conduce, bloqueo de semanas
  (vacaciones) y contador anual para repartir parejo.
- **👨‍👩‍👧 Familias** — ficha de cada niño y sus papás: fotos, direcciones geolocalizadas y
  contactos de entrega.
- **⚙️ Ajustes** — colegio (punto de partida), horarios de salida e invitados al turno.

## 🛠️ Stack

React 19 · Vite · TypeScript · Tailwind CSS v4 · Supabase (Auth + Postgres + Realtime) ·
Leaflet · PWA (vite-plugin-pwa). Deploy en Vercel.

## 🚀 Desarrollo

```bash
npm install
cp .env.example .env.local   # rellena con tus credenciales de Supabase
npm run dev
```

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción (typecheck + Vite) |
| `npm run preview` | Previsualiza el build |

## 🔐 Variables de entorno

Se configuran en `.env.local` (local) y en Vercel (producción):

- `VITE_SUPABASE_URL` — URL del proyecto Supabase.
- `VITE_SUPABASE_ANON_KEY` — llave pública (anon / publishable). Es segura en el cliente
  porque las tablas están protegidas con **RLS**; solo correos invitados pueden entrar.

> El esquema de la base vive en [`supabase/schema.sql`](supabase/schema.sql).

---

Sin Supabase configurado, la app corre en **modo local** (los datos quedan solo en el
dispositivo). Con Supabase, exige login por correo y sincroniza en vivo entre las familias.
