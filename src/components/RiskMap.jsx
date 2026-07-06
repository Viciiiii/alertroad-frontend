import './RiskMap.css';

function RiskMap() {
  return (
    <div className="risk-map">
      <div className="risk-map-header">
        <span>Road Risk Map</span>
        <span className="risk-map-legend">Low &nbsp; Medium &nbsp; High</span>
      </div>
      <div className="risk-map-canvas">
        <p>No scans yet — pins will appear here after your first upload</p>
      </div>
    </div>
  );
}

export default RiskMap;