import { useRef, useState } from "react";
import CameraSelect from "./CameraSelect";
import "./UploadSection.css";

function UploadSection({
  scanState,
  onFileSelect,
  onClassify,
  onRetry,
  cameras,
  selectedCameraId,
  onSelectCamera,
  onAddCamera,
  onDeleteCamera,
}) {
  const fileInputRef = useRef(null);
  const [fileName, setFileName] = useState("");

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
      onFileSelect(file);
    }
  };

  if (scanState === "loading") {
    return (
      <div className="upload-section upload-section-loading">
        <div className="upload-spinner" />
        <h2 className="upload-loading-title">Analyzing footage...</h2>
        <p className="upload-loading-subtitle">
          Running road-damage and traffic detection, then scoring accident
          risk. This may take a moment for video files.
        </p>
        <div className="upload-progress-track">
          <div className="upload-progress-fill" />
        </div>
      </div>
    );
  }

  if (scanState === "error") {
    return (
      <div className="upload-section upload-section-error">
        <div className="upload-error-icon">!</div>
        <h2 className="upload-error-title">Something went wrong</h2>
        <p className="upload-error-subtitle">
          We couldn't analyze the file. This may be a temporary issue with
          the server.
        </p>
        <button className="upload-retry-button" onClick={onRetry}>
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="upload-section">
      <h2 className="upload-title">Upload an Image or Video</h2>
      <p className="upload-subtitle">
        jpg, png for a photo · mp4, mov for recorded CCTV footage
      </p>

      <div className="upload-controls">
        <CameraSelect
          cameras={cameras}
          selectedCameraId={selectedCameraId}
          onSelect={(camera) => onSelectCamera(camera.id)}
          onAddCamera={onAddCamera}
          onDeleteCamera={onDeleteCamera}
          isAdmin={isAdmin}
        />

        <button className="upload-browse-button" onClick={handleBrowseClick}>
          {fileName ? fileName : "Browse Files"}
        </button>

        <input
          type="file"
          ref={fileInputRef}
          accept="image/jpeg,image/png,video/mp4,video/quicktime"
          onChange={handleFileChange}
          hidden
        />

        <button className="upload-classify-button" onClick={onClassify}>
          Classify
        </button>
      </div>

      {scanState === "no-file-error" && (
        <p className="upload-inline-error">
          Please select a camera before classifying. Unsupported file type
          may also not be allowed.
        </p>
      )}

      {scanState === "no-camera-error" && (
        <p className="upload-inline-error">
          Please select a camera location before classifying.
        </p>
      )}
    </div>
  );
}

export default UploadSection;