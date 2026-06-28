import { pool } from "../app.js";

const SPEED_LIMIT = 60;

export async function checkAndSaveSpeedAlert(vehicleId, speed, lat, lng) {
  if (speed <= SPEED_LIMIT) return null;

  const result = await pool.query(
    `INSERT INTO speed_alerts (vehicle_id, speed_kmh, geom, timestamp)
     VALUES ($1, $2, ST_SetSRID(ST_Point($3, $4), 4326), NOW())
     RETURNING id`,
    [vehicleId, speed, lng, lat]
  );

  return result.rows[0].id;
}
