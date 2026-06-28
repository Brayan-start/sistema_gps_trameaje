import { useState, useEffect } from "react";
import { useAuthStore } from "../../store/authStore";
import EditDriverModal from "./EditDriverModal";

const API = import.meta.env.VITE_API_URL || "";

function ConfirmModal({ driver, onConfirm, onCancel }) {
  if (!driver) return null;
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onCancel}>
      <div className="card p-6 max-w-sm w-full mx-4 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-alert/20 flex items-center justify-center text-alert text-xl">!</div>
          <div>
            <h3 className="text-lg font-semibold text-white">Eliminar chofer</h3>
            <p className="text-sm text-gray-400">Esta acción no se puede deshacer</p>
          </div>
        </div>
        <p className="text-sm text-gray-300">
          ¿Estás seguro que deseas eliminar permanentemente a <strong className="text-white">{driver.name}</strong>?
          Ya no podrá acceder al sistema con <span className="text-gray-400">{driver.email}</span>.
        </p>
        <p className="text-xs text-gray-500">
          Se eliminarán todos sus registros asociados (desvíos, sanciones). Esta acción es irreversible.
        </p>
        <div className="flex gap-2 justify-end pt-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-700 text-gray-300 hover:bg-gray-600 transition"
          >
            Cancelar
          </button>
          <button
            onClick={() => onConfirm(driver.id)}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-alert text-white hover:bg-alert/80 transition"
          >
            Sí, eliminar
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DriverList() {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editDriver, setEditDriver] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const token = useAuthStore((s) => s.token);

  const loadDrivers = () => {
    fetch(`${API}/admin/drivers`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then(setDrivers)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadDrivers(); }, []);

  const handleDelete = async (id) => {
    try {
      const res = await fetch(`${API}/admin/drivers/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json();
        console.error("[DELETE ERROR]", data.error);
        return;
      }
    } catch (err) {
      console.error("[DELETE ERROR]", err);
    } finally {
      setDeleteTarget(null);
    }
    setDrivers((prev) => prev.filter((d) => d.id !== id));
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin w-6 h-6 border-2 border-accent border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-white">Choferes Registrados</h1>
        <p className="text-sm text-gray-500 mt-1">{drivers.length} chofer(es) en el sistema</p>
      </div>

      <div className="space-y-2">
        {drivers.map((d) => (
          <div key={d.id} className="card p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-success" />
              <div>
                <p className="text-sm font-medium text-white">{d.name}</p>
                <p className="text-xs text-gray-500">{d.email}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-gray-600">
                    {d.vehicle_plate ? `🚐 ${d.vehicle_plate}` : "Sin vehículo"}
                  </span>
                  {d.last_seen_at && (
                    <span className="text-xs text-gray-600">
                      🕐 {new Date(d.last_seen_at).toLocaleString("es-BO")}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setEditDriver(d)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-accent/10 text-accent hover:bg-accent/20 transition"
              >
                Editar
              </button>
              <span className="badge badge-green">Activo</span>
              <button
                onClick={() => setDeleteTarget(d)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-alert/10 text-alert hover:bg-alert/20 transition"
              >
                Eliminar
              </button>
            </div>
          </div>
        ))}
        {drivers.length === 0 && (
          <div className="text-center text-gray-500 py-12">No hay choferes registrados</div>
        )}
      </div>

      {editDriver && (
        <EditDriverModal
          driver={editDriver}
          onClose={() => setEditDriver(null)}
          onSaved={loadDrivers}
        />
      )}

      <ConfirmModal
        driver={deleteTarget}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
