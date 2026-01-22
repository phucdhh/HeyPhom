import { useState } from 'react'
import axios from 'axios'
import './Upload.css'

function Upload({ onComplete }) {
  const [files, setFiles] = useState([])
  const [selectedFiles, setSelectedFiles] = useState([]) // For display
  const [quality, setQuality] = useState('high')
  const [formats, setFormats] = useState(['usdz', 'obj', 'stl'])
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files)
    setFiles(selectedFiles)
    setSelectedFiles(selectedFiles.map((f, idx) => ({
      id: idx,
      name: f.name,
      size: f.size,
      status: 'pending'
    })))
    setError(null)
    setResult(null)
  }

  const handleFormatToggle = (format) => {
    if (formats.includes(format)) {
      setFormats(formats.filter(f => f !== format))
    } else {
      setFormats([...formats, format])
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (files.length < 30) {
      setError('Please upload at least 30 images for processing')
      return
    }

    if (formats.length === 0) {
      setError('Please select at least one output format')
      return
    }

    setUploading(true)
    setUploadProgress(0)
    setError(null)
    setResult(null)

    const formData = new FormData()
    files.forEach(file => {
      formData.append('files', file)
    })
    formData.append('quality', quality)
    formData.append('formats', formats.join(','))

    try {
      // Direct connection to backend (bypass Vite proxy for large uploads)
      const backendUrl = 'http://localhost:4444/api/upload';
      
      console.log(`Starting upload: ${files.length} files, total ${(files.reduce((sum, f) => sum + f.size, 0) / 1024 / 1024).toFixed(2)}MB to ${backendUrl}`);
      console.log('First 5 files:', files.slice(0, 5).map(f => ({ name: f.name, size: f.size })));
      
      const response = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        
        let lastProgress = 0;
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const percentCompleted = Math.round((e.loaded * 100) / e.total)
            setUploadProgress(percentCompleted)
            
            // Log if progress changed significantly or stuck
            if (percentCompleted !== lastProgress) {
              console.log(`Upload Progress: ${percentCompleted}%`, {
                loaded: e.loaded,
                total: e.total,
                loadedMB: (e.loaded / 1024 / 1024).toFixed(2),
                totalMB: (e.total / 1024 / 1024).toFixed(2),
                speed: e.loaded > 0 ? ((e.loaded / 1024 / 1024) / ((Date.now() - startTime) / 1000)).toFixed(2) + ' MB/s' : '0'
              })
              lastProgress = percentCompleted;
            }
          }
        });
        
        const startTime = Date.now();
        
        xhr.addEventListener('loadstart', () => {
          console.log('XHR loadstart - upload beginning');
        });
        
        xhr.addEventListener('load', () => {
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
          console.log(`XHR load - upload completed in ${elapsed}s, status: ${xhr.status}`);
          
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              resolve({ data: JSON.parse(xhr.responseText) });
            } catch (e) {
              reject(new Error('Invalid JSON response'));
            }
          } else {
            reject(new Error(`HTTP ${xhr.status}: ${xhr.responseText}`));
          }
        });
        
        xhr.addEventListener('error', () => {
          reject(new Error('Network error'));
        });
        
        xhr.addEventListener('timeout', () => {
          reject(new Error('Upload timeout'));
        });
        
        xhr.open('POST', backendUrl);
        xhr.timeout = 600000; // 10 minutes for large file processing
        xhr.send(formData);
      })

      setResult(response.data)
      setFiles([])
      
      if (onComplete) {
        setTimeout(() => onComplete(), 1000)
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const totalSize = files.reduce((acc, file) => acc + file.size, 0)
  const totalSizeMB = (totalSize / 1024 / 1024).toFixed(2)

  return (
    <div className="upload-container">
      <div className="card">
        <h2>📤 Upload Images</h2>
        <p className="description">
          Upload at least 30 high-resolution images of your object from different angles
        </p>

        <form onSubmit={handleSubmit} className="upload-form">
          {/* File Upload */}
          <div className="form-group">
            <label className="file-upload-label">
              <input
                type="file"
                multiple
                accept="image/jpeg,image/jpg,image/png,image/heic,image/heif"
                onChange={handleFileChange}
                disabled={uploading}
                className="file-input"
              />
              <div className="file-upload-button">
                <span className="icon">📁</span>
                <span>Choose Images</span>
              </div>
            </label>
            
            {files.length > 0 && (
              <div className="file-info">
                <p>✅ {files.length} files selected ({totalSizeMB} MB)</p>
                {files.length < 30 && (
                  <p className="warning">⚠️ Need at least 30 images (current: {files.length})</p>
                )}
                
                {/* File List */}
                {selectedFiles.length > 0 && (
                  <div className="file-list">
                    <h4>Selected Files:</h4>
                    <div className="file-list-scroll">
                      {selectedFiles.slice(0, 10).map((file, idx) => (
                        <div key={idx} className="file-item">
                          <span className="file-icon">📷</span>
                          <span className="file-name">{file.name}</span>
                          <span className="file-size">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                          <span className={`file-status ${file.status}`}>
                            {file.status === 'pending' && '⏳'}
                            {file.status === 'uploading' && '📤'}
                            {file.status === 'success' && '✅'}
                            {file.status === 'error' && '❌'}
                          </span>
                        </div>
                      ))}
                      {selectedFiles.length > 10 && (
                        <div className="file-item-more">
                          ... and {selectedFiles.length - 10} more files
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Quality Selection */}
          <div className="form-group">
            <label>Quality Level</label>
            <div className="quality-options">
              {['low', 'medium', 'high', 'ultra'].map(q => (
                <button
                  key={q}
                  type="button"
                  className={`quality-btn ${quality === q ? 'active' : ''}`}
                  onClick={() => setQuality(q)}
                  disabled={uploading}
                >
                  {q.charAt(0).toUpperCase() + q.slice(1)}
                </button>
              ))}
            </div>
            <p className="hint">
              {quality === 'low' && '⚡ Fast processing (~5-10 min for 50 images)'}
              {quality === 'medium' && '⚙️ Balanced processing (~10-15 min for 50 images)'}
              {quality === 'high' && '🎯 High detail (~15-25 min for 50 images)'}
              {quality === 'ultra' && '💎 Maximum detail (~30-60 min for 50 images)'}
            </p>
          </div>

          {/* Format Selection */}
          <div className="form-group">
            <label>Output Formats</label>
            <div className="format-options">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={formats.includes('usdz')}
                  onChange={() => handleFormatToggle('usdz')}
                  disabled={uploading}
                />
                <span>USDZ (Apple AR)</span>
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={formats.includes('obj')}
                  onChange={() => handleFormatToggle('obj')}
                  disabled={uploading}
                />
                <span>OBJ (Universal)</span>
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={formats.includes('stl')}
                  onChange={() => handleFormatToggle('stl')}
                  disabled={uploading}
                />
                <span>STL (3D Printing)</span>
              </label>
            </div>
          </div>

          {/* Submit Button */}
          <button 
            type="submit" 
            className="submit-btn"
            disabled={uploading || files.length < 30 || formats.length === 0}
          >
            {uploading ? (
              <>
                <span className="spinner"></span>
                Uploading...
              </>
            ) : (
              <>
                <span>🚀</span>
                Start Processing
              </>
            )}
          </button>
          
          {/* Upload Progress Bar */}
          {uploading && (
            <div className="progress-container">
              <div className="progress-bar">
                <div 
                  className="progress-fill" 
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
              <p className="progress-text">{uploadProgress}% uploaded</p>
            </div>
          )}
        </form>

        {/* Result */}
        {result && (
          <div className="result success">
            <h3>✅ Upload Successful!</h3>
            <div className="result-details">
              <p><strong>Session ID:</strong> {result.data.sessionId}</p>
              <p><strong>Images:</strong> {result.data.uploadedCount}</p>
              <p><strong>Total Size:</strong> {result.data.totalSize}</p>
              <p><strong>Quality:</strong> {result.data.quality}</p>
              <p><strong>Formats:</strong> {result.data.formats.join(', ')}</p>
              <p><strong>Estimated Time:</strong> {result.data.estimatedTime}</p>
            </div>
            <p className="info">Processing started! Check "Processing Jobs" tab for status.</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="result error">
            <h3>❌ Error</h3>
            <p>{error}</p>
          </div>
        )}
      </div>

      {/* Tips */}
      <div className="card tips">
        <h3>💡 Tips for Best Results</h3>
        <ul>
          <li>📸 Use high-resolution images (5+ megapixels)</li>
          <li>🔄 Capture from all angles (360° coverage)</li>
          <li>📏 Maintain 60-80% overlap between photos</li>
          <li>💡 Ensure good lighting and minimal blur</li>
          <li>🎯 Use 100-150 images for detailed objects</li>
          <li>⏱️ Be patient - processing takes time!</li>
        </ul>
      </div>
    </div>
  )
}

export default Upload
