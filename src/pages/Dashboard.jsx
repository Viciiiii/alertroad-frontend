import { useState } from "react";
import NavBar from "../components/NavBar";
import UploadSection from "../components/UploadSection";
import ScanResult from "../components/ScanResult";
import BottomPanels from "../components/BottomPanels";
import ScanModal from "../components/ScanModal";
import InfoSections from "../components/InfoSections";
import AddCameraModal from "../components/AddCameraModal";
import { mockScanResult } from "../data/mockScans";
import { initialCameras } from "../data/mockCameras";
import "./Dashboard.css";

// scanState: "idle" | "loading" | "success" | "error" | "no-file-error" | "no-camera-error"
function Dashboard() {
  const [scanState, setScanState] = useState("idle");
  const [currentScan, setCurrentScan] = useState(null);
  const [recentScans, setRecentScans] = useState([]);
  const [modalScan, setModalScan] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);

  const [cameras, setCameras] = useState(initialCameras);
  const [selectedCameraId, setSelectedCameraId] = useState(null);
  const [showAddCameraModal, setShowAddCameraModal] = useState(false);

  const handleFileSelect = (file) => {
    setSelectedFile(file);
  };

  const handleClassify = () => {
    if (!selectedCameraId) {
      setScanState("no-camera-error");
      return;
    }

    if (!selectedFile) {
      setScanState("no-file-error");
      return;
    }

    setScanState("loading");

    const selectedCamera = cameras.find((cam) => cam.id === selectedCameraId);

    // Simulated backend call — replace with real API call later
    setTimeout(() => {
      const isSuccess = Math.random() > 0.15; // simulate occasional server failure

      if (!isSuccess) {
        setScanState("error");
        return;
      }

      const result = {
        ...mockScanResult,
        location: selectedCamera ? selectedCamera.location : mockScanResult.location,
        cameraName: selectedCamera ? selectedCamera.name : "Unknown Camera",
        fileName: selectedFile.name,
        fileUrl: URL.createObjectURL(selectedFile),
        fileType: selectedFile.type.startsWith("video") ? "Video" : "Image",
      };

      setCurrentScan(result);
      setRecentScans((prev) => [result, ...prev]);
      setScanState("success");
    }, 2000);
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

  const handleAddCamera = (newCamera) => {
    setCameras((prev) => [...prev, newCamera]);
    setSelectedCameraId(newCamera.id);
  };

  const handleDeleteCamera = (cameraId) => {
    setCameras((prev) => prev.filter((cam) => cam.id !== cameraId));
    setSelectedCameraId((prev) => (prev === cameraId ? null : prev));
  };

  return (
    <div className="dashboard-page">
      <NavBar />

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
          />
        )}

        <BottomPanels
          recentScans={recentScans}
          onSelectScan={handleOpenModal}
        />
      </div>

      <InfoSections />

      {modalScan && (
        <ScanModal scan={modalScan} onClose={handleCloseModal} />
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