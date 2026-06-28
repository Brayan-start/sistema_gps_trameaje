import { Router } from "express";
import bcrypt from "bcryptjs";
import { pool } from "../app.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireRole } from "../middleware/requireRole.js";

const router = Router();

router.get("/ruta-activa", requireAuth, requireRole("driver"), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT status, id as vehicle_id FROM vehicles WHERE driver_id = $1`,
      [req.user.id]
    );
    if (result.rows.length === 0) {
      return res.json({ activa: false, vehicleId: null });
    }
    const vehicle = result.rows[0];
    res.json({
      activa: vehicle.status === "on_route",
      vehicleId: vehicle.vehicle_id,
    });
  } catch (err) {
    console.error("[RUTA ACTIVA ERROR]", err);
    res.status(500).json({ error: "Error al consultar ruta activa" });
  }
});

router.get("/mis-sanciones", requireAuth, requireRole("driver"), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT s.id, s.tipo_sancion, s.descripcion, s.fecha_aplicacion,
             i.inicio as incidente_inicio, i.duracion_segundos,
             i.descripcion as incidente_descripcion
      FROM sanciones s
      JOIN incidentes i ON s.incidente_id = i.id
      WHERE s.chofer_id = $1
      ORDER BY s.fecha_aplicacion DESC
    `, [req.user.id]);
    res.json(result.rows);
  } catch (err) {
    console.error("[MIS SANCIONES ERROR]", err);
    res.status(500).json({ error: "Error al obtener sanciones" });
  }
});

router.put("/cambiar-contrasena", requireAuth, requireRole("driver"), async (req, res) => {
  try {
    const { actual, nueva, confirmacion } = req.body;

    if (!actual || !nueva || !confirmacion) {
      return res.status(400).json({ error: "Todos los campos son requeridos" });
    }
    if (nueva.length < 6) {
      return res.status(400).json({ error: "La nueva contraseña debe tener al menos 6 caracteres" });
    }
    if (nueva !== confirmacion) {
      return res.status(400).json({ error: "Las contraseñas nuevas no coinciden" });
    }

    const user = await pool.query(
      `SELECT password_hash FROM users WHERE id = $1`,
      [req.user.id]
    );
    if (user.rows.length === 0) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    const match = await bcrypt.compare(actual, user.rows[0].password_hash);
    if (!match) {
      return res.status(400).json({ error: "La contraseña actual es incorrecta" });
    }

    const hash = await bcrypt.hash(nueva, 10);
    await pool.query(
      `UPDATE users SET password_hash = $1 WHERE id = $2`,
      [hash, req.user.id]
    );

    res.json({ message: "Contraseña actualizada correctamente" });
  } catch (err) {
    console.error("[CAMBIAR CONTRASENA ERROR]", err);
    res.status(500).json({ error: "Error al cambiar contraseña" });
  }
});

export default router;
