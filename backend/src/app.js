import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import pg from "pg";

import authRoutes from "./routes/auth.routes.js";
import vehiclesRoutes from "./routes/vehicles.routes.js";
import usersRoutes from "./routes/users.routes.js";
import alertsRoutes from "./routes/alerts.routes.js";
import historyRoutes from "./routes/history.routes.js";
import stopsRoutes from "./routes/stops.routes.js";
import publicRoutes from "./routes/public.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import auditRoutes from "./routes/audit.routes.js";
import sancionesRoutes from "./routes/sanciones.routes.js";
import driverRoutes from "./routes/driver.routes.js";
import { setSocketIO } from "./services/socket.service.js";
import { setupGpsSocket } from "./sockets/gps.socket.js";

const { Pool } = pg;

const poolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    }
  : {
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || "5432"),
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
    };

export const pool = new Pool(poolConfig);

export async function getDashboardStats() {
  const [vehiculosActivos, choferesActivos, desviosActivos, incidentesHoy] = await Promise.all([
    pool.query(`SELECT COUNT(*) as count FROM vehicles WHERE status = 'on_route'`),
    pool.query(`SELECT COUNT(DISTINCT u.id) as count FROM users u JOIN vehicles v ON u.vehicle_id = v.id WHERE u.role = 'driver' AND v.status = 'on_route'`),
    pool.query(`SELECT COUNT(*) as count FROM route_deviations rd JOIN vehicles v ON rd.vehicle_id = v.id WHERE rd.resolved = FALSE AND v.status = 'on_route'`),
    pool.query(`SELECT COUNT(*) as count FROM incidentes WHERE created_at > CURRENT_DATE`),
  ]);

  return {
    vehiculos_activos: parseInt(vehiculosActivos.rows[0].count),
    choferes_activos: parseInt(choferesActivos.rows[0].count),
    desvios_activos: parseInt(desviosActivos.rows[0].count),
    incidentes_hoy: parseInt(incidentesHoy.rows[0].count),
  };
}

async function runMigration() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS route_deviations (
        id SERIAL PRIMARY KEY,
        vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
        geom GEOMETRY(POINT, 4326) NOT NULL,
        deviation_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deviation_end TIMESTAMPTZ,
        max_distance_m FLOAT,
        resolved BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_route_deviations_vehicle ON route_deviations(vehicle_id);
      CREATE INDEX IF NOT EXISTS idx_route_deviations_active ON route_deviations(vehicle_id) WHERE deviation_end IS NULL;

      CREATE TABLE IF NOT EXISTS incidentes (
        id SERIAL PRIMARY KEY,
        vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
        deviation_id INTEGER REFERENCES route_deviations(id) ON DELETE SET NULL,
        geom GEOMETRY(POINT, 4326) NOT NULL,
        inicio TIMESTAMPTZ NOT NULL,
        fin TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        duracion_segundos INTEGER NOT NULL,
        tipo VARCHAR(50) DEFAULT 'off_route',
        descripcion TEXT,
        resuelto BOOLEAN DEFAULT FALSE,
        resuelto_por INTEGER REFERENCES users(id) ON DELETE SET NULL,
        resuelto_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_incidentes_vehicle ON incidentes(vehicle_id);
      CREATE INDEX IF NOT EXISTS idx_incidentes_tipo ON incidentes(tipo);

      CREATE TABLE IF NOT EXISTS audit_log (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        usuario_nombre VARCHAR(150),
        accion VARCHAR(100) NOT NULL,
        detalle TEXT,
        tipo VARCHAR(50) DEFAULT 'general',
        ip_address VARCHAR(45),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_audit_log_tipo ON audit_log(tipo);
      CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id);

      CREATE TABLE IF NOT EXISTS sanciones (
        id SERIAL PRIMARY KEY,
        incidente_id INTEGER NOT NULL REFERENCES incidentes(id) ON DELETE CASCADE,
        chofer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        tipo_sancion VARCHAR(100) NOT NULL,
        descripcion TEXT,
        aplicada_por INTEGER NOT NULL REFERENCES users(id) ON DELETE SET NULL,
        fecha_aplicacion TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_sanciones_incidente ON sanciones(incidente_id);
      CREATE INDEX IF NOT EXISTS idx_sanciones_chofer ON sanciones(chofer_id);
    `);
    console.log("[MIGRATION] Tablas verificadas/creadas correctamente");

    const cleanup = await pool.query(
      `UPDATE route_deviations SET resolved = TRUE, deviation_end = NOW()
       WHERE resolved = FALSE AND vehicle_id NOT IN (
         SELECT id FROM vehicles WHERE status = 'on_route'
       )`
    );
    if (cleanup.rowCount > 0) {
      console.log(`[CLEANUP] ${cleanup.rowCount} desvíos huérfanos resueltos automáticamente`);
    }
  } catch (err) {
    console.error("[MIGRATION] Error ejecutando migración:", err.message);
  }
}

const app = express();
const httpServer = createServer(app);

runMigration();

const corsOrigin = process.env.CORS_ORIGIN || "*";

const io = new Server(httpServer, {
  cors: { origin: corsOrigin },
});

app.use(cors({ origin: corsOrigin }));
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/vehicles", vehiclesRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/alerts", alertsRoutes);
app.use("/api/history", historyRoutes);
app.use("/api/stops", stopsRoutes);
app.use("/api/public", publicRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/audit", auditRoutes);
app.use("/api/sanciones", sancionesRoutes);
app.use("/api/driver", driverRoutes);

app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

setSocketIO(io);
setupGpsSocket(io);

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`San Roque Tracking API running on port ${PORT}`);
});
