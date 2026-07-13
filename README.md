# Control Operativo de Cilindros

Sistema para llevar el control de clientes, cilindros alquilados y pagos.
Los datos viven en **Supabase** (Postgres + Auth), no en el navegador ni en
un backend propio: `script.js` habla directo con Supabase usando su SDK
(`@supabase/supabase-js`).

> Nota: si tenías archivos `server.js` / `package.json` de una versión previa
> pensada para desplegar un backend en Railway, ya no se usan — bórralos.
> Toda la app corre desde estos 3 archivos: `index.html`, `styles.css`, `script.js`.

## 1. Configurar la tabla en Supabase

Si ya la tenés creada, saltá a la sección 2. Si no, en el **SQL Editor** de tu
proyecto Supabase corré:

```sql
create table if not exists app_data (
  id integer primary key,
  data jsonb not null default '{"clientes":[]}'::jsonb,
  updated_at timestamp not null default now()
);

insert into app_data (id, data) values (1, '{"clientes":[]}'::jsonb)
on conflict (id) do nothing;
```

## 2. Activar Row Level Security (RLS) — obligatorio

Sin esto, cualquiera con tu URL y `anon key` (que están a la vista en el
código fuente de la página) puede leer o modificar todos tus datos, con
login o sin login. Corré esto una sola vez en el SQL Editor:

```sql
alter table app_data enable row level security;

drop policy if exists "Solo usuarios logueados leen" on app_data;
create policy "Solo usuarios logueados leen"
  on app_data for select
  to authenticated
  using (true);

drop policy if exists "Solo usuarios logueados escriben" on app_data;
create policy "Solo usuarios logueados escriben"
  on app_data for update
  to authenticated
  using (true)
  with check (true);
```

Esto hace que **solo pueda leer o guardar quien haya iniciado sesión**
(rol `authenticated`). Sin sesión, Supabase rechaza el pedido.

## 3. Crear tu usuario de acceso

La app ahora pide email y contraseña antes de mostrar nada. Para crear el
usuario que vas a usar vos (o cada empleado):

1. En el panel de Supabase → **Authentication** → **Users** → **Add user**.
2. Cargá el email y una contraseña. Marcá **Auto Confirm User** para no
   tener que confirmar por mail.
3. Repetí por cada persona que necesite acceso.

### Importante: desactivar el alta pública

Por defecto, Supabase deja que cualquiera se registre solo con el SDK. Como
esta app no tiene pantalla de "Registrarme" (solo login), esto no es
explotable desde la interfaz, pero para estar más tranquilo podés ir a
**Authentication → Providers → Email** y desactivar **"Allow new users to
sign up"**. Así los únicos usuarios posibles son los que vos creaste a mano.

## 4. Conectar el frontend

En `script.js`, al principio del archivo, confirmá que estén tu URL y tu
`anon key` (Settings → API en el panel de Supabase):

```js
const SUPABASE_URL = "https://TU-PROYECTO.supabase.co";
const SUPABASE_ANON_KEY = "TU-ANON-KEY";
```

La `anon key` está pensada para ser pública — lo que la protege no es
ocultarla, sino el RLS del paso 2.

## 5. Usar la app

Abrí `index.html`. Te va a pedir email y contraseña. Una vez logueado, ves
la pantalla normal con tus clientes. El botón **🚪 Salir** del header cierra
la sesión.

## Notas

- Si abrís `index.html` con doble clic (`file://`), algunos navegadores son
  más estrictos con pedidos a otro dominio. Si tenés problemas, subí los
  3 archivos a un hosting estático gratis (Netlify, GitHub Pages, o un
  servicio estático en Supabase/Vercel) y abrí la página desde esa URL.
- Si en el futuro sumás más de un usuario y querés que cada uno solo vea
  "sus" clientes (no todos), avisame — hay que cambiar el modelo de datos
  (hoy todo se guarda en un único registro compartido, fila `id=1`).
