import { useEffect, useState } from "react";
import "./DetectionOverlay.css";

const BUCKET_LABELS = {
  pothole: "Pothole",
  longitudinal_crack: "Crack",
  transverse_crack: "Crack",
  alligator_crack: "Crack",
  repaired_area: "Repaired",
  road_marking: "Marking",
};

// Finds the timeline entry covering the given playback time — same
// segment boundaries VideoTimeline.jsx uses (each entry's timestamp up to
// the next entry's timestamp), so the overlay and the colored bar always
// agree about which moment is "active".
function findActiveSegment(timeline, currentTime) {
  if (!timeline || timeline.length === 0) return null;
  let active = timeline[0];
  for (let i = 0; i < timeline.length; i++) {
    if (timeline[i].timestamp_sec <= currentTime) {
      active = timeline[i];
    } else {
      break;
    }
  }
  return active;
}

// The <video> element's own box can be bigger than the actual decoded
// video (object-fit: contain letterboxes it), so bounding boxes have to
// be positioned against the actual rendered video rectangle, not the
// element's full bounding box, or they'll drift off the real image.
function getContainedRect(videoEl) {
  const elemW = videoEl.clientWidth;
  const elemH = videoEl.clientHeight;
  const videoW = videoEl.videoWidth;
  const videoH = videoEl.videoHeight;
  // Base offset: where the <video> element itself sits inside its
  // (flex-centered) wrapper. offsetParent is the wrapper since it's the
  // nearest position:relative ancestor, so this is exactly what the
  // overlay div (a sibling of <video>, absolutely positioned against
  // that same wrapper) needs as its starting point.
  const baseLeft = videoEl.offsetLeft;
  const baseTop = videoEl.offsetTop;

  if (!videoW || !videoH || !elemW || !elemH) {
    return { left: baseLeft, top: baseTop, width: elemW, height: elemH };
  }
  // Internal letterboxing within the video's own box — usually a no-op
  // here since width/height are auto-sized to the video's real aspect
  // ratio, but kept as a safeguard in case CSS changes later.
  const elemRatio = elemW / elemH;
  const videoRatio = videoW / videoH;
  let renderW, renderH;
  if (videoRatio > elemRatio) {
    renderW = elemW;
    renderH = elemW / videoRatio;
  } else {
    renderH = elemH;
    renderW = elemH * videoRatio;
  }
  return {
    left: baseLeft + (elemW - renderW) / 2,
    top: baseTop + (elemH - renderH) / 2,
    width: renderW,
    height: renderH,
  };
}

/**
 * Renders bounding boxes on top of a playing <video>, matching whichever
 * sampled frame in video_timeline covers the current playback time.
 *
 * NOTE: boxes update at sampled-frame granularity (~1/sec, same as the
 * risk timeline bar), not literally every video frame — so a box can
 * appear/disappear up to ~1s before or after the exact real moment.
 */
function DetectionOverlay({ videoRef, timeline }) {
  const [rect, setRect] = useState(null);
  const [activeDetections, setActiveDetections] = useState([]);
  const [nativeSize, setNativeSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    const updateRect = () => {
      setRect(getContainedRect(videoEl));
      setNativeSize({ w: videoEl.videoWidth, h: videoEl.videoHeight });
    };

    const handleTimeUpdate = () => {
      const seg = findActiveSegment(timeline, videoEl.currentTime);
      setActiveDetections(seg && seg.damage_detected ? seg.detections || [] : []);
    };

    updateRect();
    handleTimeUpdate();

    videoEl.addEventListener("loadedmetadata", updateRect);
    videoEl.addEventListener("timeupdate", handleTimeUpdate);
    window.addEventListener("resize", updateRect);

    return () => {
      videoEl.removeEventListener("loadedmetadata", updateRect);
      videoEl.removeEventListener("timeupdate", handleTimeUpdate);
      window.removeEventListener("resize", updateRect);
    };
  }, [videoRef, timeline]);

  if (!rect || !nativeSize.w || activeDetections.length === 0) return null;

  const scaleX = rect.width / nativeSize.w;
  const scaleY = rect.height / nativeSize.h;

  return (
    <div
      className="detection-overlay"
      style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}
    >
      {activeDetections.map((d, i) => {
        const [x1, y1, x2, y2] = d.bbox_xyxy;
        return (
          <div
            key={i}
            className="detection-box"
            style={{
              left: x1 * scaleX,
              top: y1 * scaleY,
              width: (x2 - x1) * scaleX,
              height: (y2 - y1) * scaleY,
            }}
          >
            <span className="detection-box-label">
              {(BUCKET_LABELS[d.bucket] || d.bucket)} {Math.round(d.confidence * 100)}%
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default DetectionOverlay;