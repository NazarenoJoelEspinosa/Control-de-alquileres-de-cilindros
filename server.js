// server.js
// API para guardar y leer los datos del sistema de control de cilindros.
// Guarda TODA la lista de clientes como un solo bloque JSON en Postgres.
// También sirve el frontend estático.

const express = require("express");
const cors = require("cors");
const path = require("path");
const { Pool } = require("pg");

const PORT = process.env.PORT || 5000;
const API_KEY = process.env.API_KEY || "cambiame";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

async function initDb() {
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
}

const app = express();
app.use(cors());
app.use(express.json({ limit: "5mb" }));

// Serve static frontend files
app.use(express.static(path.join(__dirname)));

// Health check
app.get("/health", (req, res) => res.send("Cilindros API OK"));

// All /api/* routes require the key
function requireApiKey(req, res, next) {
  const key = req.header("x-api-key");
  if (key !== API_KEY) {
    return res.status(401).json({ error: "API key inválida o faltante" });
  }
  next();
}

app.get("/api/data", requireApiKey, async (req, res) => {
  try {
    const result = await pool.query("SELECT data FROM app_data WHERE id = 1");
    res.json(result.rows[0]?.data || { clientes: [] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error leyendo la base de datos" });
  }
});

app.put("/api/data", requireApiKey, async (req, res) => {
  try {
    const data = req.body;
    await pool.query(
      `UPDATE app_data SET data = $1, updated_at = now() WHERE id = 1`,
      [data]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error guardando en la base de datos" });
  }
});

initDb()
  .then(() => {
    app.listen(PORT, "0.0.0.0", () =>
      console.log(`Cilindros API escuchando en puerto ${PORT}`)
    );
  })
  .catch(err => {
    console.error("No se pudo inicializar la base de datos:", err);
    process.exit(1);
  });
