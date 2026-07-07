import "./BottomPanels.css";
import RiskMap from "./RiskMap";

function BottomPanels({ recentScans, onSelectScan }) {
  return (
    <div className="bottom-panels">
      <div className="panel road-risk-panel">
        <div className="panel-header">
          <span className="panel-title">Road Risk Map</span>
          <span className="panel-legend">
            <span className="legend-dot legend-low" /> Low
            <span className="legend-dot legend-medium" /> Medium
            <span className="legend-dot legend-high" /> High
          </span>
        </div>
        <div className="panel-body road-risk-body">
          {recentScans.length === 0 ? (
            <p className="panel-empty-text">
              No scans yet — pins will appear here after your first upload
            </p>
          ) : (
            <RiskMap scans={recentScans} />
          )}
        </div>
      </div>

      <div className="panel recent-scans-panel">
        <div className="recent-scans-header">
          <span className="recent-scans-icon">⟳</span>
          <span className="recent-scans-title">Recent Scans</span>
        </div>

        <div className="recent-scans-body">
          {recentScans.length === 0 ? (
            <p className="panel-empty-text">
              Nothing scanned yet. Your first result will show up here.
            </p>
          ) : (
            <div className="recent-scans-table">
              <div className="recent-scans-columns">
                <span className="recent-scans-cell recent-scans-cell-location">
                  Location
                </span>
                <span className="recent-scans-cell recent-scans-cell-type">
                  Type
                </span>
                <span className="recent-scans-cell recent-scans-cell-risk">
                  Risk
                </span>
              </div>

              <div className="recent-scans-columns-divider" />

              <div className="recent-scans-rows">
                {recentScans.map((scan, index) => (
                  <div
                    key={index}
                    className="recent-scans-row"
                    onClick={() => onSelectScan(scan)}
                  >
                    <span className="recent-scans-cell recent-scans-cell-location">
                      {scan.location}
                    </span>
                    <span className="recent-scans-cell recent-scans-cell-type">
                      {scan.fileType}
                    </span>
                    <span className="recent-scans-cell recent-scans-cell-risk">
                      {scan.riskLevel} Risk
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default BottomPanels;