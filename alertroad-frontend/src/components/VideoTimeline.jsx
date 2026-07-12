import { useEffect, useState } from "react";
import "./VideoTimeline.css";

// Same traffic-light convention as the Road Risk Map legend (Low/Medium/High).
const RISK_COLORS = {
  High: "#ef4444",
  Medium: "#f59e0b",
  Low: "#22c55e",
};
// No damage detected in that stretch — gray, not "Low risk" green. Low
// risk still means damage WAS found, just not much of it; no detection at
// all is a different thing and shouldn't look the same as a real (if
// minor) finding.
const NO_DETECTION_COLOR = "#9ca3af";

/**
 * Renders a horizontal timeline bar beneath a scanned video, with one
 * colored segment per sampled frame — gray where no damage was detected,
 * green/amber/red where it was, based on that frame's risk level. Doubles
 * as the actual scrubber for the video: clicking a segment seeks+plays,
 * and a playhead marker tracks the video's current position live.
 *
 * timeline: array of { timestamp_sec, risk_level, damage_detected,
 *   potholes, cracks, confidence } — this is exactly
 *   scan.detection_details.video_timeline from the backend.
 * durationSec: total video duration, for positioning segments proportionally.
 * onSeek(timestampSec): called when a segment is clicked.
 * videoRef: ref to the <video> element, used to track playhead position.
 */
function VideoTimeline({ timeline, durationSec, onSeek, videoRef }) {
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    const videoEl = videoRef?.current;
    if (!videoEl) return;
    const handleTimeUpdate = () => setCurrentTime(videoEl.currentTime);
    videoEl.addEventListener("timeupdate", handleTimeUpdate);
    return () => videoEl.removeEventListener("timeupdate", handleTimeUpdate);
  }, [videoRef]);

  if (!timeline || timeline.length === 0 || !durationSec) return null;

  const playheadPct = Math.min((currentTime / durationSec) * 100, 100);

  return (
    <div className="video-timeline">
      <div className="video-timeline-header">
        <span className="video-timeline-title">Risk over time</span>
        <div className="video-timeline-legend">
          <span className="video-timeline-legend-item">
            <span className="video-timeline-dot" style={{ backgroundColor: NO_DETECTION_COLOR }} />
            No detection
          </span>
          <span className="video-timeline-legend-item">
            <span className="video-timeline-dot" style={{ backgroundColor: RISK_COLORS.Low }} />
            Low
          </span>
          <span className="video-timeline-legend-item">
            <span className="video-timeline-dot" style={{ backgroundColor: RISK_COLORS.Medium }} />
            Medium
          </span>
          <span className="video-timeline-legend-item">
            <span className="video-timeline-dot" style={{ backgroundColor: RISK_COLORS.High }} />
            High
          </span>
        </div>
      </div>

      <div className="video-timeline-track">
        {timeline.map((entry, i) => {
          // Each sampled frame gets a segment spanning from its own
          // timestamp to the next one's (or to the end of the video for
          // the last sample), so the bar reads as continuous coverage
          // rather than a row of disconnected ticks.
          const startPct = (entry.timestamp_sec / durationSec) * 100;
          const nextTimestamp = i < timeline.length - 1 ? timeline[i + 1].timestamp_sec : durationSec;
          const widthPct = Math.max(((nextTimestamp - entry.timestamp_sec) / durationSec) * 100, 0.5);
          const color = entry.damage_detected
            ? RISK_COLORS[entry.risk_level] || RISK_COLORS.Low
            : NO_DETECTION_COLOR;

          return (
            <button
              key={i}
              type="button"
              className="video-timeline-segment"
              style={{
                left: `${startPct}%`,
                width: `${widthPct}%`,
                backgroundColor: color,
              }}
              title={`${entry.timestamp_sec}s — ${
                entry.damage_detected ? `${entry.risk_level} risk` : "No detection"
              }${
                entry.damage_detected ? ` (${entry.potholes} pothole(s), ${entry.cracks} crack(s))` : ""
              }`}
              onClick={() => onSeek(entry.timestamp_sec)}
            />
          );
        })}

        <div className="video-timeline-playhead" style={{ left: `${playheadPct}%` }} />
      </div>

      <p className="video-timeline-hint">
        Click anywhere to jump to that moment in the video.
      </p>
    </div>
  );
}

export default VideoTimeline;