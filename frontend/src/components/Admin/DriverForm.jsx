import { useState, useEffect } from "react";
import { useAuthStore } from "../../store/authStore";

const API = import.meta.env.VITE_API_URL || "";

export default function DriverForm({ vehicles: propVehicles }) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "driver",
    vehicle_id: "",
  });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [drivers, setDrivers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const token = useAuthStore((s) => s.token);

  useEffect(() => {
    if (propVehicles) {
      setVehicles(propVehicles);
    } else {
      fetch(`${API}/vehicles`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => r.json())
        .then(setVehicles)
        .catch(() => {});
    }
  }, [propVehicles, token]);

  useEffect(() => {
    fetch(`${API}/users`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => setDrivers(data.filter((u) => u.role === "driver")))
      .catch(() => {});
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMsg("");
    try {
      const res = await fetch(`${API}/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...form,
          vehicle_id: form.vehicle_id ? Number(form.vehicle_id) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error || "Error al crear");
        return;
      }
      setMsg("Chofer creado exitosamente");
      setForm({ name: "", email: "", password: "", role: "driver", vehicle_id: "" });
      setDrivers((p) => [...p, data]);
    } catch {
      setMsg("Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("¿Eliminar este chofer?")) return;
    try {
      await fetch(`${API}/users/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      setDrivers((p) => p.filter((d) => d.id !== id));
    } catch {
      console.error("Error al eliminar");
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-[#1e293b] rounded-xl p-4">
        <h3 className="text-sm font-semibold text-gray-300 mb-3">Agregar Chofer</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            placeholder="Nombre completo"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full px-3 py-2.5 rounded-lg bg-[#0f172a] border border-gray-700 text-white text-sm placeholder-gray-500 focus:border-accent focus:outline-none"
            required
          />
          <input
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="w-full px-3 py-2.5 rounded-lg bg-[#0f172a] border border-gray-700 text-white text-sm placeholder-gray-500 focus:border-accent focus:outline-none"
            required
          />
          <input
            type="password"
            placeholder="Contraseña"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="w-full px-3 py-2.5 rounded-lg bg-[#0f172a] border border-gray-700 text-white text-sm placeholder-gray-500 focus:border-accent focus:outline-none"
            required
          />
          <select
            value={form.vehicle_id}
            onChange={(e) => setForm({ ...form, vehicle_id: e.target.value })}
            className="w-full px-3 py-2.5 rounded-lg bg-[#0f172a] border border-gray-700 text-white text-sm focus:border-accent focus:outline-none"
          >
            <option value="">Sin vehículo asignado</option>
            {vehicles
              .filter((v) => !v.driver_id || v.driver_id === form.vehicle_id)
              .map((v) => (
                <option key={v.id} value={v.id}>
                  {v.plate} - {v.brand} {v.model}
                </option>
              ))}
          </select>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-accent text-[#0f172a] font-semibold text-sm disabled:opacity-50"
          >
            {loading ? "Guardando..." : "Guardar Chofer"}
          </button>
          {msg && (
            <p
              className={`text-xs text-center ${
                msg.includes("éxito") ? "text-green-400" : "text-alert"
              }`}
            >
              {msg}
            </p>
          )}
        </form>
      </div>

      {drivers.length > 0 && (
        <div className="bg-[#1e293b] rounded-xl p-4">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">
            Choferes ({drivers.length})
          </h3>
          <div className="space-y-2">
            {drivers.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#0f172a]"
              >
                <div>
                  <p className="text-sm">{d.name}</p>
                  <p className="text-xs text-gray-400">{d.email}</p>
                </div>
                <button
                  onClick={() => handleDelete(d.id)}
                  className="text-alert text-xs hover:underline"
                >
                  Eliminar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
