# San Roque Tracking — PWA de Seguimiento Vehicular

**Sindicato de Transporte "Señor de San Roque"**  
Ruta: San Roque → Ceja, El Alto, Bolivia

---

## Características

- **PWA instalable** desde el navegador (Android Chrome) — sin Play Store
- **Mapa en tiempo real** con Leaflet + OpenStreetMap
- **3 roles** con dashboards distintos: Admin, Chofer, Pasajero
- **GPS desde el celular** del chofer (alta precisión, 5 segundos)
- **Sincronización offline** guarda posiciones en IndexedDB
- **Alertas** de tramaje (desvío de ruta) y exceso de velocidad
- **Historial** exportable a CSV
- **Tema oscuro** mobile-first

---

## Stack Técnico

| Capa | Tecnología |
|------|-----------|
| Frontend | React 18 + Vite + Tailwind CSS |
| PWA | vite-plugin-pwa + Workbox |
| Mapas | Leaflet.js + OpenStreetMap |
| Backend | Node.js + Express |
| Base de datos | PostgreSQL + PostGIS |
| Tiempo real | Socket.io |
| Autenticación | JWT (localStorage) |
| Deploy | Docker + docker-compose |

---

## Instalación con Docker

### Requisitos

- Docker
- Docker Compose

### Pasos

```bash
# 1. Clonar el repositorio
git clone <repo-url> sanroque-tracking
cd sanroque-tracking

# 2. Iniciar todos los servicios
docker-compose up -d

# 3. La app estará disponible en:
#    Frontend: http://localhost
#    Backend:  http://localhost:3000/api
```

### Usuarios por defecto (seed)

| Rol | Email | Contraseña |
|-----|-------|-----------|
| Admin | admin@sanroque.bo | admin123 |
| Chofer 1 | carlos@sanroque.bo | chofer123 |
| Chofer 2 | maria@sanroque.bo | chofer123 |
| Chofer 3 | jose@sanroque.bo | chofer123 |

---

## Cómo instalar la PWA en Android (Chrome)

1. Abrir Chrome en Android
2. Navegar a la URL donde está alojada la app
3. Aparecerá un banner "Instalar San Roque Tracking"
4. Tocar "Instalar" o ir al menú ⋮ → "Instalar aplicación"
5. La app se agrega al inicio con ícono y pantalla de bienvenida
6. Se abre sin la barra de direcciones del navegador (standalone)

---

## Cómo distribuir por WhatsApp

1. Abrir la app desde el navegador
2. Tocar el botón "Compartir" del navegador
3. Seleccionar WhatsApp
4. Enviar el enlace al grupo del sindicato
5. Los usuarios abren el link y Chrome ofrece instalar la PWA

---

## Tabla de Roles y Permisos

| Funcionalidad | Admin | Chofer | Pasajero |
|--------------|-------|--------|----------|
| Login | ✅ | ✅ | ❌ (público) |
| Mapa general | ✅ | ❌ (solo su vehículo) | ✅ |
| Dashboard vehículos | ✅ | ❌ | ❌ |
| Alertas trameje/velocidad | ✅ | Solo sus datos | ❌ |
| Historial GPS | ✅ (todos) | ✅ (solo suyo) | ❌ |
| Exportar CSV | ✅ | ❌ | ❌ |
| Gestionar vehículos | ✅ | ❌ | ❌ |
| Gestionar choferes | ✅ | ❌ | ❌ |
| Reportes | ✅ | ❌ | ❌ |
| Ver paradas | ✅ | ✅ (solo suyas) | ❌ |
| Mapa público | ✅ | ✅ | ✅ |
| Estimar llegada | ❌ | ❌ | ✅ |

---

## Estructura del Proyecto

```
/
├── backend/
│   └── src/
│       ├── routes/        # auth, vehicles, users, alerts, history, stops, public
│       ├── middleware/     # requireAuth.js, requireRole.js
│       ├── services/      # gps, tramaje, speed, stops
│       └── sockets/       # gps.socket.js (lógica Socket.io)
├── frontend/
│   └── src/
│       ├── components/    # Map, Driver, Admin, Public
│       ├── pages/         # Login, AdminDashboard, DriverDashboard, PublicMap, History, Reports
│       ├── hooks/         # useSocket, useGeoLocation, useOfflineSync
│       ├── store/         # authStore (Zustand)
│       └── router/        # ProtectedRoute
├── database/
│   └── seed.sql           # PostGIS + datos de ejemplo
├── docker-compose.yml
└── README.md
```

---

## Variables de Entorno

### Backend (`.env`)

| Variable | Descripción | Default |
|----------|-------------|---------|
| `DB_HOST` | Host PostgreSQL | `localhost` |
| `DB_PORT` | Puerto PostgreSQL | `5432` |
| `DB_NAME` | Nombre BD | `sanroque_tracking` |
| `DB_USER` | Usuario BD | `sanroque` |
| `DB_PASSWORD` | Contraseña BD | `sanroque_secret` |
| `JWT_SECRET` | Secreto JWT | `sanroque_jwt_secret_change_in_prod_2026` |
| `PORT` | Puerto backend | `3000` |

### Frontend

| Variable | Descripción | Default |
|----------|-------------|---------|
| `VITE_API_URL` | URL API REST | `http://localhost:3000/api` |
| `VITE_SOCKET_URL` | URL Socket.io | `http://localhost:3000` |

---

## Desarrollo Local (sin Docker)

```bash
# Backend
cd backend
npm install
cp .env.example .env  # configurar variables
npm run dev

# Frontend
cd frontend
npm install
npm run dev

# Base de datos (requiere PostgreSQL + PostGIS)
createdb sanroque_tracking
psql -d sanroque_tracking -f database/seed.sql
```

---

## Licencia

Uso interno — Sindicato de Transporte "Señor de San Roque"
