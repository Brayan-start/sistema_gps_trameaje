import { pool } from "../app.js";

const STOP_SPEED_THRESHOLD = 2;
const STOP_DURATION_SECONDS = 120;

export async function detectStop(vehicleId, speed, lat, lng) {
  if (speed > STOP_SPEED_THRESHOLD) return null;

  const recentStop = await pool.query(
    `SELECT id, start_time FROM stops
     WHERE vehicle_id = $1 AND end_time IS NULL
     ORDER BY start_time DESC LIMIT 1`,
    [vehicleId]
  );

  if (recentStop.rows.length > 0) {
    const stop = recentStop.rows[0];
    const elapsed = (Date.now() - new Date(stop.start_time)) / 1000;

    if (elapsed >= STOP_DURATION_SECONDS) {
      await pool.query(
        `UPDATE stops SET end_time = NOW(), duration_seconds = $1
         WHERE id = $2`,
        [Math.round(elapsed), stop.id]
      );
    }
    return stop;
  }

  const result = await pool.query(
    `INSERT INTO stops (vehicle_id, geom, start_time)
     VALUES ($1, ST_SetSRID(ST_Point($2, $3), 4326), NOW())
     RETURNING id`,
    [vehicleId, lng, lat]
  );

  return result.rows[0];
}

export async function closeStop(vehicleId) {
  await pool.query(
    `UPDATE stops SET end_time = NOW(),
            duration_seconds = EXTRACT(EPOCH FROM (NOW() - start_time))
     WHERE vehicle_id = $1 AND end_time IS NULL`,
    [vehicleId]
  );
}
