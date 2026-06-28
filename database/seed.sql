-- ============================================================
-- SINDICATO DE TRANSPORTE "SEÑOR DE SAN ROQUE"
-- Ruta: San Roque → Ceja, El Alto, Bolivia
-- Seed: Usuarios, vehículos, ruta autorizada, datos de ejemplo
-- ============================================================

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;

-- ============================================================
-- TABLA: users
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(200) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'driver', 'passenger')),
  vehicle_id INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE
);

-- ============================================================
-- TABLA: vehicles
-- ============================================================
CREATE TABLE IF NOT EXISTS vehicles (
  id SERIAL PRIMARY KEY,
  plate VARCHAR(20) UNIQUE NOT NULL,
  brand VARCHAR(50) NOT NULL,
  model VARCHAR(50) NOT NULL,
  year INTEGER NOT NULL,
  driver_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  status VARCHAR(20) DEFAULT 'inactive' CHECK (status IN ('active', 'inactive', 'on_route', 'stopped')),
  last_seen_at TIMESTAMPTZ
);

-- Agregar FK después de crear ambas tablas (solo si no existe)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_users_vehicle'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT fk_users_vehicle FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================
-- TABLA: authorized_route
-- ============================================================
CREATE TABLE IF NOT EXISTS authorized_route (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  geom GEOMETRY(LINESTRING, 4326) NOT NULL
);

-- ============================================================
-- TABLA: gps_positions
-- ============================================================
CREATE TABLE IF NOT EXISTS gps_positions (
  id SERIAL PRIMARY KEY,
  vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  geom GEOMETRY(POINT, 4326) NOT NULL,
  speed_kmh FLOAT DEFAULT 0,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  is_on_route BOOLEAN DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_gps_positions_vehicle ON gps_positions(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_gps_positions_ts ON gps_positions(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_gps_positions_geom ON gps_positions USING GIST(geom);

-- ============================================================
-- TABLA: stops
-- ============================================================
CREATE TABLE IF NOT EXISTS stops (
  id SERIAL PRIMARY KEY,
  vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  geom GEOMETRY(POINT, 4326) NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  duration_seconds INTEGER
);

-- ============================================================
-- TABLA: tramaje_events
-- ============================================================
CREATE TABLE IF NOT EXISTS tramaje_events (
  id SERIAL PRIMARY KEY,
  vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  geom GEOMETRY(POINT, 4326) NOT NULL,
  distance_from_route_m FLOAT NOT NULL,
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- ============================================================
-- TABLA: speed_alerts
-- ============================================================
CREATE TABLE IF NOT EXISTS speed_alerts (
  id SERIAL PRIMARY KEY,
  vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  speed_kmh FLOAT NOT NULL,
  geom GEOMETRY(POINT, 4326) NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- DATOS DE EJEMPLO
-- ============================================================
-- IMPORTANTE: Estos hashes fueron GENERADOS con bcrypt.genSaltSync(10)
-- y verificados con bcrypt.compareSync(). NO copiar/pegar hashes
-- de sitios web externos.
--
-- Usuarios y contraseñas en texto plano:
--   admin@sanroque.bo  →  admin123
--   carlos@sanroque.bo →  chofer123
--   maria@sanroque.bo  →  chofer123
--   jose@sanroque.bo   →  chofer123
--
-- Para regenerar desde Node.js:
--   const bcrypt = require('bcrypt');
--   bcrypt.hashSync('admin123', bcrypt.genSaltSync(10));
-- ============================================================

INSERT INTO users (name, email, password_hash, role) VALUES
('Admin Sindicato', 'admin@sanroque.bo', '$2b$10$ATvk2JvBaoKdRk.62PEbV.nshL5Qw2/r/VgTzLaJmXiT2O4CVsyRS', 'admin')
ON CONFLICT (email) DO NOTHING;

INSERT INTO users (name, email, password_hash, role) VALUES
('Carlos Mamani', 'carlos@sanroque.bo', '$2b$10$ATvk2JvBaoKdRk.62PEbV.IgRD5FqmtK/jB5ju7buAxQ6rsQIUETW', 'driver'),
('Maria Quispe', 'maria@sanroque.bo', '$2b$10$ATvk2JvBaoKdRk.62PEbV.IgRD5FqmtK/jB5ju7buAxQ6rsQIUETW', 'driver'),
('Jose Condori', 'jose@sanroque.bo', '$2b$10$ATvk2JvBaoKdRk.62PEbV.IgRD5FqmtK/jB5ju7buAxQ6rsQIUETW', 'driver')
ON CONFLICT (email) DO NOTHING;

INSERT INTO vehicles (plate, brand, model, year, status) VALUES
('CH-1234', 'Toyota', 'Hiace', 2020, 'inactive'),
('CH-5678', 'Nissan', 'Urvan', 2021, 'inactive'),
('CH-9012', 'Mercedes', 'Sprinter', 2019, 'inactive')
ON CONFLICT (plate) DO NOTHING;

-- Asignar conductores a vehículos
UPDATE users SET vehicle_id = 1 WHERE email = 'carlos@sanroque.bo';
UPDATE users SET vehicle_id = 2 WHERE email = 'maria@sanroque.bo';
UPDATE users SET vehicle_id = 3 WHERE email = 'jose@sanroque.bo';
UPDATE vehicles SET driver_id = (SELECT id FROM users WHERE email = 'carlos@sanroque.bo') WHERE id = 1;
UPDATE vehicles SET driver_id = (SELECT id FROM users WHERE email = 'maria@sanroque.bo') WHERE id = 2;
UPDATE vehicles SET driver_id = (SELECT id FROM users WHERE email = 'jose@sanroque.bo') WHERE id = 3;

-- Ruta autorizada: San Roque → Ceja El Alto
-- Generada desde OSRM con ruta real por calles (12.71 km, 156 puntos)
-- San Roque: -16.475452995078665, -68.27748794082346
-- La Ceja:  -16.50362324013066,  -68.16265888704012
INSERT INTO authorized_route (id, name, geom) VALUES (
  1,
  'San Roque → Ceja El Alto (ruta real)',
  ST_GeomFromText('LINESTRING(
    -68.277481 -16.475414,
    -68.277579 -16.475399,
    -68.277492 -16.475303,
    -68.275465 -16.475648,
    -68.272781 -16.476088,
    -68.271702 -16.476269,
    -68.271505 -16.476302,
    -68.270992 -16.476388,
    -68.270347 -16.476493,
    -68.269524 -16.476632,
    -68.269136 -16.476697,
    -68.268306 -16.476834,
    -68.266615 -16.477113,
    -68.265735 -16.477269,
    -68.265252 -16.477359,
    -68.264779 -16.477472,
    -68.264314 -16.477583,
    -68.264098 -16.477633,
    -68.262448 -16.478011,
    -68.261291 -16.478283,
    -68.259051 -16.478785,
    -68.258939 -16.478811,
    -68.256873 -16.479289,
    -68.255818 -16.479526,
    -68.254979 -16.479727,
    -68.254213 -16.479917,
    -68.253183 -16.480172,
    -68.252021 -16.480447,
    -68.250717 -16.480746,
    -68.248942 -16.481162,
    -68.24883 -16.481196,
    -68.248635 -16.481244,
    -68.247611 -16.481487,
    -68.244068 -16.482298,
    -68.243877 -16.482347,
    -68.243767 -16.482367,
    -68.243575 -16.482413,
    -68.242883 -16.482563,
    -68.242417 -16.482664,
    -68.241929 -16.482771,
    -68.241469 -16.482871,
    -68.241032 -16.482966,
    -68.240523 -16.483077,
    -68.240069 -16.483176,
    -68.239438 -16.483314,
    -68.239429 -16.483316,
    -68.238764 -16.483461,
    -68.238062 -16.483614,
    -68.237155 -16.483812,
    -68.236636 -16.483925,
    -68.235739 -16.484131,
    -68.234991 -16.484303,
    -68.233492 -16.484629,
    -68.233066 -16.484719,
    -68.232547 -16.484833,
    -68.231997 -16.484953,
    -68.231069 -16.485155,
    -68.230099 -16.485366,
    -68.229286 -16.485547,
    -68.228374 -16.485742,
    -68.227401 -16.485947,
    -68.226977 -16.486036,
    -68.223544 -16.486766,
    -68.223319 -16.48681,
    -68.223155 -16.486845,
    -68.21892 -16.487737,
    -68.215121 -16.488512,
    -68.211301 -16.489289,
    -68.210962 -16.489364,
    -68.210283 -16.489504,
    -68.210067 -16.489514,
    -68.209715 -16.489594,
    -68.208691 -16.489816,
    -68.208414 -16.489874,
    -68.208143 -16.48993,
    -68.207655 -16.490031,
    -68.207411 -16.490081,
    -68.206122 -16.490347,
    -68.205438 -16.490483,
    -68.205263 -16.490548,
    -68.204456 -16.490702,
    -68.204324 -16.490727,
    -68.204263 -16.490739,
    -68.203834 -16.490821,
    -68.202615 -16.491053,
    -68.202555 -16.491062,
    -68.202274 -16.491117,
    -68.202096 -16.491148,
    -68.201567 -16.491258,
    -68.201443 -16.491292,
    -68.201374 -16.491309,
    -68.201112 -16.491387,
    -68.200636 -16.491558,
    -68.200415 -16.49164,
    -68.199678 -16.491981,
    -68.198658 -16.492428,
    -68.198275 -16.492588,
    -68.198042 -16.492685,
    -68.197778 -16.492795,
    -68.196796 -16.493212,
    -68.195875 -16.493622,
    -68.194972 -16.494031,
    -68.194897 -16.494062,
    -68.194286 -16.494328,
    -68.19409 -16.494417,
    -68.194055 -16.494433,
    -68.193989 -16.494463,
    -68.193027 -16.4949,
    -68.192734 -16.495041,
    -68.192508 -16.495147,
    -68.192274 -16.495236,
    -68.192071 -16.495298,
    -68.191676 -16.495414,
    -68.191107 -16.495564,
    -68.19002 -16.495864,
    -68.18995 -16.495883,
    -68.188748 -16.496215,
    -68.188325 -16.496328,
    -68.187929 -16.496437,
    -68.18779 -16.496475,
    -68.186885 -16.496723,
    -68.185997 -16.496967,
    -68.184627 -16.497342,
    -68.184469 -16.497386,
    -68.184285 -16.497436,
    -68.184022 -16.497501,
    -68.18321 -16.497724,
    -68.180883 -16.49834,
    -68.180746 -16.498374,
    -68.180609 -16.498411,
    -68.180108 -16.498547,
    -68.180022 -16.49857,
    -68.179908 -16.498601,
    -68.175146 -16.499892,
    -68.175077 -16.49991,
    -68.174907 -16.499956,
    -68.17481 -16.499983,
    -68.171988 -16.500748,
    -68.171812 -16.500795,
    -68.171618 -16.500847,
    -68.169964 -16.501291,
    -68.169903 -16.501308,
    -68.168024 -16.50184,
    -68.167618 -16.501954,
    -68.167239 -16.502063,
    -68.166863 -16.502171,
    -68.166487 -16.502278,
    -68.166095 -16.502391,
    -68.16573 -16.502495,
    -68.165113 -16.502672,
    -68.164532 -16.502821,
    -68.164286 -16.502908,
    -68.164072 -16.503004,
    -68.163831 -16.503112,
    -68.162832 -16.503578,
    -68.162673 -16.503652
  )', 4326)
);
