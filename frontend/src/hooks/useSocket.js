import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { useAuthStore } from "../store/authStore";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "";

let globalSocket = null;

export function useSocket(options = {}) {
  const { onPosition, onTramaje, onSpeedAlert, onOffRoute, onRouteStatus, onVehicleStatus, onIncident, onBackOnRoute, onReporteGenerado, onDashboardUpdate, onSancionAplicada } = options;
  const socketRef = useRef(globalSocket);
  const [connected, setConnected] = useState(false);
  const callbacksRef = useRef(options);
  callbacksRef.current = options;

  useEffect(() => {
    const token = useAuthStore.getState().token;
    if (!token) return;

    if (!globalSocket) {
      console.log(`[SOCKET] Conectando a: ${SOCKET_URL || "(mismo origen)"}`);
      globalSocket = io(SOCKET_URL, {
        auth: { token },
        transports: ["websocket", "polling"],
      });

      globalSocket.on("connect", () => {
        console.log(`[SOCKET] Conectado con id: ${globalSocket.id}`);
        setConnected(true);
      });

      globalSocket.on("disconnect", (reason) => {
        console.log(`[SOCKET] Desconectado: ${reason}`);
        setConnected(false);
      });

      globalSocket.on("connect_error", (err) => {
        console.error(`[SOCKET] Error de conexión a "${SOCKET_URL || "(mismo origen)"}": ${err.message}`);
        setConnected(false);
      });
    }

    socketRef.current = globalSocket;

    const handlers = {
      vehicle_position: (data) => callbacksRef.current.onPosition?.(data),
      tramaje_alert: (data) => callbacksRef.current.onTramaje?.(data),
      speed_alert: (data) => callbacksRef.current.onSpeedAlert?.(data),
      you_are_off_route: (data) => callbacksRef.current.onOffRoute?.(data),
      route_status: (data) => callbacksRef.current.onRouteStatus?.(data),
      vehicle_status_change: (data) => callbacksRef.current.onVehicleStatus?.(data),
      incident_reported: (data) => callbacksRef.current.onIncident?.(data),
      back_on_route: (data) => callbacksRef.current.onBackOnRoute?.(data),
      reporte_generado: (data) => callbacksRef.current.onReporteGenerado?.(data),
      dashboard_update: (data) => callbacksRef.current.onDashboardUpdate?.(data),
      sancion_aplicada: (data) => callbacksRef.current.onSancionAplicada?.(data),
    };

    Object.entries(handlers).forEach(([event, handler]) => {
      globalSocket.on(event, handler);
    });

    return () => {
      Object.entries(handlers).forEach(([event, handler]) => {
        globalSocket.off(event, handler);
      });
    };
  }, []);

  const emit = (event, data) => {
    if (globalSocket?.connected) {
      globalSocket.emit(event, data);
    }
  };

  return { socket: globalSocket, emit, connected };
}

export function getSocket() {
  return globalSocket;
}
