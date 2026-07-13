import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import RiskMapModal from "./RiskMapModal";
import "./RiskMap.css";
import { RISK_COLORS } from "../utils/riskColors";

// Re-exported so RiskMapModal.jsx's existing `import { RISK_COLORS } from
// "./RiskMap"` keeps working without needing its own edit — the actual
// canonical values now live in utils/riskColors.js.
export { RISK_COLORS };

// Leaflet measures its container's pixel size exactly once, when the map
// is created, and caches it. Because .risk-map-wrapper lives inside a flex
// parent (.panel-body) that needs a layout pass to resolve its real height
// (see RiskMap.css), MapContainer can mount before that height is settled.
// When that happens Leaflet renders tiles for the wrong pixel dimensions —
// visually this looks like a single, oddly-zoomed flat-colored tile that
// never corrects itself, since Leaflet only re-measures on its own resize
// events, not on generic layout changes. A ResizeObserver on the map's own
// container, paired with map.invalidateSize(), forces Leaflet to re-check
// its size any time that size actually changes (initial layout settling,
// window resize, panel expand/collapse, etc.), which is what fixes it.
export function MapResizeHandler() {
  const map = useMap();

  useEffect(() => {
    // Catch the case where the container's true size wasn't known yet at
    // mount time (the bug described above).
    const initialFix = setTimeout(() => map.invalidateSize(), 0);

    const container = map.getContainer();
    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    resizeObserver.observe(container);

    return () => {
      clearTimeout(initialFix);
      resizeObserver.disconnect();
    };
  }, [map]);

  return null;
}

// Averaging every scan's lat/lng together only makes sense if all the
// points are actually clustered near each other. If even one scan (or the
// camera it's tied to) has a bad coordinate — wrong sign, swapped lat/lng,
// a typo, etc. — that single outlier drags the "average" point out into
// wherever is geometrically between the real cluster and the bad one,
// which can easily be open ocean. fitBounds() sidesteps that: instead of
// computing one (possibly meaningless) center point, it frames whatever
// markers actually exist so they're all visible, however they're
// distributed.
export function FitBoundsHandler({ scans, fallbackCenter, fallbackZoom }) {
  const map = useMap();

  useEffect(() => {
    if (scans.length === 0) {
      map.setView(fallbackCenter, fallbackZoom);
      return;
    }

    if (scans.length === 1) {
      map.setView([scans[0].lat, scans[0].lng], fallbackZoom);
      return;
    }

    const bounds = L.latLngBounds(scans.map((s) => [s.lat, s.lng]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
  }, [map, scans, fallbackCenter, fallbackZoom]);

  return null;
}

// Rough haversine distance in km — good enough for flagging outliers, not
// for navigation.
function distanceKm([lat1, lng1], [lat2, lng2]) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function median(numbers) {
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

// Dev-facing aid, not user-facing UI: warns in the console about any scan
// whose coordinates sit implausibly far (>50km) from the median of all
// scans, since that's almost always bad data (a typo, swapped lat/lng,
// wrong sign) rather than a genuinely distant real scan.
function warnAboutCoordinateOutliers(scans) {
  if (scans.length < 2) return;

  const medianPoint = [
    median(scans.map((s) => s.lat)),
    median(scans.map((s) => s.lng)),
  ];

  scans.forEach((scan) => {
    const distance = distanceKm(medianPoint, [scan.lat, scan.lng]);
    if (distance > 50) {
      console.warn(
        `[RiskMap] "${scan.location}" (lat: ${scan.lat}, lng: ${scan.lng}) is ~${Math.round(
          distance
        )}km from the other scans' median location. This looks like a bad ` +
          `coordinate (typo, swapped lat/lng, or wrong sign) rather than a genuinely ` +
          `distant scan — worth checking the camera/scan record for "${scan.location}".`
      );
    }
  });
}


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

  useEffect(() => {
    warnAboutCoordinateOutliers(scansWithCoords);
  }, [scansWithCoords]);

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

      {/* Only one Leaflet map instance should ever exist in the DOM at a time.
          Rendering both this small map and the fullscreen modal's map
          simultaneously caused a real-device bug where the small map's
          tiles bled through on top of the modal instead of staying hidden
          behind it — Leaflet's internal rendering doesn't always respect
          normal CSS stacking the way a plain div would. */}
      {!isExpanded && (
        <MapContainer
          center={DEFAULT_CENTER}
          zoom={DEFAULT_ZOOM}
          scrollWheelZoom={false}
          className="risk-map-container"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <MapResizeHandler />
          <FitBoundsHandler
            scans={scansWithCoords}
            fallbackCenter={DEFAULT_CENTER}
            fallbackZoom={DEFAULT_ZOOM}
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
      )}

      {isExpanded && (
        <RiskMapModal
          scans={scansWithCoords}
          onClose={() => setIsExpanded(false)}
        />
      )}
    </div>
  );
}

export default RiskMap;