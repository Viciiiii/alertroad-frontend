import { useState, useRef } from "react";
import "./ScanResult.css";
import VideoTimeline from "./VideoTimeline";

function ScanResult({ scan, onUploadAnother }) {
  // Default to the annotated (bounding-box) view when one exists, since
  // that's the more useful view — falls back to the raw upload otherwise.
  const [showAnnotated, setShowAnnotated] = useState(Boolean(scan.annotatedFileUrl));
  const videoRef = useRef(null);

  const hasAnnotated = Boolean(scan.annotatedFileUrl);
  const isVideo = scan.fileType === "Video";
  const videoTimeline = scan.detection_details?.video_timeline;
  const videoDurationSec = scan.detection_details?.video_duration_sec;

  // Jump the actual <video> element to a timestamp. Only works while the
  // original video is visible (the annotated view is one static frame, not
  // a player), so switch views first if needed.
 const handleTimelineSeek = (timestampSec) => {
  setShowAnnotated(false);
  requestAnimationFrame(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;
    const seekAndPlay = () => {
      videoEl.currentTime = timestampSec;
      videoEl.play();
    };
    if (videoEl.readyState >= 1) {
      seekAndPlay();
    } else {
      videoEl.addEventListener("loadedmetadata", seekAndPlay, { once: true });
    }
  });
};

  return (
    <div className="scan-result">
      <div className="scan-result-header">
        <button className="scan-upload-another" onClick={onUploadAnother}>
          + Upload another scan
        </button>
      </div>

      <div className="scan-result-grid">
        <div className="scan-media-column">
        <div className="scan-media-wrapper">
          {hasAnnotated && (
            <div className="scan-media-toggle">
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

          {showAnnotated && hasAnnotated ? (
            <img
              className="scan-media"
              src={scan.annotatedFileUrl}
              alt={
                isVideo
                  ? "Detected road damage, annotated frame from video"
                  : "Detected road damage with bounding boxes"
              }
            />
          ) : isVideo ? (
            <video ref={videoRef} className="scan-media" src={scan.fileUrl} controls />
          ) : (
            <img className="scan-media" src={scan.fileUrl} alt="Scanned road" />
          )}

          {hasAnnotated && showAnnotated && isVideo && (
            <p className="scan-media-note">
              Showing the worst-risk frame found in the video, not the full
              clip — see the timeline below for when it occurred.
            </p>
          )}
        </div>

        {isVideo && videoTimeline && (
          <VideoTimeline
            timeline={videoTimeline}
            durationSec={videoDurationSec}
            onSeek={handleTimelineSeek}
          />
        )}
        </div>

        <div className="scan-info-column">
          <div className="scan-risk-card">
            <p className="scan-risk-label">Risk Level</p>
            <p className="scan-risk-value">{scan.riskLevel}</p>
            <p className="scan-risk-location">📍 {scan.location}</p>
            <span className="scan-risk-icon">⚠</span>
          </div>

          {scan.riskReason && (
            <p
              className={
                scan.damageDetected === false
                  ? "scan-risk-reason scan-risk-reason-warning"
                  : "scan-risk-reason"
              }
            >
              {scan.damageDetected === false ? "⚠ " : ""}
              {scan.riskReason}
            </p>
          )}

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