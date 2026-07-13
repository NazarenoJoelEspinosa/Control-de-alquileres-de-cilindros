const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { Pool } = require("pg");

const PORT = process.env.PORT || 5000;

// Token que persiste en la DB — se genera una sola vez, no cambia entre reinicios
let RUNTIME_TOKEN = "";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
  max: 10
});

pool.on("error", (err) => {
  console.error("Error inesperado en el pool de PostgreSQL:", err.message);
});

async function initDb() {
  // Datos de la app
  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_data (
      id INTEGER PRIMARY KEY,
      data JSONB NOT NULL DEFAULT '{"clientes":[]}'::jsonb,
      updated_at TIMESTAMP NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`
    INSERT INTO app_data (id, data) VALUES (1, '{"clientes":[]}'::jsonb)
    ON CONFLICT (id) DO NOTHING;
  `);

  // Configuración persistente (incluye runtime token)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Insertar token sólo si no existe (persiste entre reinicios)
  const newToken = crypto.randomBytes(32).toString("hex");
  await pool.query(
    `INSERT INTO app_config (key, value) VALUES ('runtime_token', $1) ON CONFLICT (key) DO NOTHING`,
    [newToken]
  );
  const result = await pool.query(`SELECT value FROM app_config WHERE key = 'runtime_token'`);
  RUNTIME_TOKEN = result.rows[0].value;
}

const app = express();
app.use(cors({ credentials: true, origin: true }));
app.use(express.json({ limit: "5mb" }));

// ─── Helpers de cookie ─────────────────────────────────────────────────────
function getCookieToken(req) {
  const cookieHeader = req.headers.cookie || "";
  const match = cookieHeader.match(/(?:^|;\s*)rt=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

// ─── Inyección de token + cookie ──────────────────────────────────────────
// DEBE ir ANTES de express.static para interceptar / e /index.html
const BUILD_TS = Date.now();

function serveIndex(req, res) {
  let html = fs.readFileSync(path.join(__dirname, "public", "index.html"), "utf8");
  // Cache-busting en assets
  html = html.replace('href="styles.css"', `href="styles.css?v=${BUILD_TS}"`);
  html = html.replace('src="app.js"', `src="app.js?v=${BUILD_TS}"`);
  // Set-Cookie: el browser lo envía automáticamente en todos los requests al mismo origen
  res.setHeader("Set-Cookie", `rt=${RUNTIME_TOKEN}; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400`);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.send(html);
}

app.get("/", serveIndex);
app.get("/index.html", serveIndex);

// ─── Assets estáticos (solo /public, sin index.html automático) ────────────
app.use(express.static(path.join(__dirname, "public"), {
  etag: true,
  index: false
}));

// ─── Health check ──────────────────────────────────────────────────────────
app.get("/health", (req, res) => res.json({ status: "ok" }));

// ─── Middleware de autenticación ───────────────────────────────────────────
// Acepta el token via cookie (automático) O via header x-runtime-token (JS explícito)
function requireToken(req, res, next) {
  const cookieToken = getCookieToken(req);
  const headerToken = req.header("x-runtime-token") || "";
  const token = cookieToken || headerToken;
  if (!token || token !== RUNTIME_TOKEN) {
    return res.status(401).json({ error: "No autorizado" });
  }
  next();
}

// ─── Validación de body ────────────────────────────────────────────────────
function validateAppData(req, res, next) {
  const body = req.body;
  if (!body || typeof body !== "object" || !Array.isArray(body.clientes)) {
    return res.status(400).json({
      error: "Estructura inválida. Se esperaba { clientes: [...] }"
    });
  }
  next();
}

// ─── API ───────────────────────────────────────────────────────────────────
app.get("/api/data", requireToken, async (req, res) => {
  try {
    const result = await pool.query("SELECT data FROM app_data WHERE id = 1");
    res.json(result.rows[0]?.data || { clientes: [] });
  } catch (err) {
    console.error("Error al leer datos:", err.message);
    res.status(500).json({ error: "Error leyendo la base de datos" });
  }
});

app.put("/api/data", requireToken, validateAppData, async (req, res) => {
  try {
    const data = req.body;
    await pool.query(
      `UPDATE app_data SET data = $1, updated_at = now() WHERE id = 1`,
      [data]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error("Error al guardar datos:", err.message);
    res.status(500).json({ error: "Error guardando en la base de datos" });
  }
});

// ─── Arranque ──────────────────────────────────────────────────────────────
initDb()
  .then(() => {
    app.listen(PORT, "0.0.0.0", () =>
      console.log(`Cilindros API escuchando en puerto ${PORT}`)
    );
  })
  .catch(err => {
    console.error("No se pudo inicializar la base de datos:", err.message);
    process.exit(1);
  });
