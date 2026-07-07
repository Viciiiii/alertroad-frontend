import { useState } from "react";
import NavBar from "../components/NavBar";
import UploadSection from "../components/UploadSection";
import ScanResult from "../components/ScanResult";
import BottomPanels from "../components/BottomPanels";
import ScanModal from "../components/ScanModal";
import { mockScanResult } from "../data/mockScans";
import "./Dashboard.css";

// scanState: "idle" | "loading" | "success" | "error"
function Dashboard() {
  const [scanState, setScanState] = useState("idle");
  const [currentScan, setCurrentScan] = useState(null);
  const [recentScans, setRecentScans] = useState([]);
  const [modalScan, setModalScan] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);

  const handleFileSelect = (file) => {
    setSelectedFile(file);
  };

  const handleClassify = () => {
    if (!selectedFile) {
      setScanState("no-file-error");
      return;
    }

    setScanState("loading");

    // Simulated backend call — replace with real API call later
    setTimeout(() => {
      const isSuccess = Math.random() > 0.15; // simulate occasional server failure

      if (!isSuccess) {
        setScanState("error");
        return;
      }

      const result = {
        ...mockScanResult,
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

  return (
    <div className="dashboard-page">
      <NavBar />

      <section id="overview" className="dashboard-hero">
        <h1 className="dashboard-title">
          See road risk before it becomes an accident
        </h1>
        <p className="dashboard-subtitle">
          AlertRoad reads road images and recorded CCTV footage, detects
          damage and traffic, and scores accident risk automatically — so LGU
          teams know exactly where to act first.
        </p>
      </section>

      <div className="dashboard-content">
        {scanState === "success" && currentScan ? (
          <ScanResult scan={currentScan} onUploadAnother={handleUploadAnother} />
        ) : (
          <UploadSection
            scanState={scanState}
            onFileSelect={handleFileSelect}
            onClassify={handleClassify}
            onRetry={handleRetry}
          />
        )}

        <BottomPanels
          recentScans={recentScans}
          onSelectScan={handleOpenModal}
        />
      </div>

      {modalScan && (
        <ScanModal scan={modalScan} onClose={handleCloseModal} />
      )}
    </div>
  );
}

export default Dashboard;