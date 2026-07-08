import "./ScanModal.css";

const RISK_COLORS = {
  High: "#7a1c1c",
  Medium: "#7a5a1c",
  Low: "#1c5c2e",
};

function ScanModal({ scan, onClose, onDelete, isAdmin }) {
  const handleBackdropClick = () => {
    onClose();
  };

  const handleCardClick = (e) => {
    e.stopPropagation();
  };

  const handleDeleteClick = () => {
    if (window.confirm("Delete this scan record? This can't be undone.")) {
      onDelete(scan.id);
    }
  };

  return (
    <div className="scan-modal-backdrop" onClick={handleBackdropClick}>
      <div className="scan-modal-card" onClick={handleCardClick}>
        <button className="scan-modal-close" onClick={onClose}>
          ×
        </button>

        <div className="scan-modal-media-wrapper">
          {scan.fileType === "Video" ? (
            <video className="scan-modal-media" src={scan.fileUrl} controls />
          ) : (
            <img
              className="scan-modal-media"
              src={scan.fileUrl}
              alt="Scanned road"
            />
          )}
        </div>

        <div className="scan-modal-info">
          <div
            className="scan-modal-risk-card"
            style={{
              backgroundColor: RISK_COLORS[scan.riskLevel] || RISK_COLORS.Low,
            }}
          >
            <p className="scan-modal-risk-label">Risk Level</p>
            <p className="scan-modal-risk-value">{scan.riskLevel}</p>
            <p className="scan-modal-risk-location">📍 {scan.location}</p>
            <span className="scan-modal-risk-icon">⚠</span>
          </div>

          <div className="scan-modal-stats-grid">
            <div className="scan-modal-stat-card">
              <p className="scan-modal-stat-label">Potholes</p>
              <p className="scan-modal-stat-value">{scan.potholes}</p>
            </div>
            <div className="scan-modal-stat-card">
              <p className="scan-modal-stat-label">Cracks</p>
              <p className="scan-modal-stat-value">{scan.cracks}</p>
            </div>
            <div className="scan-modal-stat-card">
              <p className="scan-modal-stat-label">Confidence</p>
              <p className="scan-modal-stat-value">{scan.confidence}%</p>
            </div>
            <div className="scan-modal-stat-card">
              <p className="scan-modal-stat-label">Traffic</p>
              <p className="scan-modal-stat-value">{scan.traffic} veh</p>
            </div>
          </div>

          {isAdmin && (
            <button className="scan-modal-delete" onClick={handleDeleteClick}>
              Delete Scan Record
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default ScanModal;