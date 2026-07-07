import "./BottomPanels.css";

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
            <p className="panel-empty-text">
              Map view coming soon — {recentScans.length} scan
              {recentScans.length !== 1 ? "s" : ""} recorded
            </p>
          )}
        </div>
      </div>

      <div className="panel recent-scans-panel">
        <div className="panel-header">
          <span className="panel-icon">⟳</span>
          <span className="panel-title">Recent Scans</span>
        </div>
        <div className="panel-body">
          {recentScans.length === 0 ? (
            <p className="panel-empty-text">
              Nothing scanned yet. Your first result will show up here.
            </p>
          ) : (
            <table className="recent-scans-table">
              <thead>
                <tr>
                  <th>Location</th>
                  <th>Type</th>
                  <th>Risk</th>
                </tr>
              </thead>
              <tbody>
                {recentScans.map((scan, index) => (
                  <tr
                    key={index}
                    className="recent-scans-row"
                    onClick={() => onSelectScan(scan)}
                  >
                    <td>{scan.location}</td>
                    <td>{scan.fileType}</td>
                    <td className="recent-scans-risk">{scan.riskLevel} Risk</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

export default BottomPanels;