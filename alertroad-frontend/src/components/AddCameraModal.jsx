import { useState } from "react";
import LocationAutocomplete from "./LocationAutocomplete";
import "./AddCameraModal.css";

function AddCameraModal({ onClose, onAddCamera }) {
  const [name, setName] = useState("");
  const [locationText, setLocationText] = useState("");
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [error, setError] = useState("");

  const handleBackdropClick = () => {
    onClose();
  };

  const handleCardClick = (e) => {
    e.stopPropagation();
  };

  const handleLocationTextChange = (text) => {
    setLocationText(text);
    // Any manual retyping invalidates the previously selected coordinates
    setSelectedLocation(null);
  };

  const handleSelectLocation = (location) => {
    setLocationText(location.address);
    setSelectedLocation(location);
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!name.trim()) {
      setError("Please enter a camera name.");
      return;
    }

    if (!selectedLocation) {
      setError("Please select a location from the suggestions list.");
      return;
    }

    onAddCamera({
      id: `cam-${Date.now()}`,
      name: name.trim(),
      location: selectedLocation.address,
      lat: selectedLocation.lat,
      lng: selectedLocation.lng,
    });

    onClose();
  };

  return (
    <div className="add-camera-backdrop" onClick={handleBackdropClick}>
      <div className="add-camera-card" onClick={handleCardClick}>
        <button className="add-camera-close" onClick={onClose}>
          ×
        </button>

        <h2 className="add-camera-title">Add New Camera</h2>
        <p className="add-camera-subtitle">
          Register a camera once so its location can be reused for every
          future upload.
        </p>

        <form onSubmit={handleSubmit} noValidate>
          <label className="add-camera-label" htmlFor="camera-name">
            Camera Name
          </label>
          <input
            id="camera-name"
            type="text"
            className="add-camera-input"
            placeholder="e.g. Camera 4 – Commonwealth Ave."
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <label className="add-camera-label" htmlFor="camera-location">
            Location
          </label>
          <div className="add-camera-location-wrapper">
            <LocationAutocomplete
              value={locationText}
              onChange={handleLocationTextChange}
              onSelectLocation={handleSelectLocation}
            />
          </div>

          {error && <p className="add-camera-error">{error}</p>}

          <button type="submit" className="add-camera-submit">
            Save Camera
          </button>
        </form>
      </div>
    </div>
  );
}

export default AddCameraModal;