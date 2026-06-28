import { Router } from "express";
import bcrypt from "bcryptjs";
import { pool } from "../app.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireRole } from "../middleware/requireRole.js";

const router = Router();

router.get("/", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.name, u.email, u.role, u.vehicle_id, u.is_active, u.created_at,
              v.plate as vehicle_plate
       FROM users u
       LEFT JOIN vehicles v ON u.vehicle_id = v.id
       ORDER BY u.id`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener usuarios" });
  }
});

router.post("/", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const { name, email, password, role, vehicle_id } = req.body;
    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: "Campos requeridos: name, email, password, role" });
    }

    if (!["admin", "driver", "passenger"].includes(role)) {
      return res.status(400).json({ error: "Rol inválido" });
    }

    const password_hash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, vehicle_id)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, role, vehicle_id`,
      [name, email, password_hash, role, vehicle_id || null]
    );

    if (vehicle_id && role === "driver") {
      await pool.query("UPDATE vehicles SET driver_id = $1 WHERE id = $2", [
        result.rows[0].id,
        vehicle_id,
      ]);
    }

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al crear usuario" });
  }
});

router.put("/:id", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, password, role, is_active, vehicle_id } = req.body;

    let query = "UPDATE users SET ";
    const params = [];
    const sets = [];

    if (name) { sets.push(`name = $${params.length + 1}`); params.push(name); }
    if (email) { sets.push(`email = $${params.length + 1}`); params.push(email); }
    if (role) { sets.push(`role = $${params.length + 1}`); params.push(role); }
    if (is_active !== undefined) { sets.push(`is_active = $${params.length + 1}`); params.push(is_active); }
    if (vehicle_id !== undefined) { sets.push(`vehicle_id = $${params.length + 1}`); params.push(vehicle_id); }
    if (password) {
      const hash = await bcrypt.hash(password, 10);
      sets.push(`password_hash = $${params.length + 1}`);
      params.push(hash);
    }

    if (sets.length === 0) {
      return res.status(400).json({ error: "Nada que actualizar" });
    }

    sets.push(`updated_at = NOW()`);
    params.push(id);

    const result = await pool.query(
      `UPDATE users SET ${sets.join(", ")} WHERE id = $${params.length} RETURNING id, name, email, role, is_active, vehicle_id`,
      params
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al actualizar usuario" });
  }
});

router.delete("/:id", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("UPDATE vehicles SET driver_id = NULL WHERE driver_id = $1", [id]);
    await pool.query("DELETE FROM users WHERE id = $1", [id]);
    res.json({ message: "Usuario eliminado" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al eliminar usuario" });
  }
});

export default router;
