import "./ScanResult.css";

function ScanResult({ scan, onUploadAnother }) {
  return (
    <div className="scan-result">
      <div className="scan-result-header">
        <button className="scan-upload-another" onClick={onUploadAnother}>
          + Upload another scan
        </button>
      </div>

      <div className="scan-result-grid">
        <div className="scan-media-wrapper">
          {scan.fileType === "Video" ? (
            <video className="scan-media" src={scan.fileUrl} controls />
          ) : (
            <img className="scan-media" src={scan.fileUrl} alt="Scanned road" />
          )}
        </div>

        <div className="scan-info-column">
          <div className="scan-risk-card">
            <p className="scan-risk-label">Risk Level</p>
            <p className="scan-risk-value">{scan.riskLevel}</p>
            <p className="scan-risk-location">📍 {scan.location}</p>
            <span className="scan-risk-icon">⚠</span>
          </div>

          <div className="scan-stats-grid">
            <div className="scan-stat-card">
              <p className="scan-stat-label">Potholes</p>
              <p className="scan-stat-value">{scan.potholes}</p>
            </div>
            <div className="scan-stat-card">
              <p className="scan-stat-label">Cracks</p>
              <p className="scan-stat-value">{scan.cracks}</p>
            </div>
            <div className="scan-stat-card">
              <p className="scan-stat-label">Confidence</p>
              <p className="scan-stat-value">{scan.confidence}%</p>
            </div>
            <div className="scan-stat-card">
              <p className="scan-stat-label">Traffic</p>
              <p className="scan-stat-value">{scan.traffic} veh</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ScanResult;