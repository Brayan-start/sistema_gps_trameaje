import { Router } from "express";
import bcrypt from "bcryptjs";
import { pool, getDashboardStats } from "../app.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireRole } from "../middleware/requireRole.js";
import { logAudit } from "../services/audit.service.js";

const router = Router();

router.get("/stats", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const stats = await getDashboardStats();
    res.json(stats);
  } catch (err) {
    console.error("[ADMIN STATS ERROR]", err);
    res.status(500).json({ error: "Error al obtener estadísticas" });
  }
});

router.get("/incidents", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const { resolved, days = 7 } = req.query;
    let query = `
      SELECT i.*, v.plate, u.name as chofer_nombre,
             ST_X(i.geom) as lng, ST_Y(i.geom) as lat
      FROM incidentes i
      JOIN vehicles v ON i.vehicle_id = v.id
      LEFT JOIN users u ON v.driver_id = u.id
      WHERE i.created_at > NOW() - INTERVAL '1 day' * $1
    `;
    const params = [days];

    if (resolved === "true") {
      query += " AND i.resuelto = TRUE";
    } else if (resolved === "false") {
      query += " AND i.resuelto = FALSE";
    }

    query += " ORDER BY i.created_at DESC LIMIT 100";

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error("[INCIDENTS ERROR]", err);
    res.status(500).json({ error: "Error al obtener incidentes" });
  }
});

router.put("/incidents/:id/resolve", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query(
      `UPDATE incidentes SET resuelto = TRUE, resuelto_por = $1, resuelto_at = NOW() WHERE id = $2`,
      [req.user.id, id]
    );
    res.json({ message: "Incidente resuelto" });
  } catch (err) {
    console.error("[RESOLVE INCIDENT ERROR]", err);
    res.status(500).json({ error: "Error al resolver incidente" });
  }
});

router.get("/drivers", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT u.id, u.name, u.email, u.is_active, u.created_at,
             v.plate as vehicle_plate, v.status as vehicle_status,
             v.last_seen_at
      FROM users u
      LEFT JOIN vehicles v ON u.vehicle_id = v.id
      WHERE u.role = 'driver'
      ORDER BY u.name
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("[DRIVERS LIST ERROR]", err);
    res.status(500).json({ error: "Error al obtener choferes" });
  }
});

router.put("/drivers/:id/toggle", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `UPDATE users SET is_active = NOT is_active WHERE id = $1 AND role = 'driver' RETURNING id, name, is_active`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Chofer no encontrado" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error("[TOGGLE DRIVER ERROR]", err);
    res.status(500).json({ error: "Error al cambiar estado" });
  }
});

router.get("/deviations", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT rd.*, v.plate, u.name as chofer_nombre,
             ST_X(rd.geom) as lng, ST_Y(rd.geom) as lat
      FROM route_deviations rd
      JOIN vehicles v ON rd.vehicle_id = v.id
      LEFT JOIN users u ON v.driver_id = u.id
      ORDER BY rd.deviation_start DESC LIMIT 100
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("[DEVIATIONS ERROR]", err);
    res.status(500).json({ error: "Error al obtener desvíos" });
  }
});

router.put("/cambiar-contrasena", requireAuth, requireRole("admin"), async (req, res) => {
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
    console.error("[ADMIN CAMBIAR CONTRASENA ERROR]", err);
    res.status(500).json({ error: "Error al cambiar contraseña" });
  }
});

router.put("/choferes/:id", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, placa, nueva_contrasena } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: "El nombre no puede estar vacío" });
    }
    if (!email || !email.trim()) {
      return res.status(400).json({ error: "El email no puede estar vacío" });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "Formato de email inválido" });
    }

    const userCheck = await pool.query(
      `SELECT id, vehicle_id FROM users WHERE id = $1 AND role = 'driver'`,
      [id]
    );
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: "Chofer no encontrado" });
    }

    const oldVehicleId = userCheck.rows[0].vehicle_id;

    let newVehicleId = null;
    if (placa && placa.trim()) {
      const vehicleRes = await pool.query(
        `SELECT id FROM vehicles WHERE plate = $1`,
        [placa.trim()]
      );
      if (vehicleRes.rows.length === 0) {
        return res.status(400).json({ error: `No se encontró vehículo con placa "${placa}"` });
      }
      newVehicleId = vehicleRes.rows[0].id;
    }

    await pool.query(
      `UPDATE users SET name = $1, email = $2, vehicle_id = $3 WHERE id = $4`,
      [name.trim(), email.trim(), newVehicleId, id]
    );

    if (oldVehicleId && oldVehicleId !== newVehicleId) {
      await pool.query(`UPDATE vehicles SET driver_id = NULL WHERE id = $1`, [oldVehicleId]);
    }
    if (newVehicleId) {
      await pool.query(`UPDATE vehicles SET driver_id = $1 WHERE id = $2`, [id, newVehicleId]);
    }

    if (nueva_contrasena && nueva_contrasena.length >= 6) {
      const hash = await bcrypt.hash(nueva_contrasena, 10);
      await pool.query(
        `UPDATE users SET password_hash = $1 WHERE id = $2`,
        [hash, id]
      );
    }

    res.json({ message: "Chofer actualizado correctamente" });
  } catch (err) {
    console.error("[EDITAR CHOFER ERROR]", err);
    res.status(500).json({ error: "Error al editar chofer" });
  }
});

router.delete("/drivers/:id", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const { id } = req.params;

    const user = await pool.query(
      `SELECT id, vehicle_id, name FROM users WHERE id = $1 AND role = 'driver'`,
      [id]
    );
    if (user.rows.length === 0) {
      return res.status(404).json({ error: "Chofer no encontrado" });
    }

    const driver = user.rows[0];

    if (driver.vehicle_id) {
      await pool.query(
        `UPDATE vehicles SET driver_id = NULL WHERE id = $1`,
        [driver.vehicle_id]
      );
    }

    await pool.query(
      `UPDATE users SET is_active = FALSE, vehicle_id = NULL WHERE id = $1`,
      [id]
    );

    logAudit({
      user_id: req.user.id,
      usuario_nombre: req.user.name,
      accion: "ELIMINAR_CHOFER",
      detalle: `Chofer "${driver.name}" (id:${id}) eliminado del sistema`,
      tipo: "admin",
      ip_address: req.ip,
    });

    res.json({ message: "Chofer eliminado correctamente" });
  } catch (err) {
    console.error("[DELETE DRIVER ERROR]", err);
    res.status(500).json({ error: "Error al eliminar chofer" });
  }
});

export default router;
