import NavBar from '../components/NavBar';
import UploadSection from '../components/UploadSection';
import RiskMap from '../components/RiskMap';
import RecentScansTable from '../components/RecentScansTable';
import './Dashboard.css';

function Dashboard() {

    return(
        <div>
            <NavBar />

            <div className="dashboard-content">
                <div className="dashboard-hero">
                <h2>See road risk before it becomes an accident</h2>
                <p>AlertRoad reads road images and recorded CCTV footage, detects
            damage and traffic, and scores accident risk automatically — so
            LGU teams know exactly where to act first.</p>
                </div>

            <UploadSection />

            <div className="dashboard-panels">
                <RiskMap />
                <RecentScansTable />
            </div>

            </div>
        </div>
    );
}

export default Dashboard;