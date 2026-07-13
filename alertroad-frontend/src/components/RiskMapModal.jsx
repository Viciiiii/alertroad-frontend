import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import {
  RISK_COLORS,
  createTriangleIcon,
  DEFAULT_ZOOM,
  MapResizeHandler,
} from "./RiskMap";
import "./RiskMapModal.css";

function RiskMapModal({ scans, center, onClose }) {
  const handleBackdropClick = () => {
    onClose();
  };

  const handleCardClick = (e) => {
    e.stopPropagation();
  };

  return (
    <div className="risk-map-modal-backdrop" onClick={handleBackdropClick}>
      <div className="risk-map-modal-card" onClick={handleCardClick}>
        <button
          className="risk-map-modal-close"
          onClick={onClose}
          aria-label="Close expanded map"
        >
          ×
        </button>

        <div className="risk-map-modal-header">
          <span className="risk-map-modal-title">Road Risk Map</span>
          <span className="risk-map-modal-legend">
            <span className="risk-map-modal-legend-dot risk-map-modal-legend-low" /> Low
            <span className="risk-map-modal-legend-dot risk-map-modal-legend-medium" /> Medium
            <span className="risk-map-modal-legend-dot risk-map-modal-legend-high" /> High
          </span>
        </div>

        <div className="risk-map-modal-map-wrapper">
          <MapContainer
            center={center}
            zoom={DEFAULT_ZOOM}
            scrollWheelZoom={true}
            className="risk-map-modal-container"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <MapResizeHandler />

            {scans.map((scan, index) => (
              <Marker
                key={index}
                position={[scan.lat, scan.lng]}
                icon={createTriangleIcon(
                  RISK_COLORS[scan.riskLevel] || RISK_COLORS.Low
                )}
              >
                <Popup>
                  <strong>{scan.location}</strong>
                  <br />
                  Risk: {scan.riskLevel}
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      </div>
    </div>
  );
}

export default RiskMapModal;