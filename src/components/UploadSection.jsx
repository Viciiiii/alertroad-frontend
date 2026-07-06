import './UploadSection.css';    

function UploadSection() {

    return(
        <div className="upload-section">
            <h2>Upload an Image or Video</h2>
            <p>jpg for a photo · mp4, mov for recorded CCTV footage</p>
        
            <div className="upload-controls">
                <select>
                    <option value="">Camera</option>
                    <option value="1">Camera 1 - Katipunan Ave</option>
                    <option value="2">Camera 2 - Anabu Coastal</option>
                </select>

                <button className="browse-button">Browse Files</button>
                <button className="classify-button">Classify</button>
            </div>
        </div>
    );
}

export default UploadSection;