import jwt from "jsonwebtoken";
import { savePosition } from "../services/gps.service.js";
import { checkRouteDistance, saveTramaje } from "../services/tramaje.service.js";
import { checkAndSaveSpeedAlert } from "../services/speed.service.js";
import { detectStop, closeStop } from "../services/stops.service.js";
import {
  startDeviation,
  resolveDeviation,
  getActiveDeviation,
  generateIncident,
  getGracePeriod,
} from "../services/deviation.service.js";
import { logAudit } from "../services/audit.service.js";

const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret";
const GRACE_MS = getGracePeriod() * 1000;
const deviationTimers = new Map();
const consecutiveOnRoute = new Map();
const ON_ROUTE_CONSECUTIVE_REQUIRED = 2;

async function emitDashboardUpdate(io) {
  try {
    const { getDashboardStats } = await import("../app.js");
    const stats = await getDashboardStats();
    io.to("admins").emit("dashboard_update", stats);
  } catch (_) {}
}

async function getDriverName(vehicleId) {
  try {
    const { pool } = await import("../app.js");
    const res = await pool.query(
      `SELECT u.name FROM vehicles v JOIN users u ON v.driver_id = u.id WHERE v.id = $1`,
      [vehicleId]
    );
    return res.rows[0]?.name || null;
  } catch { return null; }
}

async function startTimerForDeviation(io, socket, vehicleId, devId, devStart, lat, lng) {
  const elapsed = devStart ? Date.now() - new Date(devStart).getTime() : 0;
  const remainingMs = Math.max(0, GRACE_MS - elapsed);

  const timer = setTimeout(async () => {
    const stillOff = await getActiveDeviation(vehicleId);
    if (stillOff) {
      const incidentId = await generateIncident(vehicleId, devId, lat, lng, devStart);
      const driverName = await getDriverName(vehicleId);

      io.to("admins").emit("incident_reported", {
        vehicleId,
        incidentId,
        devId,
        timestamp: new Date().toISOString(),
        driver_name: driverName,
      });
      socket.emit("reporte_generado", {
        message: "Se ha generado un reporte por permanecer fuera de ruta",
        incidentId,
      });

      await emitDashboardUpdate(io);
    }
    deviationTimers.set(vehicleId, { incidentGenerated: true });
  }, remainingMs);

  deviationTimers.set(vehicleId, { timer, startTime: Date.now() });
}

export async function recoverDeviationTimers(io) {
  try {
    const { pool } = await import("../app.js");
    const result = await pool.query(
      `SELECT id, vehicle_id, deviation_start,
              ST_X(geom) as lng, ST_Y(geom) as lat
       FROM route_deviations
       WHERE deviation_end IS NULL AND resolved = FALSE`
    );

    for (const dev of result.rows) {
      const elapsed = Date.now() - new Date(dev.deviation_start).getTime();

      if (elapsed >= GRACE_MS) {
        try {
          const incidentId = await generateIncident(dev.vehicle_id, dev.id, dev.lat, dev.lng, dev.deviation_start);
          console.log(`[RECOVERY] Incidente generado para vehículo ${dev.vehicle_id} (desviación ${dev.id}) — tiempo excedido durante reinicio`);
          io.to("admins").emit("incident_reported", {
            vehicleId: dev.vehicle_id,
            incidentId,
            devId: dev.id,
            timestamp: new Date().toISOString(),
          });
          await emitDashboardUpdate(io);
        } catch (err) {
          console.error(`[RECOVERY] Error generando incidente para vehículo ${dev.vehicle_id}:`, err.message);
        }
        deviationTimers.set(dev.vehicle_id, { incidentGenerated: true });
      } else {
        const remainingMs = GRACE_MS - elapsed;
        const timer = setTimeout(async () => {
          const stillOff = await getActiveDeviation(dev.vehicle_id);
          if (stillOff) {
            try {
              const incidentId = await generateIncident(dev.vehicle_id, dev.id, dev.lat, dev.lng, dev.deviation_start);
              console.log(`[RECOVERY] Incidente generado para vehículo ${dev.vehicle_id} (desviación ${dev.id}) — timer recuperado expiró`);
              io.to("admins").emit("incident_reported", {
                vehicleId: dev.vehicle_id,
                incidentId,
                devId: dev.id,
                timestamp: new Date().toISOString(),
              });
              await emitDashboardUpdate(io);
            } catch (err) {
              console.error(`[RECOVERY] Error generando incidente para vehículo ${dev.vehicle_id}:`, err.message);
            }
          }
          deviationTimers.set(dev.vehicle_id, { incidentGenerated: true });
        }, remainingMs);

        deviationTimers.set(dev.vehicle_id, { timer, startTime: Date.now() });
        console.log(`[RECOVERY] Timer restaurado para vehículo ${dev.vehicle_id}: ${Math.round(remainingMs / 1000)}s restantes`);
      }
    }
  } catch (err) {
    console.error("[RECOVERY] Error recuperando desvíos activos:", err.message);
  }
}

export function setupGpsSocket(io) {
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      socket.user = { role: "public" };
      console.log(`[SOCKET] Público conectado (socket: ${socket.id})`);
      return next();
    }
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      socket.user = decoded;

      switch (decoded.role) {
        case "admin":
          socket.join("admins");
          console.log(`[SOCKET] Admin conectado: ${decoded.name} (socket: ${socket.id})`);
          break;
        case "driver":
          socket.join(`user_${decoded.id}`);
          if (decoded.vehicle_id) {
            socket.join(`driver_${decoded.vehicle_id}`);
            console.log(`[SOCKET] Driver conectado: ${decoded.name} vehículo:${decoded.vehicle_id} (socket: ${socket.id})`);
          }
          break;
      }

      next();
    } catch {
      next(new Error("Token inválido"));
    }
  });

  io.on("connection", (socket) => {
    socket.on("gps_update", async ({ vehicleId, lat, lng, speed }) => {
      if (socket.user.role !== "driver" || socket.user.vehicle_id !== vehicleId) {
        socket.emit("error", "No autorizado para enviar GPS de este vehículo");
        return;
      }

      try {
        await savePosition(vehicleId, lat, lng, speed);

        const { distance, zone, isOnRoute } = await checkRouteDistance(vehicleId, lat, lng);

        await detectStop(vehicleId, speed, lat, lng);

        if (zone === "off_route") {
          consecutiveOnRoute.set(vehicleId, 0);

          const devState = deviationTimers.get(vehicleId);
          if (!devState?.incidentGenerated) {
            const deviation = await getActiveDeviation(vehicleId);

            if (!deviation) {
              const devId = await startDeviation(vehicleId, lat, lng, distance);
              await startTimerForDeviation(io, socket, vehicleId, devId, new Date().toISOString(), lat, lng);

              socket.emit("you_are_off_route", {
                message: "Usted está fuera de su ruta, por favor ingrese a su ruta",
                distance: Math.round(distance),
                graceSeconds: getGracePeriod(),
                deviationId: devId,
              });

              io.to("admins").emit("tramaje_alert", {
                vehicleId,
                lat,
                lng,
                distance: Math.round(distance),
                timestamp: new Date().toISOString(),
              });

              await emitDashboardUpdate(io);
            } else {
              const elapsed = Math.floor((Date.now() - new Date(deviation.deviation_start)) / 1000);
              const remaining = Math.max(0, getGracePeriod() - elapsed);

              if (!deviationTimers.has(vehicleId)) {
                await startTimerForDeviation(io, socket, vehicleId, deviation.id, deviation.deviation_start, lat, lng);
              }

              socket.emit("you_are_off_route", {
                message: "Usted está fuera de su ruta, por favor ingrese a su ruta",
                distance: Math.round(distance),
                graceSeconds: remaining,
                deviationId: deviation.id,
              });
            }

            await saveTramaje(vehicleId, lat, lng, distance);
          }
        } else if (zone === "intermediate") {
          consecutiveOnRoute.set(vehicleId, 0);
        } else {
          const existing = deviationTimers.get(vehicleId);

          if (existing) {
            const count = (consecutiveOnRoute.get(vehicleId) || 0) + 1;
            consecutiveOnRoute.set(vehicleId, count);

            if (count >= ON_ROUTE_CONSECUTIVE_REQUIRED) {
              clearTimeout(existing.timer);
              deviationTimers.delete(vehicleId);
              consecutiveOnRoute.set(vehicleId, 0);

              const resolved = await resolveDeviation(vehicleId);
              if (resolved) {
                console.log(`[DEVIATION] Vehículo ${vehicleId} volvió a la ruta tras ${resolved.duration}s`);
              }

              socket.emit("back_on_route", { message: "Has vuelto a la ruta autorizada" });
              await emitDashboardUpdate(io);
            }
          } else {
            const activeDeviation = await getActiveDeviation(vehicleId);
            if (activeDeviation) {
              const resolved = await resolveDeviation(vehicleId);
              if (resolved) {
                console.log(`[DEVIATION] Vehículo ${vehicleId} — desviación persistente resuelta (restart recovery, was ${resolved.duration}s)`);
              }
              socket.emit("back_on_route", { message: "Has vuelto a la ruta autorizada" });
              await emitDashboardUpdate(io);
            }
            consecutiveOnRoute.set(vehicleId, 0);
          }
        }

        if (speed > 60) {
          const alertId = await checkAndSaveSpeedAlert(vehicleId, speed, lat, lng);
          if (alertId) {
            io.to("admins").emit("speed_alert", {
              vehicleId,
              speed,
              lat,
              lng,
              timestamp: new Date().toISOString(),
            });
          }
        }

        let plate = null;
        let driverName = null;
        try {
          const { pool } = await import("../app.js");
          const vRes = await pool.query(
            `SELECT v.plate, u.name as driver_name FROM vehicles v LEFT JOIN users u ON v.driver_id = u.id WHERE v.id = $1`,
            [vehicleId]
          );
          if (vRes.rows.length > 0) {
            plate = vRes.rows[0].plate;
            driverName = vRes.rows[0].driver_name;
          }
        } catch (_) {}

        io.emit("vehicle_position", {
          vehicleId,
          lat,
          lng,
          speed: speed || 0,
          isOnRoute,
          timestamp: new Date().toISOString(),
          plate,
          driver_name: driverName,
        });

        await closeStop(vehicleId);
      } catch (err) {
        console.error("Error procesando gps_update:", err);
        socket.emit("error", "Error al procesar posición GPS");
      }
    });

    socket.on("start_route", async ({ vehicleId }) => {
      if (socket.user.role !== "driver" || socket.user.vehicle_id !== vehicleId) {
        return socket.emit("error", "No autorizado");
      }

      const { pool } = await import("../app.js");

      await pool.query(
        "UPDATE vehicles SET status = 'on_route' WHERE id = $1",
        [vehicleId]
      );

      await logAudit({
        user_id: socket.user.id,
        usuario_nombre: socket.user.name,
        accion: "INICIO_RUTA",
        detalle: `Vehículo #${vehicleId} inició ruta`,
        tipo: "ruta",
      });

      socket.emit("route_status", { status: "on_route" });
      io.to("admins").emit("vehicle_status_change", { vehicleId, status: "on_route" });
      await emitDashboardUpdate(io);
    });

    socket.on("stop_route", async ({ vehicleId }) => {
      if (socket.user.role !== "driver" || socket.user.vehicle_id !== vehicleId) {
        return socket.emit("error", "No autorizado");
      }

      const { pool } = await import("../app.js");
      await pool.query(
        "UPDATE vehicles SET status = 'inactive' WHERE id = $1",
        [vehicleId]
      );

      const existing = deviationTimers.get(vehicleId);
      if (existing) {
        clearTimeout(existing.timer);
        deviationTimers.delete(vehicleId);
      }

      consecutiveOnRoute.delete(vehicleId);

      await resolveDeviation(vehicleId);

      await logAudit({
        user_id: socket.user.id,
        usuario_nombre: socket.user.name,
        accion: "FIN_RUTA",
        detalle: `Vehículo #${vehicleId} finalizó ruta`,
        tipo: "ruta",
      });

      socket.emit("route_status", { status: "inactive" });
      io.to("admins").emit("vehicle_status_change", { vehicleId, status: "inactive" });
      await emitDashboardUpdate(io);

      const { closeStop } = await import("../services/stops.service.js");
      await closeStop(vehicleId);
    });

    socket.on("disconnect", async () => {
      const userId = socket.user?.id;
      const vehicleId = socket.user?.vehicle_id;

      if (socket.user?.role === "driver" && vehicleId) {
        try {
          const { pool } = await import("../app.js");
          const statusRes = await pool.query(
            `SELECT status FROM vehicles WHERE id = $1`,
            [vehicleId]
          );

          if (statusRes.rows.length > 0 && statusRes.rows[0].status === "on_route") {
            const existing = deviationTimers.get(vehicleId);
            if (existing) {
              clearTimeout(existing.timer);
              deviationTimers.delete(vehicleId);
            }
            consecutiveOnRoute.delete(vehicleId);

            await resolveDeviation(vehicleId);

            await pool.query(
              `UPDATE vehicles SET status = 'inactive' WHERE id = $1`,
              [vehicleId]
            );

            await logAudit({
              user_id: userId,
              usuario_nombre: socket.user.name,
              accion: "FIN_RUTA",
              detalle: `Vehículo #${vehicleId} — ruta finalizada automáticamente por desconexión`,
              tipo: "ruta",
            });

            io.to("admins").emit("vehicle_status_change", { vehicleId, status: "inactive" });
            await emitDashboardUpdate(io);

            const { closeStop } = await import("../services/stops.service.js");
            await closeStop(vehicleId);

            console.log(`[SOCKET] Ruta auto-finalizada para vehículo ${vehicleId} (${socket.user.name}) por desconexión`);
          }
        } catch (err) {
          console.error(`[SOCKET] Error auto-finalizando ruta para vehículo ${vehicleId}:`, err.message);
        }
      }

      console.log(`[SOCKET] Desconectado: ${socket.user?.name || socket.id}`);
    });
  });
}
