import { useState, useEffect } from 'react'
import axios from 'axios'
import JobDetail from './JobDetail'
import './JobList.css'

function JobList() {
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedJob, setSelectedJob] = useState(null)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    fetchJobs()
    const interval = setInterval(fetchJobs, 10000) // Refresh every 10 seconds
    return () => clearInterval(interval)
  }, [filter])

  const fetchJobs = async () => {
    try {
      const params = filter !== 'all' ? { status: filter } : {}
      const response = await axios.get('/api/jobs', { params })
      setJobs(response.data.data.jobs)
      setError(null)
    } catch (err) {
      setError(err.response?.data?.message || err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteJob = async (sessionId, e) => {
    e.stopPropagation() // Prevent card click
    if (!confirm('Delete this job? This action cannot be undone.')) return
    
    try {
      await axios.delete(`/api/jobs/${sessionId}`)
      fetchJobs()
    } catch (err) {
      alert(`Failed to delete job: ${err.response?.data?.message || err.message}`)
    }
  }

  const handleStartProcessing = async (sessionId, e) => {
    e.stopPropagation() // Prevent card click
    
    try {
      // Optimistic update: mark as processing immediately
      setJobs(prev => prev.map(job => 
        job.sessionId === sessionId ? { ...job, status: 'processing', progress: 0 } : job
      ))
      
      const response = await axios.post(`/api/jobs/${sessionId}/process`)
      console.log('Processing started:', response.data)
      
      // Refresh to get actual status
      setTimeout(fetchJobs, 1000)
    } catch (err) {
      // Revert optimistic update on error
      fetchJobs()
      alert(`Failed to start processing: ${err.response?.data?.message || err.message}`)
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'success'
      case 'processing': return 'primary'
      case 'pending': return 'warning'
      case 'failed': return 'danger'
      case 'cancelled': return 'secondary'
      default: return 'secondary'
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
    const date = new Date(dateString)
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner large"></div>
        <p>Loading jobs...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="error-container">
        <p>❌ Error loading jobs: {error}</p>
        <button onClick={fetchJobs} className="retry-btn">Retry</button>
      </div>
    )
  }

  return (
    <div className="job-list-container">
      {selectedJob ? (
        <JobDetail 
          sessionId={selectedJob} 
          onBack={() => setSelectedJob(null)}
          onRefresh={fetchJobs}
        />
      ) : (
        <>
          <div className="job-list-header">
            <h2>📊 Processing Jobs</h2>
            <div className="filter-buttons">
              {['all', 'pending', 'processing', 'completed', 'failed'].map(status => (
                <button
                  key={status}
                  className={`filter-btn ${filter === status ? 'active' : ''}`}
                  onClick={() => setFilter(status)}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {jobs.length === 0 ? (
            <div className="empty-state">
              <p className="empty-icon">📭</p>
              <h3>No jobs found</h3>
              <p>Upload some images to start processing!</p>
            </div>
          ) : (
            <div className="jobs-grid">
              {jobs.map(job => (
                <div 
                  key={job.sessionId} 
                  className={`job-card ${getStatusColor(job.status)}`}
                  onClick={() => setSelectedJob(job.sessionId)}
                >
                  <div className="job-header">
                    <div className="job-status">
                      <span className="status-icon">{getStatusIcon(job.status)}</span>
                      <span className="status-text">{job.status}</span>
                    </div>
                    {job.progress !== undefined && (
                      <div className="progress-badge">{job.progress}%</div>
                    )}
                  </div>

                  <div className="job-info">
                    <p className="job-id">{job.sessionId}</p>
                    <div className="job-meta">
                      <span>📸 {job.imageCount} images</span>
                      <span>⚙️ {job.quality}</span>
                    </div>
                    <p className="job-date">🕐 {formatDate(job.createdAt)}</p>
                  </div>

                  {job.progress !== undefined && job.progress > 0 && (
                    <div className="progress-bar">
                      <div 
                        className="progress-fill" 
                        style={{ width: `${job.progress}%` }}
                      ></div>
                    </div>
                  )}

                  <div className="job-footer">
                    <div className="job-actions">
                      {job.status === 'pending' && (
                        <button 
                          className="action-btn primary"
                          onClick={(e) => handleStartProcessing(job.sessionId, e)}
                          title="Start Processing"
                        >
                          ▶️ Process
                        </button>
                      )}
                      <button 
                        className="action-btn danger"
                        onClick={(e) => handleDeleteJob(job.sessionId, e)}
                        title="Delete Job"
                      >
                        🗑️ Delete
                      </button>
                    </div>
                    <span className="view-details">View Details →</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="refresh-info">
            <p>🔄 Auto-refreshing every 10 seconds</p>
            <button onClick={fetchJobs} className="manual-refresh-btn">
              Refresh Now
            </button>
          </div>
        </>
      )}
    </div>
  )
}

export default JobList
