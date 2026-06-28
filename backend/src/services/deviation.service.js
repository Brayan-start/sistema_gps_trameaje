import { pool } from "../app.js";

const GRACE_SECONDS = parseInt(process.env.OFF_ROUTE_GRACE_SECONDS || "420");

export async function startDeviation(vehicleId, lat, lng, distance) {
  const result = await pool.query(
    `INSERT INTO route_deviations (vehicle_id, geom, deviation_start, max_distance_m)
     VALUES ($1, ST_SetSRID(ST_Point($2, $3), 4326), NOW(), $4)
     RETURNING id`,
    [vehicleId, lng, lat, distance]
  );
  return result.rows[0].id;
}

export async function resolveDeviation(vehicleId) {
  const active = await pool.query(
    `SELECT id, deviation_start FROM route_deviations
     WHERE vehicle_id = $1 AND deviation_end IS NULL
     ORDER BY deviation_start DESC LIMIT 1`,
    [vehicleId]
  );

  if (active.rows.length === 0) return null;

  const deviation = active.rows[0];
  const duration = Math.round((Date.now() - new Date(deviation.deviation_start)) / 1000);

  await pool.query(
    `UPDATE route_deviations
     SET deviation_end = NOW(), resolved = TRUE
     WHERE id = $1`,
    [deviation.id]
  );

  return { id: deviation.id, duration };
}

export async function getActiveDeviation(vehicleId) {
  const result = await pool.query(
    `SELECT id, deviation_start,
            ST_X(geom) as lng, ST_Y(geom) as lat,
            max_distance_m
     FROM route_deviations
     WHERE vehicle_id = $1 AND deviation_end IS NULL
     ORDER BY deviation_start DESC LIMIT 1`,
    [vehicleId]
  );
  return result.rows[0] || null;
}

export async function generateIncident(vehicleId, deviationId, lat, lng, startTime) {
  const duration = Math.round((Date.now() - new Date(startTime)) / 1000);

  const result = await pool.query(
    `INSERT INTO incidentes (vehicle_id, deviation_id, geom, inicio, duracion_segundos, tipo, descripcion)
     VALUES ($1, $2, ST_SetSRID(ST_Point($3, $4), 4326), $5, $6, 'off_route', 'Vehículo fuera de ruta por más de ${GRACE_SECONDS} segundos')
     RETURNING id`,
    [vehicleId, deviationId, lng, lat, startTime, duration]
  );

  await pool.query(
    `UPDATE route_deviations SET resolved = TRUE WHERE id = $1`,
    [deviationId]
  );

  return result.rows[0].id;
}

export function getGracePeriod() {
  return GRACE_SECONDS;
}
