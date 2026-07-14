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

// Finds the timeline entry closest in time to the given playback time,
// rather than always the most recent PAST sample — with only ~1 sampled
// frame per second, always-floor-to-previous meant boxes could visibly lag
// up to ~1s behind right before the next sample landed. Nearest-match
// instead centers that error: boxes can now appear up to half a sample
// interval early or late, but never drift stale for a full interval the
// way floor-matching did.
//
// maxGapSec caps HOW close "closest" has to actually be. Plain nearest-
// match has no such limit — it always returns *some* entry, even for a
// playback moment far from every real sample (before the first sample,
// after the last one, or across an unusually large gap between two
// samples). Without a cap, that stretches one real detection's box across
// however much unsampled time sits next to it, which looks like a box
// "stuck" on screen with nothing actually there. See getMaxMatchGapSec.
function findActiveSegment(timeline, currentTime, maxGapSec) {
  if (!timeline || timeline.length === 0) return null;
  const closest = timeline.reduce((closest, entry) =>
    Math.abs(entry.timestamp_sec - currentTime) < Math.abs(closest.timestamp_sec - currentTime)
      ? entry
      : closest
  );
  if (Math.abs(closest.timestamp_sec - currentTime) > maxGapSec) return null;
  return closest;
}

// Derives "how close counts as close enough" from the timeline's own
// sample spacing, instead of a hardcoded number — sample intervals vary
// (short videos sample ~1/sec, longer ones are spread coarser to cover
// the full duration, see video_analysis.py). Half the average interval
// is exactly the natural decision boundary nearest-match already uses
// BETWEEN two neighboring samples (the midpoint); this just applies that
// same boundary at the two open ends of the timeline too, where there's
// no "next neighbor" to naturally stop an unbounded match.
function getMaxMatchGapSec(timeline) {
  if (!timeline || timeline.length < 2) return 1.5; // not enough samples to infer spacing
  const first = timeline[0].timestamp_sec;
  const last = timeline[timeline.length - 1].timestamp_sec;
  const avgInterval = (last - first) / (timeline.length - 1);
  return avgInterval / 2;
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
 * sampled frame in video_timeline is CLOSEST in time to the current
 * playback position (not necessarily the most recent past one) — but only
 * if that closest sample is actually near enough (see getMaxMatchGapSec);
 * otherwise no boxes are shown at all, rather than stretching a stale
 * detection across a stretch of video that was never sampled.
 *
 * NOTE: boxes update at sampled-frame granularity, not literally every
 * video frame — sample spacing varies with video length (see
 * video_analysis.py), so a box can appear/disappear up to roughly half a
 * sample interval before or after the exact real moment.
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

    const maxGapSec = getMaxMatchGapSec(timeline);

    const handleTimeUpdate = () => {
      const seg = findActiveSegment(timeline, videoEl.currentTime, maxGapSec);
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