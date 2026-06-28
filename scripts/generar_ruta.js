// Script para obtener la ruta real San Roque -> Ceja desde OSRM
// y generar el SQL de actualización.
//
// Uso: node scripts/generar_ruta.js
//
// La API de OSRM espera coordenadas en orden: longitud,latitud

const API_URL =
  "http://router.project-osrm.org/route/v1/driving/" +
  "-68.27748794082346,-16.475452995078665;" +
  "-68.16265888704012,-16.50362324013066" +
  "?overview=full&geometries=geojson";

async function main() {
  console.log("Consultando OSRM...");
  console.log("URL:", API_URL);
  console.log("");

  const res = await fetch(API_URL, {
    headers: { "User-Agent": "SanRoque-Tracking/1.0" },
  });

  if (!res.ok) {
    console.error("ERROR HTTP:", res.status, res.statusText);
    const text = await res.text();
    console.error("Respuesta:", text);
    process.exit(1);
  }

  const data = await res.json();

  if (data.code !== "Ok" || !data.routes || data.routes.length === 0) {
    console.error("ERROR OSRM: código", data.code);
    console.error(JSON.stringify(data, null, 2));
    process.exit(1);
  }

  const route = data.routes[0];
  const coords = route.geometry.coordinates;

  console.log("========================================");
  console.log("RUTA OBTENIDA DE OSRM");
  console.log("========================================");
  console.log(`Distancia: ${(route.distance / 1000).toFixed(2)} km`);
  console.log(`Duración: ${Math.round(route.duration / 60)} min`);
  console.log(`Puntos en el camino: ${coords.length}`);
  console.log("");

  // Generar el SQL como LINESTRING
  const points = coords.map(([lng, lat]) => `  ${lng} ${lat}`);
  const linestring = `LINESTRING(\n${points.join(",\n")}\n)`;

  const sql = `-- ============================================================
-- ACTUALIZACIÓN DE RUTA AUTORIZADA: San Roque -> Ceja
-- Generado desde OSRM con ruta real por calles
-- Distancia: ${(route.distance / 1000).toFixed(2)} km
-- ============================================================

-- Para ejecutar en la BD actual:
--   docker exec -i sanroque-postgis psql -U sanroque -d sanroque_tracking < scripts/update_ruta.sql

UPDATE authorized_route
SET geom = ST_GeomFromText('${linestring}', 4326),
    name = 'San Roque -> Ceja El Alto (ruta real)'
WHERE id = 1;

-- Si no existe el registro (ID 1), insertarlo:
INSERT INTO authorized_route (id, name, geom)
SELECT 1, 'San Roque -> Ceja El Alto (ruta real)', ST_GeomFromText('${linestring}', 4326)
WHERE NOT EXISTS (SELECT 1 FROM authorized_route WHERE id = 1);
`;

  console.log("SQL GENERADO:");
  console.log("========================================");
  console.log(sql);

  // También mostrar en formato corto para el seed.sql
  console.log("========================================");
  console.log("Para SEED.SQL (versión compacta):");
  console.log("========================================");
  const shortPoints = coords.map(([lng, lat]) => `${lng} ${lat}`).join(",\n    ");
  console.log(`
INSERT INTO authorized_route (id, name, geom) VALUES (
  1,
  'San Roque → Ceja El Alto (ruta real)',
  ST_GeomFromText('LINESTRING(
    ${shortPoints}
  )', 4326)
);
`);
}

main().catch((err) => {
  console.error("ERROR FATAL:", err);
  process.exit(1);
});
