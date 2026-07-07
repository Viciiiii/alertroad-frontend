import { useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import RiskMapModal from "./RiskMapModal";
import "./RiskMap.css";

export const RISK_COLORS = {
  High: "#e02424",
  Medium: "#f5a623",
  Low: "#22c55e",
};

export function createTriangleIcon(color) {
  const svg = `
    <svg width="28" height="28" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
      <polygon points="14,3 25,24 3,24" fill="${color}" stroke="#1a1a1a" stroke-width="1.5" />
      <text x="14" y="21" font-size="12" font-weight="bold" fill="#1a1a1a" text-anchor="middle">!</text>
    </svg>
  `;

  return L.divIcon({
    html: svg,
    className: "risk-map-marker-icon",
    iconSize: [28, 28],
    iconAnchor: [14, 24],
    popupAnchor: [0, -24],
  });
}

export const DEFAULT_CENTER = [14.631, 121.079]; // Quezon City fallback
export const DEFAULT_ZOOM = 13;

function RiskMap({ scans }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const scansWithCoords = scans.filter(
    (scan) => typeof scan.lat === "number" && typeof scan.lng === "number"
  );

  let center = DEFAULT_CENTER;
  if (scansWithCoords.length > 0) {
    const avgLat =
      scansWithCoords.reduce((sum, s) => sum + s.lat, 0) /
      scansWithCoords.length;
    const avgLng =
      scansWithCoords.reduce((sum, s) => sum + s.lng, 0) /
      scansWithCoords.length;
    center = [avgLat, avgLng];
  }

  return (
    <div className="risk-map-wrapper">
      <button
        type="button"
        className="risk-map-expand-button"
        onClick={() => setIsExpanded(true)}
        aria-label="Expand map"
        title="Expand map"
      >
        ⛶
      </button>

      <MapContainer
        center={center}
        zoom={DEFAULT_ZOOM}
        scrollWheelZoom={false}
        className="risk-map-container"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {scansWithCoords.map((scan, index) => (
          <Marker
            key={index}
            position={[scan.lat, scan.lng]}
            icon={createTriangleIcon(RISK_COLORS[scan.riskLevel] || RISK_COLORS.Low)}
          >
            <Popup>
              <strong>{scan.location}</strong>
              <br />
              Risk: {scan.riskLevel}
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {isExpanded && (
        <RiskMapModal
          scans={scansWithCoords}
          center={center}
          onClose={() => setIsExpanded(false)}
        />
      )}
    </div>
  );
}

export default RiskMap;