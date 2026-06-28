import { Router } from "express";
import { pool } from "../app.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireRole } from "../middleware/requireRole.js";

const router = Router();

router.get("/:vehicleId", requireAuth, async (req, res) => {
  try {
    const { vehicleId } = req.params;
    const { from, to } = req.query;

    if (req.user.role === "driver") {
      const check = await pool.query(
        "SELECT id FROM vehicles WHERE id = $1 AND driver_id = $2",
        [vehicleId, req.user.id]
      );
      if (check.rows.length === 0) {
        return res.status(403).json({ error: "No tienes acceso a este vehículo" });
      }
    }

    let query = `SELECT id, vehicle_id,
                        ST_X(geom) as lng, ST_Y(geom) as lat,
                        speed_kmh, timestamp, is_on_route
                 FROM gps_positions
                 WHERE vehicle_id = $1`;
    const params = [vehicleId];

    if (from) {
      params.push(from);
      query += ` AND timestamp >= $${params.length}`;
    }
    if (to) {
      params.push(to);
      query += ` AND timestamp <= $${params.length}`;
    }

    query += " ORDER BY timestamp ASC LIMIT 10000";

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener historial" });
  }
});

router.get("/:vehicleId/csv", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const { vehicleId } = req.params;
    const { from, to } = req.query;

    let query = `SELECT v.plate,
                        ST_X(gp.geom) as lng, ST_Y(gp.geom) as lat,
                        gp.speed_kmh, gp.timestamp, gp.is_on_route
                 FROM gps_positions gp
                 JOIN vehicles v ON gp.vehicle_id = v.id
                 WHERE gp.vehicle_id = $1`;
    const params = [vehicleId];

    if (from) {
      params.push(from);
      query += ` AND gp.timestamp >= $${params.length}`;
    }
    if (to) {
      params.push(to);
      query += ` AND gp.timestamp <= $${params.length}`;
    }

    query += " ORDER BY gp.timestamp ASC LIMIT 50000";

    const result = await pool.query(query, params);

    const header = "placa,lat,lng,velocidad_kmh,timestamp,en_ruta\n";
    const rows = result.rows
      .map((r) => `${r.plate},${r.lat},${r.lng},${r.speed_kmh},${r.timestamp},${r.is_on_route}`)
      .join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=historial_${vehicleId}.csv`);
    res.send(header + rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al exportar CSV" });
  }
});

router.get("/reports/summary", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const tramajeCount = await pool.query(`
      SELECT v.plate, COUNT(te.id) as tramajes,
             ROUND(AVG(te.distance_from_route_m)) as distancia_promedio
      FROM tramaje_events te
      JOIN vehicles v ON te.vehicle_id = v.id
      WHERE te.detected_at > NOW() - INTERVAL '7 days'
      GROUP BY v.plate
      ORDER BY tramajes DESC
    `);

    const avgSpeed = await pool.query(`
      SELECT v.plate,
             ROUND(AVG(gp.speed_kmh), 1) as velocidad_promedio,
             MAX(gp.speed_kmh) as velocidad_maxima,
             COUNT(*) as lecturas
      FROM gps_positions gp
      JOIN vehicles v ON gp.vehicle_id = v.id
      WHERE gp.timestamp > NOW() - INTERVAL '7 days'
      GROUP BY v.plate
      ORDER BY velocidad_promedio DESC
    `);

    res.json({ tramajeCount: tramajeCount.rows, avgSpeed: avgSpeed.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener reportes" });
  }
});

export default router;
