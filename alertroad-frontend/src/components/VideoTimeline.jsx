import "./VideoTimeline.css";

// Same traffic-light convention as the Road Risk Map legend (Low/Medium/High).
const RISK_COLORS = {
  High: "#ef4444",
  Medium: "#f59e0b",
  Low: "#22c55e",
};

/**
 * Renders a horizontal timeline bar beneath a scanned video, with one
 * colored segment per sampled frame showing the risk level detected at
 * that point in the video. Clicking a segment seeks the video player to
 * that timestamp (and switches to the "Original video" view so the seek
 * is actually visible, since the annotated view is a single static frame).
 *
 * timeline: array of { timestamp_sec, risk_level, damage_detected,
 *   potholes, cracks, confidence } — this is exactly
 *   scan.detection_details.video_timeline from the backend.
 * durationSec: total video duration, for positioning segments proportionally.
 * onSeek(timestampSec): called when a segment is clicked.
 */
function VideoTimeline({ timeline, durationSec, onSeek }) {
  if (!timeline || timeline.length === 0 || !durationSec) return null;

  return (
    <div className="video-timeline">
      <div className="video-timeline-header">
        <span className="video-timeline-title">Risk over time</span>
        <div className="video-timeline-legend">
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

          return (
            <button
              key={i}
              type="button"
              className="video-timeline-segment"
              style={{
                left: `${startPct}%`,
                width: `${widthPct}%`,
                backgroundColor: RISK_COLORS[entry.risk_level] || RISK_COLORS.Low,
              }}
              title={`${entry.timestamp_sec}s — ${entry.risk_level} risk${
                entry.damage_detected ? ` (${entry.potholes} pothole(s), ${entry.cracks} crack(s))` : ""
              }`}
              onClick={() => onSeek(entry.timestamp_sec)}
            />
          );
        })}
      </div>

      <p className="video-timeline-hint">
        Click a segment to jump to that moment in the original video.
      </p>
    </div>
  );
}

export default VideoTimeline;