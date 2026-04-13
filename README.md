# FleetCore — Asset Management

## ⚡ Inicio Rápido

```bash
cd fleet-app
npm install
npm run dev
```

Abre: http://localhost:5174

## 🔌 Conexión Flespi (CORS Fix)

La app usa el proxy de Vite para evitar CORS con Flespi:

```
Browser → /flespi/* → https://flespi.io (via Vite proxy)
```

**Si ves "Failed to fetch":**
1. Asegúrate de iniciar con `npm run dev` (no abrir el HTML directamente)
2. La URL debe ser `http://localhost:5174` (no otro puerto)
3. En la consola del navegador verás `[Flespi] Fetching telemetry:` si el proxy funciona

## 📦 Registrar Activos

1. Ve a **Inventario** en el menú lateral
2. Haz clic en **"Registrar Activo"** (botón azul arriba a la derecha)
3. Completa el formulario y guarda

## 🗂 Estructura

```
src/
├── services/flespiService.js   ← API Flespi (usa proxy /flespi)
├── hooks/useTelemetry.js       ← Polling cada 15s + eventos motor
├── stores/AppContext.jsx        ← Estado global (activos, traslados)
├── pages/
│   ├── DashboardPage.jsx
│   ├── InventoryPage.jsx        ← CRUD activos
│   ├── FleetPage.jsx            ← Mapa GPS
│   ├── TelemetryPage.jsx        ← Telemetría completa
│   └── TransfersPage.jsx        ← Historial traslados
└── components/
    ├── telemetry/TelemetryCard.jsx
    ├── fleet/FleetMap.jsx       ← Leaflet (CartoDB dark)
    └── inventory/               ← AssetModal, TransferModal, DetailModal
```
