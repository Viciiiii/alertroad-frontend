# Known Limitations

This is a short, honest list of the approximations and edge cases in
AlertRoad's video pipeline, meant to be pulled into the capstone
report/defense as-is. Each item below is also documented as a comment
at its source in the code, referenced here for convenience.

## 1. Damage counting is position-overlap tracking, not true visual identity

`potholes` / `cracks` counts for a video come from a persistent IOU-based
tracker (`ml_model/video_analysis.py::count_distinct_objects`) that
matches detections across sampled frames by bounding-box overlap, not by
any visual/feature-based re-identification.

- Sampling is sparse (~1 frame/sec, see #2), and the source footage is
  typically a moving camera (dashcam/CCTV) — so this can:
  - **Undercount**, if the same object's position drifts enough between
    samples that its overlap falls below the matching threshold and it's
    (wrongly) treated as a new object.
  - **Overcount**, if an object is out of frame for longer than the
    tracker's gap tolerance (3 sampled frames) and reappears — it's then
    treated as new rather than the same object again.
- **This is a best-effort approximation**, not a verified ground-truth
  count. It should be presented as "distinct damage instances detected"
  rather than a guaranteed inventory count.

## 2. Video sampling is ~1 frame/sec, capped at 20 samples per video

`VIDEO_SAMPLE_FPS = 1.0`, `VIDEO_MAX_FRAMES = 20`
(`ml_model/predict.py`, plan computed by
`video_analysis.compute_video_sample_plan`).

- For videos under ~20s, this is close to a true 1 sample/sec.
- For longer videos, the 20-sample cap is spread evenly across the full
  duration instead of only covering the first ~20 seconds — but this
  means the *interval* between samples grows for longer clips (e.g. a
  53s video samples roughly every 2.7s, not every 1s). Anything that
  happens between two samples is not analyzed at all.
- Practical effect: a very brief, small pothole that appears and
  disappears between two sampled frames of a long video can be missed
  entirely.

## 3. Peak traffic is a single busiest frame, not a deduplicated vehicle total

The `traffic` figure for a video (`peak_traffic` in `_predict_video`) is
the highest vehicle count seen in any *one* sampled frame — it is **not**
a count of distinct vehicles that passed through the scene. The same
physical vehicle visible across several consecutive sampled frames is
counted again in each of those frames' totals, not merged into one.

## 4. The detection overlay updates at sampled-frame granularity

`DetectionOverlay.jsx` shows bounding boxes for whichever sampled frame
is closest in time to the current video playback position — it does not
re-run detection on every actual video frame. Boxes can appear or
disappear up to ~0.5s before or after the real moment they correspond to,
matching the ~1/sec sampling rate above.

## 5. Risk classification is frame-level, not scene-level

Each sampled frame gets its own independent risk score (damage + traffic
context via the Random Forest classifier); there's no temporal smoothing
or scene-level reasoning across frames. A single anomalous frame (e.g. a
misdetection) can momentarily swing the "worst" risk label for a video
result.

---

**Why this list exists:** these are deliberate, documented trade-offs
that keep the pipeline fast enough to run per-request on a single
machine, not oversights. Framing them this way in the report/defense —
"here's what the system does well, and here's where we know it
approximates, and why" — tends to land better than leaving them to be
discovered.