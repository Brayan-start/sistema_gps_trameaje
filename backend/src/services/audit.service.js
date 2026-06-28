import { pool } from "../app.js";

export async function logAudit({ user_id, usuario_nombre, accion, detalle, tipo = "general", ip_address = null }) {
  try {
    await pool.query(
      `INSERT INTO audit_log (user_id, usuario_nombre, accion, detalle, tipo, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [user_id, usuario_nombre, accion, detalle, tipo, ip_address]
    );
  } catch (err) {
    console.error("[AUDIT] Error al registrar auditoría:", err.message);
  }
}
