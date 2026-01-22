import { useState, useEffect } from 'react'
import { getAllProjects, deleteProject, getStorageInfo } from '../db/projects'
import { downloadBlob } from '../db/fileUtils'
import STLViewer from './STLViewer'

export default function MyModels({ onClose, onViewModel }) {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [storageInfo, setStorageInfo] = useState(null)
  const [filter, setFilter] = useState('all') // all, completed, processing, failed

  useEffect(() => {
    loadProjects()
    loadStorageInfo()
  }, [])

  const loadProjects = async () => {
    setLoading(true)
    try {
      const allProjects = await getAllProjects()
      // Sort by creation date, newest first
      allProjects.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      setProjects(allProjects)
    } catch (error) {
      console.error('Failed to load projects:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadStorageInfo = async () => {
    try {
      const info = await getStorageInfo()
      setStorageInfo(info)
    } catch (error) {
      console.error('Failed to load storage info:', error)
    }
  }

  const handleDelete = async (projectId) => {
    if (!confirm('Delete this model? This action cannot be undone.')) return
    
    try {
      await deleteProject(projectId)
      await loadProjects()
      await loadStorageInfo()
    } catch (error) {
      console.error('Failed to delete project:', error)
      alert('Failed to delete project')
    }
  }

  const handleDownload = (project, format) => {
    if (!project.files || !project.files[format]) {
      alert(`${format.toUpperCase()} file not available`)
      return
    }
    
    downloadBlob(project.files[format], `${project.name}.${format}`)
  }

  const handleView = (project) => {
    if (project.status !== 'completed' || !project.files?.stl) {
      alert('Model not ready for preview')
      return
    }
    
    try {
      // Ensure we have a valid Blob (Safari compatibility)
      let stlBlob = project.files.stl
      
      // If it's not a Blob, try to reconstruct it
      if (!(stlBlob instanceof Blob)) {
        console.warn('STL is not a Blob, attempting reconstruction...')
        
        // Check if it's a serialized Blob (Safari sometimes does this)
        if (stlBlob && typeof stlBlob === 'object') {
          // Try to create new Blob from the data
          if (stlBlob.type && stlBlob.size !== undefined) {
            // Might be a Blob-like object, try to convert
            stlBlob = new Blob([stlBlob], { type: stlBlob.type || 'application/sla' })
          } else {
            throw new Error('Invalid STL data structure')
          }
        } else {
          throw new Error('STL file is not a valid Blob object')
        }
      }
      
      // Verify Blob has content
      if (stlBlob.size === 0) {
        throw new Error('STL file is empty')
      }
      
      console.log('✅ Valid STL Blob:', stlBlob.size, 'bytes, type:', stlBlob.type)
      
      // Create blob URL and pass to parent
      const blobUrl = URL.createObjectURL(stlBlob)
      if (onViewModel) {
        onViewModel(blobUrl)
      }
    } catch (error) {
      console.error('❌ Failed to view model:', error)
      alert(`Failed to load model: ${error.message}\n\nThis might be a browser compatibility issue. Try re-downloading the model.`)
    }
  }

  const getFilteredProjects = () => {
    if (filter === 'all') return projects
    return projects.filter(p => p.status === filter)
  }

  const getStatusBadge = (status) => {
    const styles = {
      completed: { bg: '#10b981', icon: '✅' },
      processing: { bg: '#3b82f6', icon: '⏳' },
      uploading: { bg: '#f59e0b', icon: '📤' },
      failed: { bg: '#ef4444', icon: '❌' }
    }
    const style = styles[status] || styles.processing
    
    return (
      <span style={{
        background: style.bg,
        color: 'white',
        padding: '4px 10px',
        borderRadius: '12px',
        fontSize: '0.8rem',
        fontWeight: '500',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px'
      }}>
        {style.icon} {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    )
  }

  const filteredProjects = getFilteredProjects()

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2000,
      padding: '20px'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '1200px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
      }}>
        {/* Header */}
        <div style={{
          padding: '24px',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.5rem', color: '#1f2937' }}>
              📦 My Models
            </h2>
            <p style={{ margin: '4px 0 0 0', color: '#6b7280', fontSize: '0.9rem' }}>
              {projects.length} {projects.length === 1 ? 'model' : 'models'} saved locally
              {storageInfo && ` • ${storageInfo.usedGB} GB used`}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '1.5rem',
              cursor: 'pointer',
              padding: '8px',
              borderRadius: '8px',
              transition: 'background 0.2s'
            }}
            onMouseEnter={(e) => e.target.style.background = '#f3f4f6'}
            onMouseLeave={(e) => e.target.style.background = 'transparent'}
          >
            ✕
          </button>
        </div>

        {/* Filters */}
        <div style={{
          padding: '16px 24px',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          gap: '8px'
        }}>
          {['all', 'completed', 'processing', 'failed'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: 'none',
                background: filter === f ? '#667eea' : '#f3f4f6',
                color: filter === f ? 'white' : '#374151',
                cursor: 'pointer',
                fontSize: '0.9rem',
                fontWeight: '500',
                transition: 'all 0.2s'
              }}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
              <span style={{ marginLeft: '6px', opacity: 0.8 }}>
                ({f === 'all' ? projects.length : projects.filter(p => p.status === f).length})
              </span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: '24px'
        }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
              <div style={{ fontSize: '2rem', marginBottom: '12px' }}>⏳</div>
              Loading models...
            </div>
          ) : filteredProjects.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
              <div style={{ fontSize: '3rem', marginBottom: '12px' }}>📦</div>
              <p style={{ fontSize: '1.1rem', marginBottom: '8px' }}>No models found</p>
              <p style={{ fontSize: '0.9rem' }}>
                {filter === 'all' 
                  ? 'Upload some images to create your first 3D model!'
                  : `No ${filter} models yet`}
              </p>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '20px'
            }}>
              {filteredProjects.map(project => (
                <div
                  key={project.id}
                  style={{
                    border: '1px solid #e5e7eb',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    transition: 'all 0.2s',
                    cursor: 'pointer',
                    background: 'white'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)'
                    e.currentTarget.style.transform = 'translateY(-2px)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = 'none'
                    e.currentTarget.style.transform = 'translateY(0)'
                  }}
                >
                  {/* Thumbnail */}
                  <div
                    style={{
                      width: '100%',
                      height: '180px',
                      background: project.thumbnail 
                        ? `url(${URL.createObjectURL(project.thumbnail)}) center/cover`
                        : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontSize: '3rem'
                    }}
                  >
                    {!project.thumbnail && '📸'}
                  </div>

                  {/* Info */}
                  <div style={{ padding: '16px' }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'start',
                      marginBottom: '12px'
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h3 style={{
                          margin: '0 0 4px 0',
                          fontSize: '1rem',
                          color: '#1f2937',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {project.name}
                        </h3>
                        <p style={{
                          margin: 0,
                          fontSize: '0.8rem',
                          color: '#6b7280'
                        }}>
                          {new Date(project.createdAt).toLocaleString('vi-VN')}
                        </p>
                      </div>
                    </div>

                    <div style={{ marginBottom: '12px' }}>
                      {getStatusBadge(project.status)}
                    </div>

                    {project.status === 'processing' && (
                      <div style={{ marginBottom: '12px' }}>
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: '0.8rem',
                          color: '#6b7280',
                          marginBottom: '4px'
                        }}>
                          <span>{project.currentStage || 'Processing...'}</span>
                          <span>{project.progress || 0}%</span>
                        </div>
                        <div style={{
                          width: '100%',
                          height: '6px',
                          background: '#e5e7eb',
                          borderRadius: '3px',
                          overflow: 'hidden'
                        }}>
                          <div style={{
                            width: `${project.progress || 0}%`,
                            height: '100%',
                            background: '#667eea',
                            transition: 'width 0.3s ease'
                          }} />
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div style={{
                      display: 'flex',
                      gap: '8px',
                      marginTop: '12px'
                    }}>
                      {project.status === 'completed' && (
                        <>
                          <button
                            onClick={() => handleView(project)}
                            style={{
                              flex: 1,
                              padding: '8px',
                              borderRadius: '6px',
                              border: 'none',
                              background: '#667eea',
                              color: 'white',
                              fontSize: '0.85rem',
                              fontWeight: '500',
                              cursor: 'pointer'
                            }}
                          >
                            👁️ View
                          </button>
                          {project.formats?.map(format => (
                            <button
                              key={format}
                              onClick={() => handleDownload(project, format)}
                              style={{
                                padding: '8px 12px',
                                borderRadius: '6px',
                                border: '1px solid #d1d5db',
                                background: 'white',
                                color: '#374151',
                                fontSize: '0.85rem',
                                fontWeight: '500',
                                cursor: 'pointer'
                              }}
                              title={`Download ${format.toUpperCase()}`}
                            >
                              {format.toUpperCase()}
                            </button>
                          ))}
                        </>
                      )}
                      <button
                        onClick={() => handleDelete(project.id)}
                        style={{
                          padding: '8px 12px',
                          borderRadius: '6px',
                          border: '1px solid #ef4444',
                          background: 'white',
                          color: '#ef4444',
                          fontSize: '0.85rem',
                          fontWeight: '500',
                          cursor: 'pointer'
                        }}
                        title="Delete"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Note: Viewer now shown in main Workflow component */}
    </div>
  )
}
