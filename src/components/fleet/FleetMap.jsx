import { useEffect, useRef } from "react";

// Dynamically load Leaflet from CDN
let leafletLoaded = false;
let loadPromise = null;

function loadLeaflet() {
  if (leafletLoaded) return Promise.resolve();
  if (loadPromise) return loadPromise;
  loadPromise = new Promise((resolve) => {
    // CSS
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(link);
    // JS
    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.onload = () => { leafletLoaded = true; resolve(); };
    document.head.appendChild(script);
  });
  return loadPromise;
}

export default function FleetMap({ telemetry, routePoints = [], height = 420 }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const polyRef = useRef(null);

  useEffect(() => {
    loadLeaflet().then(() => {
      if (!containerRef.current || mapRef.current) return;
      const L = window.L;

      const defaultCenter = telemetry?.latitude
        ? [telemetry.latitude, telemetry.longitude]
        : [10.48, -66.9]; // Caracas default

      const map = L.map(containerRef.current, {
        center: defaultCenter,
        zoom: 13,
        zoomControl: true,
        attributionControl: false,
      });

      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        { maxZoom: 19 }
      ).addTo(map);

      mapRef.current = map;
    });

    return () => {
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
  }, []);

  // Update marker when telemetry changes
  useEffect(() => {
    if (!mapRef.current || !window.L) return;
    const L = window.L;
    const lat = telemetry?.latitude;
    const lng = telemetry?.longitude;
    if (!lat || !lng) return;

    const ignOn = telemetry?.ignitionOn;
    const color = ignOn ? "#22c55e" : "#ef4444";

    const icon = L.divIcon({
      className: "",
      html: `<div style="
        width:18px;height:18px;
        background:${color};
        border:3px solid white;
        border-radius:50%;
        box-shadow:0 0 12px ${color},0 0 20px ${color}66;
      "></div>`,
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });

    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]).setIcon(icon);
    } else {
      markerRef.current = L.marker([lat, lng], { icon })
        .addTo(mapRef.current)
        .bindPopup(`
          <div style="font-family:Syne,sans-serif;font-size:12px;color:#e8edf5;background:#111720;padding:8px;border-radius:6px;">
            <b>SINOTRACKER ST-901</b><br/>
            <span style="color:#8ba0b8">Lat:</span> ${lat.toFixed(5)}<br/>
            <span style="color:#8ba0b8">Lng:</span> ${lng.toFixed(5)}<br/>
            <span style="color:#8ba0b8">Motor:</span> <span style="color:${color}">${ignOn ? "ENCENDIDO" : "APAGADO"}</span><br/>
            ${telemetry.speed != null ? `<span style="color:#8ba0b8">Vel:</span> ${Math.round(telemetry.speed)} km/h` : ""}
          </div>
        `);
    }

    mapRef.current.setView([lat, lng], mapRef.current.getZoom());
  }, [telemetry]);

  // Draw route
  useEffect(() => {
    if (!mapRef.current || !window.L || !routePoints.length) return;
    const L = window.L;
    const validPoints = routePoints
      .filter((p) => p.latitude && p.longitude)
      .map((p) => [p.latitude, p.longitude]);

    if (!validPoints.length) return;
    if (polyRef.current) polyRef.current.remove();
    polyRef.current = L.polyline(validPoints, {
      color: "#0ea5e9",
      weight: 2.5,
      opacity: 0.75,
      dashArray: "6 4",
    }).addTo(mapRef.current);

    if (validPoints.length > 1) mapRef.current.fitBounds(polyRef.current.getBounds(), { padding: [40, 40] });
  }, [routePoints]);

  return (
    <div
      ref={containerRef}
      id="map-container"
      style={{ height, borderRadius: "var(--radius-lg)", overflow: "hidden", border: "1px solid var(--border-subtle)" }}
    />
  );
}
