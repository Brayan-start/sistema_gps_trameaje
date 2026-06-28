import { Router } from "express";
import { pool } from "../app.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireRole } from "../middleware/requireRole.js";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  try {
    if (req.user.role === "driver") {
      const result = await pool.query(
        "SELECT * FROM vehicles WHERE driver_id = $1",
        [req.user.id]
      );
      return res.json(result.rows);
    }

    const result = await pool.query(
      `SELECT v.*, u.name as driver_name
       FROM vehicles v
       LEFT JOIN users u ON v.driver_id = u.id
       ORDER BY v.id`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener vehículos" });
  }
});

router.get("/active", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT v.id, v.plate, v.brand, v.model, v.status,
              ST_X(gp.geom) as lng, ST_Y(gp.geom) as lat,
              gp.speed_kmh, gp.timestamp, gp.is_on_route
       FROM vehicles v
       JOIN LATERAL (
         SELECT geom, speed_kmh, timestamp, is_on_route
         FROM gps_positions
         WHERE vehicle_id = v.id
         ORDER BY timestamp DESC
         LIMIT 1
       ) gp ON true
       WHERE v.status IN ('on_route', 'stopped')
       AND gp.timestamp > NOW() - INTERVAL '5 minutes'`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener vehículos activos" });
  }
});

router.post("/", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const { plate, brand, model, year } = req.body;
    if (!plate || !brand || !model || !year) {
      return res.status(400).json({ error: "Todos los campos son requeridos" });
    }

    const result = await pool.query(
      `INSERT INTO vehicles (plate, brand, model, year)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [plate, brand, model, year]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al crear vehículo" });
  }
});

router.put("/:id", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const { id } = req.params;
    const { plate, brand, model, year, status, driver_id } = req.body;

    const result = await pool.query(
      `UPDATE vehicles SET plate = COALESCE($1, plate),
                           brand = COALESCE($2, brand),
                           model = COALESCE($3, model),
                           year = COALESCE($4, year),
                           status = COALESCE($5, status),
                           driver_id = COALESCE($6, driver_id)
       WHERE id = $7 RETURNING *`,
      [plate, brand, model, year, status, driver_id, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Vehículo no encontrado" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al actualizar vehículo" });
  }
});

router.delete("/:id", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("DELETE FROM vehicles WHERE id = $1", [id]);
    res.json({ message: "Vehículo eliminado" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al eliminar vehículo" });
  }
});

export default router;
