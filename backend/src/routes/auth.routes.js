import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { pool } from "../app.js";
import { logAudit } from "../services/audit.service.js";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret";

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email y contraseña requeridos" });
    }

    console.log(`[LOGIN] Intento de login para email: "${email}"`);

    let result;
    try {
      result = await pool.query(
        "SELECT id, name, email, password_hash, role, vehicle_id, is_active FROM users WHERE email = $1",
        [email]
      );
    } catch (dbErr) {
      console.error(`[LOGIN ERROR DB] Error de base de datos para email="${email}":`, dbErr.message);
      console.error(dbErr.stack);
      return res.status(500).json({ error: "Error de base de datos" });
    }

    if (result.rows.length === 0) {
      console.log(`[LOGIN] No se encontró usuario con email: "${email}"`);
      return res.status(401).json({ error: "Credenciales inválidas" });
    }

    const user = result.rows[0];
    console.log(`[LOGIN] Usuario encontrado: id=${user.id}, role=${user.role}, is_active=${user.is_active}`);
    console.log(`[LOGIN] password_hash length: ${user.password_hash.length}, prefix: ${user.password_hash.substring(0, 7)}`);

    if (!user.is_active) {
      console.log(`[LOGIN] Usuario desactivado: id=${user.id}`);
      return res.status(403).json({ error: "Cuenta desactivada" });
    }

    let valid;
    try {
      valid = await bcrypt.compare(password, user.password_hash);
    } catch (bcryptErr) {
      console.error(`[LOGIN ERROR BCRYPT] bcrypt.compare falló para email="${email}":`, bcryptErr.message);
      console.error(`hash recibido: "${user.password_hash}"`);
      return res.status(500).json({ error: "Error al verificar contraseña" });
    }

    if (!valid) {
      console.log(`[LOGIN] Contraseña INCORRECTA para email="${email}". Hash: "${user.password_hash}"`);
      return res.status(401).json({ error: "Credenciales inválidas" });
    }

    console.log(`[LOGIN] Login exitoso: id=${user.id}, email=${user.email}, role=${user.role}`);

    logAudit({
      user_id: user.id,
      usuario_nombre: user.name,
      accion: "LOGIN",
      detalle: `Login exitoso desde ${req.ip || "desconocido"}`,
      tipo: "auth",
      ip_address: req.ip,
    });

    const payload = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      vehicle_id: user.vehicle_id,
    };

    let token;
    try {
      token = jwt.sign(payload, JWT_SECRET, { expiresIn: "24h" });
    } catch (jwtErr) {
      console.error(`[LOGIN ERROR JWT] Error al firmar token:`, jwtErr.message);
      return res.status(500).json({ error: "Error al generar token" });
    }

    res.json({ token, user: payload });
  } catch (err) {
    console.error(`[LOGIN ERROR UNEXPECTED] Error no manejado en login:`, err);
    console.error(err.stack);
    res.status(500).json({ error: "Error del servidor" });
  }
});

export default router;
