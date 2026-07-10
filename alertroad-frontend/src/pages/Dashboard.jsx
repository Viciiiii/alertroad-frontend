import { useState, useEffect } from "react";
import NavBar from "../components/NavBar";
import UploadSection from "../components/UploadSection";
import ScanResult from "../components/ScanResult";
import BottomPanels from "../components/BottomPanels";
import ScanModal from "../components/ScanModal";
import InfoSections from "../components/InfoSections";
import AddCameraModal from "../components/AddCameraModal";
import { useAuth } from "../context/AuthContext";
import "./Dashboard.css";

const API_URL = "";

// scanState: "idle" | "loading" | "success" | "error" | "no-file-error" | "no-camera-error"
function Dashboard() {
  const { isAdmin } = useAuth();

  const [scanState, setScanState] = useState("idle");
  const [currentScan, setCurrentScan] = useState(null);
  const [recentScans, setRecentScans] = useState([]);
  const [modalScan, setModalScan] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);

  const [cameras, setCameras] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState(null);
  const [showAddCameraModal, setShowAddCameraModal] = useState(false);

  // Used only when selectedCameraId === "manual" (handheld/mobile capture,
  // where there's no pre-registered camera to pull a location from).
  const [manualLocation, setManualLocation] = useState({
    location: "",
    lat: "",
    lng: "",
  });

  const handleManualLocationTextChange = (text) => {
    setManualLocation((prev) => ({ ...prev, location: text, lat: "", lng: "" }));
  };

  const handleManualLocationSelect = ({ address, lat, lng }) => {
    setManualLocation({ location: address, lat, lng });
  };

  const authHeaders = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  });

  // Load past scans and registered cameras from the database on mount
  useEffect(() => {
    const loadScans = async () => {
      try {
        const response = await fetch(`${API_URL}/api/scans`);
        if (!response.ok) return;
        const data = await response.json();

        const formatted = data.map((scan) => ({
          ...scan,
          riskLevel: scan.risk_level,
          fileUrl: scan.image_filename ? `${API_URL}/uploads/${scan.image_filename}` : null,
          fileType: "Image",
          cameraName: scan.camera_name,
          lat: scan.lat,
          lng: scan.lng,
        }));

        setRecentScans(formatted);
      } catch (err) {
        console.error("Failed to load past scans:", err);
      }
    };

    const loadCameras = async () => {
      try {
        const response = await fetch(`${API_URL}/api/cameras`);
        if (!response.ok) return;
        const data = await response.json();
        setCameras(data);
      } catch (err) {
        console.error("Failed to load cameras:", err);
      }
    };

    loadScans();
    loadCameras();
  }, []);

  const handleFileSelect = (file) => {
    setSelectedFile(file);
  };

  const handleClassify = async () => {
    const isManualMode = selectedCameraId === "manual";

    if (!selectedCameraId) {
      setScanState("no-camera-error");
      return;
    }

    if (isManualMode) {
      const { location, lat, lng } = manualLocation;
      if (!location.trim() || lat === "" || lng === "") {
        setScanState("no-location-error");
        return;
      }
    }

    if (!selectedFile) {
      setScanState("no-file-error");
      return;
    }

    setScanState("loading");

    const formData = new FormData();
    formData.append("file", selectedFile);
    if (isManualMode) {
      formData.append("location", manualLocation.location);
      formData.append("lat", manualLocation.lat);
      formData.append("lng", manualLocation.lng);
    } else {
      formData.append("camera_id", selectedCameraId);
    }

    try {
      // NOTE: no "Content-Type" header here on purpose. The browser sets it
      // automatically for FormData (including a required boundary string),
      // so setting it manually breaks the upload. This is why we can't just
      // reuse authHeaders() here like the other requests below do.
      const response = await fetch(`${API_URL}/api/scans`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: formData,
      });

      if (!response.ok) {
        setScanState("error");
        return;
      }

      const saved = await response.json();

      const result = {
        ...saved,
        riskLevel: saved.risk_level,
        cameraName: saved.camera_name,
        lat: saved.lat,
        lng: saved.lng,
        fileName: selectedFile.name,
        fileUrl: `${API_URL}/uploads/${saved.image_filename}`,
        fileType: selectedFile.type.startsWith("video") ? "Video" : "Image",
      };

      setCurrentScan(result);
      setRecentScans((prev) => [result, ...prev]);
      setScanState("success");
    } catch (err) {
      console.error("Classify request failed:", err);
      setScanState("error");
    }
  };

  const handleRetry = () => {
    setScanState("idle");
    handleClassify();
  };

  const handleUploadAnother = () => {
    setScanState("idle");
    setSelectedFile(null);
  };

  const handleOpenModal = (scan) => {
    setModalScan(scan);
  };

  const handleCloseModal = () => {
    setModalScan(null);
  };

  const handleAddCamera = async (newCamera) => {
    try {
      const response = await fetch(`${API_URL}/api/cameras`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(newCamera),
      });

      if (!response.ok) {
        console.error("Failed to save camera");
        return;
      }

      const saved = await response.json();
      setCameras((prev) => [...prev, saved]);
      setSelectedCameraId(saved.id);
    } catch (err) {
      console.error("Add camera request failed:", err);
    }
  };

  const handleDeleteCamera = async (cameraId) => {
    try {
      const response = await fetch(`${API_URL}/api/cameras/${cameraId}`, {
        method: "DELETE",
        headers: authHeaders(),
      });

      if (!response.ok) {
        console.error("Failed to delete camera");
        return;
      }

      setCameras((prev) => prev.filter((cam) => cam.id !== cameraId));
      setSelectedCameraId((prev) => (prev === cameraId ? null : prev));
    } catch (err) {
      console.error("Delete camera request failed:", err);
    }
  };

  const handleDeleteScan = async (scanId) => {
  try {
    const response = await fetch(`${API_URL}/api/scans/${scanId}`, {
      method: "DELETE",
      headers: authHeaders(),
    });

    if (!response.ok) {
      console.error("Failed to delete scan");
      return;
    }

    setRecentScans((prev) => prev.filter((scan) => scan.id !== scanId));
    setModalScan(null);

    // If the scan being deleted is the one currently shown as the
    // "success" result at the top, clear it too and go back to the
    // upload view — otherwise it keeps showing a deleted scan.
    if (currentScan && currentScan.id === scanId) {
      setCurrentScan(null);
      setScanState("idle");
    }
  } catch (err) {
    console.error("Delete scan request failed:", err);
  }
};

  return (
    <div className="dashboard-page">
      <NavBar />

      <div className="dashboard-fold">
        <div className="dashboard-hero">
          <h1 className="dashboard-title">
            See road risk before it becomes an accident
          </h1>
          <p className="dashboard-subtitle">
            AlertRoad reads road images and recorded CCTV footage, detects
            damage and traffic, and scores accident risk automatically — so LGU
            teams know exactly where to act first.
          </p>
        </div>

        <div className="dashboard-content">
          {scanState === "success" && currentScan ? (
            <ScanResult scan={currentScan} onUploadAnother={handleUploadAnother} />
          ) : (
            <UploadSection
              scanState={scanState}
              onFileSelect={handleFileSelect}
              onClassify={handleClassify}
              onRetry={handleRetry}
              cameras={cameras}
              selectedCameraId={selectedCameraId}
              onSelectCamera={setSelectedCameraId}
              onAddCamera={() => setShowAddCameraModal(true)}
              onDeleteCamera={handleDeleteCamera}
              isAdmin={isAdmin}
              manualLocation={manualLocation}
              onManualLocationTextChange={handleManualLocationTextChange}
              onManualLocationSelect={handleManualLocationSelect}
            />
          )}

          <BottomPanels
            recentScans={recentScans}
            onSelectScan={handleOpenModal}
          />
        </div>
      </div>

      <InfoSections />

      {modalScan && (
        <ScanModal
          scan={modalScan}
          onClose={handleCloseModal}
          onDelete={handleDeleteScan}
          isAdmin={isAdmin}
        />
      )}

      {showAddCameraModal && (
        <AddCameraModal
          onClose={() => setShowAddCameraModal(false)}
          onAddCamera={handleAddCamera}
        />
      )}
    </div>
  );
}

export default Dashboard;