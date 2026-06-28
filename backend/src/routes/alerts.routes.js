import { Router } from "express";
import { pool } from "../app.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireRole } from "../middleware/requireRole.js";

const router = Router();

router.get("/tramaje", requireAuth, async (req, res) => {
  try {
    let query;
    const params = [];

    if (req.user.role === "driver") {
      query = `SELECT te.*, ST_X(te.geom) as lng, ST_Y(te.geom) as lat
               FROM tramaje_events te
               JOIN vehicles v ON te.vehicle_id = v.id
               WHERE v.driver_id = $1
               ORDER BY te.detected_at DESC LIMIT 100`;
      params.push(req.user.id);
    } else {
      query = `SELECT te.*, v.plate,
                      ST_X(te.geom) as lng, ST_Y(te.geom) as lat
               FROM tramaje_events te
               JOIN vehicles v ON te.vehicle_id = v.id
               ORDER BY te.detected_at DESC LIMIT 200`;
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener alertas de tramaje" });
  }
});

router.get("/speed", requireAuth, async (req, res) => {
  try {
    let query;
    const params = [];

    if (req.user.role === "driver") {
      query = `SELECT sa.*, ST_X(sa.geom) as lng, ST_Y(sa.geom) as lat
               FROM speed_alerts sa
               JOIN vehicles v ON sa.vehicle_id = v.id
               WHERE v.driver_id = $1
               ORDER BY sa.timestamp DESC LIMIT 100`;
      params.push(req.user.id);
    } else {
      query = `SELECT sa.*, v.plate,
                      ST_X(sa.geom) as lng, ST_Y(sa.geom) as lat
               FROM speed_alerts sa
               JOIN vehicles v ON sa.vehicle_id = v.id
               ORDER BY sa.timestamp DESC LIMIT 200`;
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener alertas de velocidad" });
  }
});

export default router;
