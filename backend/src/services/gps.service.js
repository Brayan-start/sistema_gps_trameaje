import { pool } from "../app.js";

export async function savePosition(vehicleId, lat, lng, speed) {
  const result = await pool.query(
    `INSERT INTO gps_positions (vehicle_id, geom, speed_kmh, timestamp)
     VALUES ($1, ST_SetSRID(ST_Point($2, $3), 4326), $4, NOW())
     RETURNING id`,
    [vehicleId, lng, lat, speed || 0]
  );

  await pool.query(
    `UPDATE vehicles SET last_seen_at = NOW() WHERE id = $1`,
    [vehicleId]
  );

  return result.rows[0].id;
}
