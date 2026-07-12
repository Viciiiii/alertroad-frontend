import { useEffect, useRef, useState } from "react";
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

function formatTime(sec) {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Renders a horizontal timeline bar beneath a scanned video, with one
 * colored segment per sampled frame — gray where no damage was detected,
 * green/amber/red where it was, based on that frame's risk level. Doubles
 * as the actual scrubber for the video: clicking anywhere seeks+plays,
 * and a playhead marker tracks the video's current position live.
 *
 * timeline: array of { timestamp_sec, risk_level, damage_detected,
 *   potholes, cracks, confidence } — this is exactly
 *   scan.detection_details.video_timeline from the backend.
 * durationSec: total video duration, for positioning segments proportionally.
 * onSeek(timestampSec): called when the track is clicked.
 * videoRef: ref to the <video> element, used to track playhead position
 *   and to drive the play/pause button.
 */
function VideoTimeline({ timeline, durationSec, onSeek, videoRef }) {
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const trackRef = useRef(null);

  useEffect(() => {
    const videoEl = videoRef?.current;
    if (!videoEl) return;
    const handleTimeUpdate = () => setCurrentTime(videoEl.currentTime);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    videoEl.addEventListener("timeupdate", handleTimeUpdate);
    videoEl.addEventListener("play", handlePlay);
    videoEl.addEventListener("pause", handlePause);
    return () => {
      videoEl.removeEventListener("timeupdate", handleTimeUpdate);
      videoEl.removeEventListener("play", handlePlay);
      videoEl.removeEventListener("pause", handlePause);
    };
  }, [videoRef]);

  if (!timeline || timeline.length === 0 || !durationSec) return null;

  const playheadPct = Math.min((currentTime / durationSec) * 100, 100);

  const togglePlay = () => {
    const videoEl = videoRef?.current;
    if (!videoEl) return;
    if (videoEl.paused) {
      videoEl.play();
    } else {
      videoEl.pause();
    }
  };

  // Clicking ANYWHERE on the track seeks to the exact point under the
  // cursor, computed from pixel position — not just to the nearest
  // sampled frame's start. The per-segment buttons below stay (for their
  // color/tooltip), but their clicks bubble up here rather than each
  // handling its own onSeek, so a click in the middle of a wide segment
  // still lands where you actually clicked instead of snapping to 0.
  const handleTrackClick = (e) => {
    const trackEl = trackRef.current;
    if (!trackEl) return;
    const rect = trackEl.getBoundingClientRect();
    const fraction = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
    // TEMP DEBUG: log the raw numbers behind the seek so we can see in
    // devtools whether the bug is in this calculation or downstream in
    // the actual video.currentTime assignment. Strip once seeking works.
    console.log("[TEMP DEBUG] track click", {
      clientX: e.clientX,
      rectLeft: rect.left,
      rectWidth: rect.width,
      fraction,
      durationSec,
      computedTarget: fraction * durationSec,
    });
    onSeek(fraction * durationSec);
  };

  return (
    <div className="video-timeline">
      <div className="video-timeline-header">
        <div className="video-timeline-controls">
          <button
            type="button"
            className="video-timeline-play-btn"
            onClick={togglePlay}
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? "❚❚" : "▶"}
          </button>
          <span className="video-timeline-time">
            {formatTime(currentTime)} / {formatTime(durationSec)}
          </span>
        </div>
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

      <div className="video-timeline-track" ref={trackRef} onClick={handleTrackClick}>
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