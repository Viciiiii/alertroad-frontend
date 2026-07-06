import './RecentScansTable.css';

function RecentScansTable() {
  return (
    <div className="recent-scans">
      <p className="recent-scans-title">Recent Scans</p>
      <div className="recent-scans-canvas">
        <p>Nothing scanned yet. Your first result will show up here.</p>
      </div>
    </div>
  );
}

export default RecentScansTable;