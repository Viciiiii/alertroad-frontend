import { useState, useRef, useEffect } from "react";
import "./CameraSelect.css";

function CameraSelect({
  cameras,
  selectedCameraId,
  onSelect,
  onAddCamera,
  onDeleteCamera,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedCamera = cameras.find((cam) => cam.id === selectedCameraId);

  const handleSelectCamera = (camera) => {
    onSelect(camera);
    setIsOpen(false);
  };

  const handleAddCameraClick = () => {
    setIsOpen(false);
    onAddCamera();
  };

  const handleDeleteClick = (e, cameraId) => {
    e.stopPropagation();
    onDeleteCamera(cameraId);
  };

  return (
    <div className="camera-select" ref={dropdownRef}>
      <button
        type="button"
        className="camera-select-trigger"
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <span className="camera-select-label">
          {selectedCamera ? selectedCamera.name : "Camera"}
        </span>
        <span className={`camera-select-arrow ${isOpen ? "open" : ""}`}>
          <svg viewBox="0 0 12 8" width="12" height="8">
            <path
              d="M1 1.5L6 6.5L11 1.5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
        </span>
      </button>

      {isOpen && (
        <div className="camera-select-menu">
          {cameras.length === 0 ? (
            <p className="camera-select-empty">No cameras registered yet</p>
          ) : (
            cameras.map((camera) => (
              <div
                key={camera.id}
                className={`camera-select-item ${
                  camera.id === selectedCameraId ? "selected" : ""
                }`}
                onClick={() => handleSelectCamera(camera)}
              >
                <div className="camera-select-item-text">
                  <span className="camera-select-item-name">
                    {camera.name}
                  </span>
                  <span className="camera-select-item-location">
                    {camera.location}
                  </span>
                </div>
                <button
                  type="button"
                  className="camera-select-delete"
                  onClick={(e) => handleDeleteClick(e, camera.id)}
                  aria-label={`Delete ${camera.name}`}
                >
                  ×
                </button>
              </div>
            ))
          )}

          <div className="camera-select-divider" />

          <button
            type="button"
            className="camera-select-add"
            onClick={handleAddCameraClick}
          >
            + Add New Camera
          </button>
        </div>
      )}
    </div>
  );
}

export default CameraSelect;