import { Router } from "express";
import { pool } from "../app.js";

const router = Router();

router.get("/positions", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT v.id, v.plate,
             ST_X(gp.geom) as lng, ST_Y(gp.geom) as lat,
             gp.speed_kmh, gp.timestamp, gp.is_on_route,
             u.name as driver_name
      FROM vehicles v
      JOIN LATERAL (
        SELECT geom, speed_kmh, timestamp, is_on_route
        FROM gps_positions
        WHERE vehicle_id = v.id
        ORDER BY timestamp DESC
        LIMIT 1
      ) gp ON true
      LEFT JOIN users u ON v.driver_id = u.id
      WHERE v.status IN ('on_route', 'stopped')
      AND gp.timestamp > NOW() - INTERVAL '5 minutes'
      ORDER BY v.plate
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener posiciones" });
  }
});

router.get("/route", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, name,
             ST_AsGeoJSON(geom)::jsonb as geometry
      FROM authorized_route
      ORDER BY id LIMIT 1
    `);
    res.json(result.rows[0] || null);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener ruta" });
  }
});

export default router;
