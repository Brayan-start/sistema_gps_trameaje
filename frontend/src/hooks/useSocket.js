import { useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { useAuthStore } from "../store/authStore";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "";

let globalSocket = null;

export function useSocket(options = {}) {
  const { onPosition, onTramaje, onSpeedAlert, onOffRoute, onRouteStatus, onVehicleStatus, onIncident, onBackOnRoute, onReporteGenerado, onDashboardUpdate, onSancionAplicada } = options;
  const socketRef = useRef(globalSocket);

  useEffect(() => {
    const token = useAuthStore.getState().token;
    if (!token) return;

    if (!globalSocket) {
      globalSocket = io(SOCKET_URL, {
        auth: { token },
        transports: ["websocket", "polling"],
      });

      globalSocket.on("connect", () => {
        console.log("Socket conectado");
      });

      globalSocket.on("disconnect", () => {
        console.log("Socket desconectado");
      });

      globalSocket.on("connect_error", (err) => {
        console.error("Error socket:", err.message);
      });
    }

    socketRef.current = globalSocket;

    if (onPosition) globalSocket.on("vehicle_position", onPosition);
    if (onTramaje) globalSocket.on("tramaje_alert", onTramaje);
    if (onSpeedAlert) globalSocket.on("speed_alert", onSpeedAlert);
    if (onOffRoute) globalSocket.on("you_are_off_route", onOffRoute);
    if (onRouteStatus) globalSocket.on("route_status", onRouteStatus);
    if (onVehicleStatus) globalSocket.on("vehicle_status_change", onVehicleStatus);
    if (onIncident) globalSocket.on("incident_reported", onIncident);
    if (onBackOnRoute) globalSocket.on("back_on_route", onBackOnRoute);
    if (onReporteGenerado) globalSocket.on("reporte_generado", onReporteGenerado);
    if (onDashboardUpdate) globalSocket.on("dashboard_update", onDashboardUpdate);
    if (onSancionAplicada) globalSocket.on("sancion_aplicada", onSancionAplicada);

    return () => {
      if (onPosition) globalSocket.off("vehicle_position", onPosition);
      if (onTramaje) globalSocket.off("tramaje_alert", onTramaje);
      if (onSpeedAlert) globalSocket.off("speed_alert", onSpeedAlert);
      if (onOffRoute) globalSocket.off("you_are_off_route", onOffRoute);
      if (onRouteStatus) globalSocket.off("route_status", onRouteStatus);
      if (onVehicleStatus) globalSocket.off("vehicle_status_change", onVehicleStatus);
      if (onIncident) globalSocket.off("incident_reported", onIncident);
      if (onBackOnRoute) globalSocket.off("back_on_route", onBackOnRoute);
      if (onReporteGenerado) globalSocket.off("reporte_generado", onReporteGenerado);
      if (onDashboardUpdate) globalSocket.off("dashboard_update", onDashboardUpdate);
      if (onSancionAplicada) globalSocket.off("sancion_aplicada", onSancionAplicada);
    };
  }, []);

  const emit = (event, data) => {
    if (globalSocket?.connected) {
      globalSocket.emit(event, data);
    }
  };

  return { socket: globalSocket, emit };
}

export function getSocket() {
  return globalSocket;
}
