import { Router } from "express";
import { pool } from "../app.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireRole } from "../middleware/requireRole.js";
import { logAudit } from "../services/audit.service.js";
import { getSocketIO } from "../services/socket.service.js";

const router = Router();

router.get("/pendientes", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT i.id, i.vehicle_id, i.inicio, i.fin, i.duracion_segundos, i.descripcion,
             v.plate, u.name as chofer_nombre, u.id as chofer_id,
             ST_X(i.geom) as lng, ST_Y(i.geom) as lat
      FROM incidentes i
      JOIN vehicles v ON i.vehicle_id = v.id
      LEFT JOIN users u ON v.driver_id = u.id
      WHERE i.tipo = 'off_route'
        AND i.id NOT IN (SELECT incidente_id FROM sanciones)
      ORDER BY i.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("[SANCIONES PENDIENTES ERROR]", err);
    res.status(500).json({ error: "Error al obtener pendientes" });
  }
});

router.get("/historial", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT s.id, s.incidente_id, s.tipo_sancion, s.descripcion, s.fecha_aplicacion,
             u_chofer.name as chofer_nombre, u_admin.name as admin_nombre,
             v.plate, i.inicio, i.duracion_segundos
      FROM sanciones s
      JOIN incidentes i ON s.incidente_id = i.id
      JOIN vehicles v ON i.vehicle_id = v.id
      JOIN users u_chofer ON s.chofer_id = u_chofer.id
      JOIN users u_admin ON s.aplicada_por = u_admin.id
      ORDER BY s.fecha_aplicacion DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("[SANCIONES HISTORIAL ERROR]", err);
    res.status(500).json({ error: "Error al obtener historial" });
  }
});

router.post("/aplicar", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const { incidente_id, chofer_id, tipo_sancion, descripcion } = req.body;

    if (!incidente_id || !chofer_id || !tipo_sancion) {
      return res.status(400).json({ error: "incidente_id, chofer_id, tipo_sancion requeridos" });
    }

    const tiposValidos = ["Amonestación verbal", "Amonestación escrita", "Suspensión temporal", "Suspensión definitiva"];
    if (!tiposValidos.includes(tipo_sancion)) {
      return res.status(400).json({ error: "Tipo de sanción inválido" });
    }

    const result = await pool.query(
      `INSERT INTO sanciones (incidente_id, chofer_id, tipo_sancion, descripcion, aplicada_por)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [incidente_id, chofer_id, tipo_sancion, descripcion || null, req.user.id]
    );

    await logAudit({
      user_id: req.user.id,
      usuario_nombre: req.user.name,
      accion: "APLICAR_SANCION",
      detalle: `Sanción "${tipo_sancion}" aplicada al chofer #${chofer_id} por incidente #${incidente_id}`,
      tipo: "sancion",
    });

    try {
      const io = getSocketIO();
      if (io) {
        io.to(`user_${chofer_id}`).emit("sancion_aplicada", {
          tipo_sancion,
          descripcion: descripcion || null,
          fecha: new Date().toISOString(),
        });
      }
    } catch (_) {}

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("[APLICAR SANCION ERROR]", err);
    res.status(500).json({ error: "Error al aplicar sanción" });
  }
});

router.get("/tipos", requireAuth, requireRole("admin"), (req, res) => {
  res.json([
    "Amonestación verbal",
    "Amonestación escrita",
    "Suspensión temporal",
    "Suspensión definitiva",
  ]);
});

export default router;
