-- ============================================================
-- MIGRACIÓN: Nuevas tablas para el sistema mejorado
-- route_deviations, incidentes, audit_log
-- ============================================================

-- ============================================================
-- TABLA: route_deviations
-- Registro de eventos de desvío de ruta (inicio y fin)
-- ============================================================
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

-- ============================================================
-- TABLA: incidentes
-- Reportes automáticos generados cuando expira el temporizador
-- ============================================================
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

-- ============================================================
-- TABLA: audit_log
-- Registro cronológico de eventos del sistema
-- ============================================================
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
