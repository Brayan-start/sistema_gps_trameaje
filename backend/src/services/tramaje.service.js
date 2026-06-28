import { pool } from "../app.js";

export const OFF_ROUTE_THRESHOLD = 200;
export const ON_ROUTE_THRESHOLD = 120;

export async function checkRouteDistance(vehicleId, lat, lng) {
  const result = await pool.query(
    `SELECT ST_Distance(
       ST_SetSRID(ST_Point($1, $2), 4326)::geography,
       geom::geography
     ) AS dist
     FROM authorized_route WHERE id = 1`,
    [lng, lat]
  );

  if (result.rows.length === 0) return { isOnRoute: true, distance: 0, zone: "on_route" };

  const distance = result.rows[0].dist;

  let zone;
  if (distance > OFF_ROUTE_THRESHOLD) {
    zone = "off_route";
  } else if (distance <= ON_ROUTE_THRESHOLD) {
    zone = "on_route";
  } else {
    zone = "intermediate";
  }

  return { isOnRoute: distance <= OFF_ROUTE_THRESHOLD, distance, zone };
}

export async function saveTramaje(vehicleId, lat, lng, distance) {
  const result = await pool.query(
    `INSERT INTO tramaje_events (vehicle_id, geom, distance_from_route_m, detected_at)
     VALUES ($1, ST_SetSRID(ST_Point($2, $3), 4326), $4, NOW())
     RETURNING id`,
    [vehicleId, lng, lat, distance]
  );
  return result.rows[0].id;
}

export async function hasRecentTramaje(vehicleId, minutes = 5) {
  const result = await pool.query(
    `SELECT id FROM tramaje_events
     WHERE vehicle_id = $1
     AND detected_at > NOW() - INTERVAL '1 minute'
     AND resolved_at IS NULL
     LIMIT 1`,
    [vehicleId]
  );
  return result.rows.length > 0;
}
