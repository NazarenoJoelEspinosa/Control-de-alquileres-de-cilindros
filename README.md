# Control Operativo de Cilindros

Sistema web para gestionar clientes, cilindros de gas alquilados y el estado
de pago de cada uno. Pensado para uso interno de un solo operador (dueño o
encargado), con acceso protegido por usuario y contraseña.

**Stack:** HTML + CSS + JavaScript puro (sin frameworks ni build step) en el
frontend, con [Supabase](https://supabase.com) como backend (base de datos
Postgres + autenticación). No requiere servidor propio.

---

## Índice

1. [Qué hace el sistema](#qué-hace-el-sistema)
2. [Arquitectura](#arquitectura)
3. [Estructura de archivos](#estructura-de-archivos)
4. [Puesta en marcha](#puesta-en-marcha)
5. [Cómo se calcula el atraso (mes de gracia)](#cómo-se-calcula-el-atraso-mes-de-gracia)
6. [Guía de uso](#guía-de-uso)
7. [Modelo de datos](#modelo-de-datos)
8. [Seguridad](#seguridad)
9. [Limitaciones conocidas](#limitaciones-conocidas)
10. [Mantenimiento y soporte](#mantenimiento-y-soporte)

---

## Qué hace el sistema

- Alta, edición y baja de clientes.
- Registro de qué cilindros de gas tiene cada cliente (tipo, cantidad, y
  cuántos son de "baja rotación").
- Seguimiento del estado de pago de cada cliente (Pendiente / Pagado) y de
  cuántos meses lleva sin pagar, con un mes de gracia automático.
- Historial de pagos por cliente.
- Recordatorio de pago editable, enviado por WhatsApp con un clic.
- Búsqueda y filtros (por nombre, estado, gas, rango de fecha de pago).
- Panel de resumen con contadores (total, pendientes, pagados, urgentes,
  por vencer).
- Reportes agregados: clientes en mora, meses de atraso acumulados,
  cilindros por tipo de gas.
- Exportación a Excel (`.xlsx`) con tres hojas: Clientes, Cilindros y
  Reporte por gas.
- Acceso protegido con login (email + contraseña vía Supabase Auth).

## Arquitectura

```
┌─────────────────────┐        HTTPS        ┌──────────────────────────┐
│   Navegador          │ ───────────────────▶│   Supabase                │
│  index.html          │                      │  - Auth (login)          │
│  styles.css          │◀───────────────────  │  - Postgres (tabla       │
│  script.js           │   datos + sesión     │    app_data, JSONB)      │
└─────────────────────┘                      └──────────────────────────┘
```

- **No hay backend propio.** `script.js` habla directo con Supabase usando
  su SDK JS (`@supabase/supabase-js`), cargado desde CDN en `index.html`.
- **Todos los datos** (clientes, cilindros, historial) se guardan como un
  único bloque JSON en la tabla `app_data`, fila `id = 1`.
- **La autenticación** la maneja Supabase Auth. Sin sesión iniciada, la
  página no muestra nada más que la pantalla de login, y el propio backend
  (vía Row Level Security) rechaza cualquier lectura o escritura.

## Estructura de archivos

| Archivo        | Contenido                                                        |
|----------------|-------------------------------------------------------------------|
| `index.html`   | Estructura de la página: login, header, listado, y todos los modales (agregar, detalle, reportes, ayuda, recordatorio). |
| `styles.css`   | Estilos visuales. Usa variables CSS (`:root`) para colores y espaciados, responsive con un breakpoint a 600px. |
| `script.js`    | Toda la lógica: autenticación, carga/guardado en Supabase, cálculo de atrasos, render de la lista, modales, exportación a Excel. |
| `README.md`    | Este documento. |

## Puesta en marcha

### 1. Crear la tabla en Supabase

En el **SQL Editor** de tu proyecto Supabase:

```sql
create table if not exists app_data (
  id integer primary key,
  data jsonb not null default '{"clientes":[]}'::jsonb,
  updated_at timestamp not null default now()
);

insert into app_data (id, data) values (1, '{"clientes":[]}'::jsonb)
on conflict (id) do nothing;
```

### 2. Activar Row Level Security (RLS)

Sin esto, cualquiera con la URL del proyecto y la `anon key` (visibles en el
código fuente de la página) podría leer o modificar todos los datos, con o
sin sesión iniciada. Correr una sola vez:

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

Esto restringe el acceso al rol `authenticated`: sin sesión válida, Supabase
rechaza el pedido directamente.

### 3. Crear el usuario de acceso

1. Panel de Supabase → **Authentication → Users → Add user**.
2. Cargar email y contraseña, tildando **Auto Confirm User**.
3. Repetir por cada persona que necesite acceso (hoy pensado para un único
   usuario, pero soporta más de uno sin cambios).

Opcional pero recomendado: en **Authentication → Providers → Email**,
desactivar **"Allow new users to sign up"**, para que el alta pública quede
cerrada y los únicos usuarios posibles sean los creados a mano.

### 4. Conectar el frontend

En `script.js`, al principio del archivo:

```js
const SUPABASE_URL = "https://TU-PROYECTO.supabase.co";
const SUPABASE_ANON_KEY = "TU-ANON-KEY";
```

Ambos valores están en **Settings → API** del panel de Supabase. La
`anon key` está pensada para ser pública — lo que protege los datos no es
ocultarla, sino el RLS del paso 2.

### 5. Publicar / abrir la app

- Si abrís `index.html` con doble clic (protocolo `file://`), algunos
  navegadores son más estrictos con pedidos a otro dominio.
- Recomendado: subir los 3 archivos a un hosting estático gratuito
  (Netlify, GitHub Pages, o el hosting estático de Supabase/Vercel) y abrir
  la página desde esa URL.

## Cómo se calcula el atraso (mes de gracia)

Cada cliente tiene un campo **"Pago hasta"** (mes/año). El sistema calcula
cuántos meses reales pasaron desde ese mes hasta el actual, y le resta
**1 mes de gracia**: el primer mes recién vencido todavía no cuenta como
atraso (es normal — el cliente puede devolver el tubo o pagar dentro de
ese margen).

| Meses reales sin pagar | Estado mostrado                     |
|-------------------------|-------------------------------------|
| 0 (pagó el mes en curso o por adelantado) | Al día |
| 1                        | Al día (mes de gracia)              |
| 2 – 3                    | 🔜 Por vencer                       |
| 4 o más                 | ⚠️ Urgente (+3 meses de atraso efectivo) |

Este criterio se aplica de forma pareja a todos los clientes, tanto en el
panel de resumen como en los filtros, el detalle del cliente y el Excel
exportado.

## Guía de uso

### Panel principal
- Las 5 tarjetas de arriba (Total, Pendientes, Pagados, +3 meses deuda, Por
  vencer pronto) son clickeables y filtran la lista al instante.
- Barra de búsqueda por nombre, orden (A-Z / más deuda primero / por
  estado), y filtros por rango de "pago hasta" y tipo de gas.

### Agregar cliente
Único dato obligatorio: el nombre. El resto (teléfono, estado de pago,
cilindros) se puede completar después. Si el nombre ya existe, el sistema
pide confirmación antes de guardar un posible duplicado.

### Ficha de cliente (Ver →)
- **Editar datos:** nombre, teléfono, mes de pago, estado.
- **Pago hoy:** marca el pago del mes actual con un clic y lo registra en
  el historial.
- **Notas:** campo libre, se guarda automáticamente al escribir.
- **Historial de pagos:** listado editable de pagos registrados.
- **Cilindros de gas:** alta, edición y baja de los cilindros que tiene ese
  cliente, con cantidad y cuántos son de baja rotación.
- **💬 Recordatorio:** genera un mensaje de recordatorio de pago
  precargado (distinto según si el cliente tiene atraso o no), editable a
  mano antes de enviarlo, y lo abre directo en WhatsApp usando el teléfono
  cargado del cliente.

### Reportes
Resumen general (clientes en mora, meses de atraso acumulados, cilindros
totales) y detalle de cilindros agrupados por tipo de gas.

### Exportar Excel
Descarga un `.xlsx` con tres hojas: **Clientes** (con teléfono, estado,
meses de deuda y notas), **Cilindros** (detalle por cliente) y **Reporte
por gas** (totales agregados).

## Modelo de datos

Todo se guarda en un único registro JSON, bajo la clave `clientes`:

```json
{
  "clientes": [
    {
      "id": 1720000000000,
      "nombre": "Herrería Pérez",
      "telefono": "1123456789",
      "estado": "Pendiente",
      "pagoHasta": "2026-06",
      "notas": "Depósito en Av. Siempreviva 742",
      "cilindros": [
        { "gas": "Argón", "cantidad": 3, "bajaRotacion": 1 }
      ],
      "historial": [
        { "mes": "2026-05", "nota": "Pago registrado" }
      ]
    }
  ]
}
```

| Campo         | Tipo     | Descripción                                             |
|---------------|----------|----------------------------------------------------------|
| `id`          | number   | Timestamp de creación, usado como identificador único.   |
| `nombre`      | string   | Nombre o razón social. Único dato obligatorio.            |
| `telefono`    | string   | Opcional. Solo dígitos con código de área, para WhatsApp. |
| `estado`      | string   | `"Pendiente"` o `"Pagado"`.                                |
| `pagoHasta`   | string   | Mes/año (`YYYY-MM`) hasta el que tiene pagado.            |
| `notas`       | string   | Texto libre.                                              |
| `cilindros`   | array    | Cada gas con `gas`, `cantidad` y `bajaRotacion`.           |
| `historial`   | array    | Cada pago registrado, con `mes` y `nota`.                  |

## Seguridad

- El acceso a la app requiere email y contraseña (Supabase Auth).
- La base de datos tiene Row Level Security activado: sin sesión válida,
  ninguna lectura ni escritura es posible, aunque alguien tenga la URL y
  la `anon key` del proyecto.
- El alta pública de usuarios está desactivada (o se recomienda
  desactivarla) — el único acceso posible es a través de usuarios creados
  manualmente en el panel de Supabase.
- La `anon key` en `script.js` está pensada para ser pública; la protección
  real la da el RLS, no el ocultamiento de esa clave.

## Limitaciones conocidas

- **Un solo registro compartido** (`id = 1`): pensado para un único
  usuario operando a la vez. Si en el futuro trabajan varias personas al
  mismo tiempo, dos guardados simultáneos pueden pisarse entre sí (el
  último en guardar prevalece). No implementado por decisión: hoy el
  sistema lo usa una sola persona.
- **Sin backup automático:** la única forma de respaldo es "Exportar
  Excel" manual. No hay una opción de "importar" para restaurar desde ese
  archivo.
- **Sin roles de usuario:** cualquier cuenta creada tiene el mismo nivel
  de acceso (lectura y escritura completa).
- **Requiere conexión a internet:** al depender de Supabase, no funciona
  sin conexión.

## Mantenimiento y soporte

- Para agregar un nuevo usuario con acceso: repetir el paso 3 de
  "Puesta en marcha".
- Para cambiar el criterio del mes de gracia o los umbrales de "por
  vencer"/"urgente": están centralizados en la función `mesesDesde()` de
  `script.js`.
- Para agregar un nuevo tipo de gas: modificar el array `GASES` al
  principio de `script.js`.
