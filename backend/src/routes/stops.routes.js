import { Router } from "express";
import { pool } from "../app.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireRole } from "../middleware/requireRole.js";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  try {
    let query;
    const params = [];

    if (req.user.role === "driver") {
      query = `SELECT s.*, ST_X(s.geom) as lng, ST_Y(s.geom) as lat
               FROM stops s
               JOIN vehicles v ON s.vehicle_id = v.id
               WHERE v.driver_id = $1
               ORDER BY s.start_time DESC LIMIT 50`;
      params.push(req.user.id);
    } else {
      query = `SELECT s.*, v.plate,
                      ST_X(s.geom) as lng, ST_Y(s.geom) as lat
               FROM stops s
               JOIN vehicles v ON s.vehicle_id = v.id
               ORDER BY s.start_time DESC LIMIT 200`;
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener paradas" });
  }
});

export default router;
