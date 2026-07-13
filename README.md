# Cómo desplegar esto en Railway

Este backend guarda todos tus datos (clientes, cilindros, historial) en una base
Postgres real, en vez de en el navegador. El frontend (tus 3 archivos HTML/CSS/JS)
le pide los datos a esta API cada vez que abrís la página, y le avisa cada vez
que guardás algo.

## 1. Crear el proyecto en Railway

1. Entrá a railway.app y creá un **New Project**.
2. Elegí **Deploy from GitHub repo** (necesitás subir esta carpeta `cilindros-backend`
   a un repositorio de GitHub primero — creá uno nuevo y subí estos 3 archivos:
   `server.js`, `package.json`, `.env.example`).
   - Alternativa sin GitHub: instalá la Railway CLI (`npm i -g @railway/cli`),
     corré `railway login` y `railway up` parado en esta carpeta.

## 2. Agregar la base de datos

1. Dentro del mismo proyecto, click en **+ New** → **Database** → **Add PostgreSQL**.
2. Railway va a conectar automáticamente la variable `DATABASE_URL` a tu servicio
   (si no lo hace solo, andá a tu servicio → **Variables** → **Add Variable Reference**
   → elegí `DATABASE_URL` de la base de Postgres).

## 3. Configurar la clave de acceso

1. En tu servicio (no en la base) → **Variables** → agregá:
   - `API_KEY` = una clave larga que inventes vos, por ejemplo `cilindros-2026-x7k9`.
   Esta es la clave que vas a poner también en tu `script.js`, para que solo vos
   puedas leer o modificar tus datos.

## 4. Generar la URL pública

1. En tu servicio → **Settings** → **Networking** → **Generate Domain**.
2. Te va a dar algo como `https://cilindros-backend-production.up.railway.app`.
   Esa es la URL que necesitás para el frontend.

## 5. Conectar el frontend

Abrí `script.js` y en las primeras líneas reemplazá:

```js
const API_URL = "https://TU-DOMINIO.up.railway.app/api/data";
const API_KEY = "TU-CLAVE-SECRETA";
```

con tu dominio real de Railway y la misma `API_KEY` que configuraste en el paso 3.

## 6. Probar

Abrí `index.html` en el navegador. Si todo quedó bien conectado, vas a ver
"Datos cargados" arriba a la izquierda. Si aparece un error de conexión,
revisá:
- Que la `API_KEY` sea EXACTAMENTE igual en Railway y en `script.js`.
- Que el dominio en `API_URL` termine en `/api/data`.
- Que el servicio esté "Active" (no dormido/caído) en Railway.

## Nota sobre dónde abrir el archivo

Si abrís `index.html` haciendo doble clic (protocolo `file://`), algunos
navegadores son más estrictos con las peticiones a otro dominio. Si tenés
problemas, la alternativa más simple es subir también los 3 archivos del
frontend a Railway como otro servicio de sitio estático, o a algo gratis
como Netlify/GitHub Pages, y abrir la página desde esa URL en vez de
localmente.
