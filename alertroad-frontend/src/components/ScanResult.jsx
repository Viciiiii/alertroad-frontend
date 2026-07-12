import { useState, useRef } from "react";
import "./ScanResult.css";
import VideoTimeline from "./VideoTimeline";
import DetectionOverlay from "./DetectionOverlay";

function ScanResult({ scan, onUploadAnother }) {
  // Default to the annotated (bounding-box) view when one exists, since
  // that's the more useful view — falls back to the raw upload otherwise.
  const [showAnnotated, setShowAnnotated] = useState(Boolean(scan.annotatedFileUrl));
  const [activeTrafficEntry, setActiveTrafficEntry] = useState(null);
  const videoRef = useRef(null);

  const hasAnnotated = Boolean(scan.annotatedFileUrl);
  const isVideo = scan.fileType === "Video";
  const videoTimeline = scan.detection_details?.video_timeline;
  const videoDurationSec = scan.detection_details?.video_duration_sec;

  // For videos, the SAME <video> element now stays mounted at all times —
  // toggling "Detected damage" vs "Original video" just shows/hides the
  // DetectionOverlay boxes on top, it no longer swaps between an <img>
  // and a <video>. That's what makes this seek reliable: there's no
  // remount losing already-loaded metadata (the old bug this replaces).
  const handleTimelineSeek = (timestampSec) => {
    setShowAnnotated(true); // jump to the boxes-visible view

    // Find the sampled timeline entry nearest the clicked timestamp so the
    // "vehicles at this moment" readout reflects that exact frame's own
    // vehicle count, not the headline peak-across-the-whole-video number.
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

    // Clamp to the video's own reported duration once known — it can
    // differ slightly from the backend's estimate (video_duration_sec),
    // and assigning a currentTime past the real duration gets silently
    // clamped/rejected in some browsers.
    const clampedTarget = Number.isFinite(videoEl.duration)
      ? Math.min(timestampSec, Math.max(videoEl.duration - 0.05, 0))
      : timestampSec;

    const doSeek = () => {
      // Pausing first, then waiting for the browser's own "seeked" event
      // before calling play(), avoids a race in Chrome/Edge where setting
      // currentTime and calling play() in the same tick — while the video
      // is still actively playing/decoding — gets the seek silently
      // dropped, so playback just continues from wherever it already was
      // (looks like the video "repeating" instead of jumping).
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

          {isVideo ? (
            <>
              <video ref={videoRef} className="scan-media" src={scan.fileUrl} controls />
              {showAnnotated && videoTimeline && (
                <DetectionOverlay videoRef={videoRef} timeline={videoTimeline} />
              )}
            </>
          ) : showAnnotated && hasAnnotated ? (
            <img
              className="scan-media"
              src={scan.annotatedFileUrl}
              alt="Detected road damage with bounding boxes"
            />
          ) : (
            <img className="scan-media" src={scan.fileUrl} alt="Scanned road" />
          )}

          {isVideo && showAnnotated && (
            <p className="scan-media-note">
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
          <p className="scan-media-note">
            {activeTrafficEntry
              ? `${activeTrafficEntry.traffic} vehicle${activeTrafficEntry.traffic === 1 ? "" : "s"} at ${activeTrafficEntry.timestamp_sec}s`
              : "Click a point on the timeline to see vehicles at that moment"}
          </p>
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
              <p className="scan-stat-label">Peak traffic</p>
              <p className="scan-stat-value">{scan.traffic} veh</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ScanResult;