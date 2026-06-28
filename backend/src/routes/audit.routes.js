import { Router } from "express";
import { pool } from "../app.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireRole } from "../middleware/requireRole.js";

const router = Router();

router.get("/", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const { tipo, days = 7, limit = 200 } = req.query;

    let query = `SELECT * FROM audit_log WHERE created_at > NOW() - INTERVAL '1 day' * $1`;
    const params = [days];

    if (tipo) {
      params.push(tipo);
      query += ` AND tipo = $${params.length}`;
    }

    query += " ORDER BY created_at DESC LIMIT " + parseInt(limit);

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error("[AUDIT LIST ERROR]", err);
    res.status(500).json({ error: "Error al obtener auditoría" });
  }
});

router.get("/tipos", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT DISTINCT tipo FROM audit_log ORDER BY tipo`
    );
    res.json(result.rows.map((r) => r.tipo));
  } catch (err) {
    console.error("[AUDIT TYPES ERROR]", err);
    res.json([]);
  }
});

export default router;
