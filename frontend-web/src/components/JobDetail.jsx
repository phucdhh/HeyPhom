import { useState, useEffect } from 'react'
import axios from 'axios'
import './JobDetail.css'

function JobDetail({ sessionId, onBack, onRefresh }) {
  const [job, setJob] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [logs, setLogs] = useState([])
  const [cancelling, setCancelling] = useState(false)

  useEffect(() => {
    fetchJobDetail()
    const interval = setInterval(fetchJobDetail, 5000) // Refresh every 5 seconds
    return () => clearInterval(interval)
  }, [sessionId])

  const fetchJobDetail = async () => {
    try {
      const response = await axios.get(`/api/jobs/${sessionId}`)
      setJob(response.data.data)
      if (response.data.data.logs) {
        setLogs(response.data.data.logs)
      }
      setError(null)
    } catch (err) {
      setError(err.response?.data?.message || err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel this job?')) return
    
    setCancelling(true)
    try {
      await axios.post(`/api/jobs/${sessionId}/cancel`)
      await fetchJobDetail()
      onRefresh()
    } catch (err) {
      alert(`Failed to cancel: ${err.response?.data?.message || err.message}`)
    } finally {
      setCancelling(false)
    }
  }

  const handleDownload = async (format) => {
    try {
      // Use the URL from job.results if available, otherwise construct it
      const downloadUrl = job.results?.[format]?.url || `/api/download/${sessionId}/model.${format}`
      
      const response = await axios.get(downloadUrl, {
        responseType: 'blob'
      })
      
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `model_${sessionId}.${format}`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      alert(`Download failed: ${err.response?.data?.message || err.message}`)
    }
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed': return '✅'
      case 'processing': return '⚙️'
      case 'pending': return '⏳'
      case 'failed': return '❌'
      case 'cancelled': return '🚫'
      default: return '📋'
    }
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString()
  }

  const formatDuration = (ms) => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    
    if (hours > 0) return `${hours}h ${minutes % 60}m`
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`
    return `${seconds}s`
  }

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner large"></div>
        <p>Loading job details...</p>
      </div>
    )
  }

  if (error || !job) {
    return (
      <div className="error-container">
        <p>❌ Error loading job: {error || 'Job not found'}</p>
        <button onClick={onBack} className="back-btn">← Back to List</button>
      </div>
    )
  }

  return (
    <div className="job-detail-container">
      <div className="detail-header">
        <button onClick={onBack} className="back-btn">← Back</button>
        <h2>{getStatusIcon(job.status)} Job Details</h2>
      </div>

      <div className="detail-grid">
        {/* Status Card */}
        <div className="detail-card status-card">
          <h3>Status</h3>
          <div className={`status-badge ${job.status}`}>
            {job.status.toUpperCase()}
          </div>
          {job.progress !== undefined && (
            <>
              <div className="progress-container">
                <div className="progress-bar-large">
                  <div 
                    className="progress-fill" 
                    style={{ width: `${job.progress}%` }}
                  ></div>
                </div>
                <div className="progress-text">{job.progress}%</div>
              </div>
            </>
          )}
        </div>

        {/* Info Card */}
        <div className="detail-card">
          <h3>Information</h3>
          <div className="info-list">
            <div className="info-row">
              <span className="info-label">Session ID:</span>
              <span className="info-value monospace">{job.sessionId}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Created:</span>
              <span className="info-value">{formatDate(job.createdAt)}</span>
            </div>
            {job.completedAt && (
              <div className="info-row">
                <span className="info-label">Completed:</span>
                <span className="info-value">{formatDate(job.completedAt)}</span>
              </div>
            )}
            {job.processingTime && (
              <div className="info-row">
                <span className="info-label">Processing Time:</span>
                <span className="info-value">{formatDuration(job.processingTime)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Settings Card */}
        <div className="detail-card">
          <h3>Settings</h3>
          <div className="info-list">
            <div className="info-row">
              <span className="info-label">Images:</span>
              <span className="info-value">📸 {job.imageCount}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Quality:</span>
              <span className="info-value">⚙️ {job.quality}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Formats:</span>
              <span className="info-value">{job.formats?.join(', ') || 'N/A'}</span>
            </div>
          </div>
        </div>

        {/* Actions Card */}
        <div className="detail-card actions-card">
          <h3>Actions</h3>
          <div className="action-buttons">
            {job.status === 'completed' && job.formats && (
              <>
                {job.formats.map(format => (
                  <button 
                    key={format}
                    onClick={() => handleDownload(format)}
                    className="action-btn download"
                  >
                    ⬇️ Download {format.toUpperCase()}
                  </button>
                ))}
              </>
            )}
            {(job.status === 'pending' || job.status === 'processing') && (
              <button 
                onClick={handleCancel}
                disabled={cancelling}
                className="action-btn cancel"
              >
                {cancelling ? '⏳ Cancelling...' : '🚫 Cancel Job'}
              </button>
            )}
            {job.status === 'failed' && job.error && (
              <div className="error-message">
                <strong>Error:</strong> {job.error}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Logs Section */}
      {logs.length > 0 && (
        <div className="detail-card logs-card">
          <h3>📝 Processing Logs</h3>
          <div className="logs-container">
            {logs.map((log, index) => (
              <div key={index} className={`log-entry ${log.level || 'info'}`}>
                <span className="log-time">{new Date(log.timestamp).toLocaleTimeString()}</span>
                <span className="log-message">{log.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default JobDetail
