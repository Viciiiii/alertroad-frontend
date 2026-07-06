import './NavBar.css';

function NavBar() {

    return (
        <nav className="navbar">
            <div className="navbar-logo">ALERTROAD</div>

            <div className="navbar-links">
                <span>Overview</span>
                <span>Features</span>
                <span>How it works</span>
            </div>

            <div className="navbar-user">
                <span>Admin</span>
                <button>Log Out</button>
            </div>
        </nav>
    
    );
}

export default NavBar;