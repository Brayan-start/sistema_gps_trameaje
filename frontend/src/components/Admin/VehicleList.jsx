import { useAuthStore } from "../../store/authStore";

const API = import.meta.env.VITE_API_URL || "";

export default function VehicleList({ vehicles, setVehicles }) {
  const token = useAuthStore((s) => s.token);

  const handleDelete = async (id) => {
    if (!confirm("¿Eliminar este vehículo permanentemente?")) return;
    try {
      const res = await fetch(`${API}/vehicles/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      setVehicles((prev) => prev.filter((v) => v.id !== id));
    } catch (err) {
      console.error("[DELETE VEHICLE ERROR]", err);
    }
  };

  const statusColor = (status) => {
    switch (status) {
      case "on_route": return "bg-green-500";
      case "stopped": return "bg-yellow-500";
      case "active": return "bg-accent";
      default: return "bg-gray-500";
    }
  };

  const statusLabel = (status) => {
    switch (status) {
      case "on_route": return "En ruta";
      case "stopped": return "Detenido";
      case "active": return "Activo";
      default: return "Inactivo";
    }
  };

  return (
    <div className="h-full overflow-y-auto p-4">
      <h2 className="text-sm font-semibold text-gray-300 mb-3">Vehículos</h2>
      <div className="space-y-2">
        {vehicles.map((v) => (
          <div
            key={v.id}
            className="flex items-center justify-between px-4 py-3 rounded-lg bg-[#1e293b]"
          >
            <div className="flex items-center gap-3">
              <div className={`w-2.5 h-2.5 rounded-full ${statusColor(v.status)}`} />
              <div>
                <p className="text-sm font-medium">{v.plate}</p>
                <p className="text-xs text-gray-400">
                  {v.brand} {v.model} • {v.year}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <span className="text-xs text-gray-400 block">{statusLabel(v.status)}</span>
                {v.driver_name && (
                  <span className="text-xs text-accent">{v.driver_name}</span>
                )}
              </div>
              <button
                onClick={() => handleDelete(v.id)}
                className="px-2.5 py-1 rounded text-xs font-medium bg-alert/10 text-alert hover:bg-alert/20 transition"
              >
                Eliminar
              </button>
            </div>
          </div>
        ))}
      </div>
      {vehicles.length === 0 && (
        <p className="text-center text-gray-500 mt-8">No hay vehículos registrados</p>
      )}
    </div>
  );
}
