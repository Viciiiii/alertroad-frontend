function ScanModal({ scan, onClose, onDelete, isAdmin }) {
  const [showAnnotated, setShowAnnotated] = useState(Boolean(scan.annotatedFileUrl));
  const [activeTrafficEntry, setActiveTrafficEntry] = useState(null);
  const videoRef = useRef(null);
  const hasAnnotated = Boolean(scan.annotatedFileUrl);
  const isVideo = scan.fileType === "Video";
  const videoTimeline = scan.detection_details?.video_timeline;
  const videoDurationSec = scan.detection_details?.video_duration_sec;

  // See ScanResult.jsx: the <video> element stays mounted at all times now,
  // so toggling views just shows/hides the overlay boxes — no more remount
  // losing loaded metadata, which is what made seeking unreliable before.
  const handleTimelineSeek = (timestampSec) => {
    setShowAnnotated(true);

    // See ScanResult.jsx: look up the nearest sampled timeline entry so the
    // "vehicles at this moment" readout reflects that exact frame, not the
    // headline peak-across-the-whole-video number.
    if (videoTimeline && videoTimeline.length > 0) {
      const nearest = videoTimeline.reduce((closest, entry) =>
        Math.abs(entry.timestamp_sec - timestampSec) < Math.abs(closest.timestamp_sec - timestampSec)
          ? entry
          : closest
      );
      setActiveTrafficEntry(nearest);
    }

    const videoEl = videoRef.current;
    if (!videoEl) return;

    // See ScanResult.jsx for the reasoning: clamp to the real video
    // duration, and wait for "seeked" before resuming playback instead of
    // assuming the seek is instant.
    const clampedTarget = Number.isFinite(videoEl.duration)
      ? Math.min(timestampSec, Math.max(videoEl.duration - 0.05, 0))
      : timestampSec;

    const doSeek = () => {
      videoEl.pause();
      const onSeeked = () => {
        videoEl.removeEventListener("seeked", onSeeked);
        videoEl.play();
      };
      videoEl.addEventListener("seeked", onSeeked, { once: true });
      videoEl.currentTime = clampedTarget;
    };

    if (videoEl.readyState >= 1) {
      doSeek();
    } else {
      videoEl.addEventListener("loadedmetadata", doSeek, { once: true });
    }
  };

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

        <div className="scan-modal-media-column">
        <div className="scan-modal-media-wrapper">
          {hasAnnotated && (
            <div className="scan-modal-media-toggle">
              <button
                className={showAnnotated ? "active" : ""}
                onClick={() => setShowAnnotated(true)}
              >
                Detected damage
              </button>
              <button
                className={!showAnnotated ? "active" : ""}
                onClick={() => setShowAnnotated(false)}
              >
                {isVideo ? "Original video" : "Original image"}
              </button>
            </div>
          )}

          {isVideo ? (
            <>
              <video ref={videoRef} className="scan-modal-media" src={scan.fileUrl} controls />
              {showAnnotated && videoTimeline && (
                <DetectionOverlay videoRef={videoRef} timeline={videoTimeline} />
              )}
            </>
          ) : showAnnotated && hasAnnotated ? (
            <img
              className="scan-modal-media"
              src={scan.annotatedFileUrl}
              alt="Detected road damage with bounding boxes"
            />
          ) : (
            <img
              className="scan-modal-media"
              src={scan.fileUrl}
              alt="Scanned road"
            />
          )}

          {isVideo && showAnnotated && (
            <p className="scan-modal-media-note">
              Boxes reflect the nearest sampled frame (~1/sec) and may lag
              slightly behind fast motion.
            </p>
          )}
        </div>

        {isVideo && videoTimeline && (
          <VideoTimeline
            timeline={videoTimeline}
            durationSec={videoDurationSec}
            onSeek={handleTimelineSeek}
            videoRef={videoRef}
          />
        )}

        {isVideo && videoTimeline && (
          <p className="scan-modal-media-note">
            {activeTrafficEntry
              ? `${activeTrafficEntry.traffic} vehicle${activeTrafficEntry.traffic === 1 ? "" : "s"} at ${activeTrafficEntry.timestamp_sec}s`
              : "Click a point on the timeline to see vehicles at that moment"}
          </p>
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

          {scan.riskReason && (
            <p
              className={
                scan.damageDetected === false
                  ? "scan-modal-risk-reason scan-modal-risk-reason-warning"
                  : "scan-modal-risk-reason"
              }
            >
              {scan.damageDetected === false ? "⚠ " : ""}
              {scan.riskReason}
            </p>
          )}

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
              <p className="scan-modal-stat-label">Peak traffic</p>
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