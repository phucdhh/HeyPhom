import { useState, useRef, useEffect } from 'react'
import { getAllProjects, getStorageInfo } from '../db/projects'

export default function UserAvatar({ onMyModelsClick, onSettingsClick }) {
  const [isOpen, setIsOpen] = useState(false)
  const [projectCount, setProjectCount] = useState(0)
  const [storageInfo, setStorageInfo] = useState(null)
  const [avatarUrl, setAvatarUrl] = useState(null)
  const dropdownRef = useRef(null)

  // Load stats on mount
  useEffect(() => {
    loadStats()
    loadAvatar()
  }, [])

  // Listen for avatar updates
  useEffect(() => {
    const handleAvatarUpdate = (event) => {
      setAvatarUrl(event.detail)
    }
    window.addEventListener('avatarUpdated', handleAvatarUpdate)
    return () => window.removeEventListener('avatarUpdated', handleAvatarUpdate)
  }, [])

  const loadAvatar = () => {
    const savedAvatar = localStorage.getItem('userAvatar')
    if (savedAvatar) {
      setAvatarUrl(savedAvatar)
    }
  }

  const loadStats = async () => {
    try {
      const projects = await getAllProjects()
      setProjectCount(projects.length)
      
      const storage = await getStorageInfo()
      setStorageInfo(storage)
    } catch (error) {
      console.error('Failed to load stats:', error)
    }
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleMyModels = () => {
    setIsOpen(false)
    if (onMyModelsClick) {
      onMyModelsClick()
    }
  }

  const handleSettings = () => {
    setIsOpen(false)
    if (onSettingsClick) {
      onSettingsClick()
    }
  }

  return (
    <div style={{ position: 'relative' }} ref={dropdownRef}>
      {/* Avatar Button */}
      <button
        onClick={() => {
          setIsOpen(!isOpen)
          loadStats() // Refresh stats when opening
        }}
        style={{
          width: '44px',
          height: '44px',
          borderRadius: '50%',
          border: '2px solid #667eea',
          background: avatarUrl ? 'transparent' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          fontSize: '1.2rem',
          fontWeight: 'bold',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.2s ease',
          boxShadow: '0 2px 8px rgba(102, 126, 234, 0.3)',
          position: 'relative',
          overflow: 'hidden',
          padding: 0
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.05)'
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)'
          e.currentTarget.style.boxShadow = '0 2px 8px rgba(102, 126, 234, 0.3)'
        }}
        title="My Account"
      >
        {avatarUrl ? (
          <img 
            src={avatarUrl} 
            alt="Avatar" 
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              borderRadius: '50%'
            }}
          />
        ) : (
          '👤'
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '52px',
          right: '0',
          background: 'white',
          borderRadius: '12px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
          minWidth: '280px',
          zIndex: 1000,
          overflow: 'hidden',
          border: '1px solid #e5e7eb'
        }}>
          {/* User Info */}
          <div style={{
            padding: '16px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                background: avatarUrl ? 'transparent' : 'rgba(255, 255, 255, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.5rem',
                border: '2px solid rgba(255, 255, 255, 0.3)',
                overflow: 'hidden'
              }}>
                {avatarUrl ? (
                  <img 
                    src={avatarUrl} 
                    alt="Avatar" 
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover'
                    }}
                  />
                ) : (
                  '👤'
                )}
              </div>
              <div>
                <div style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '4px' }}>
                  Local User
                </div>
                <div style={{ fontSize: '0.85rem', opacity: 0.9 }}>
                  {projectCount} {projectCount === 1 ? 'model' : 'models'}
                </div>
              </div>
            </div>
          </div>

          {/* Storage Info */}
          {storageInfo && (
            <div style={{
              padding: '12px 16px',
              background: '#f9fafb',
              borderBottom: '1px solid #e5e7eb',
              fontSize: '0.85rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#6b7280' }}>Storage Used</span>
                <span style={{ fontWeight: '600', color: '#374151' }}>
                  {storageInfo.usedGB ? `${(storageInfo.usedGB * 1024).toFixed(1)} MB` : '0 MB'} / {storageInfo.quotaGB ? storageInfo.quotaGB.toFixed(0) : '0'} GB
                </span>
              </div>
              <div style={{
                width: '100%',
                height: '6px',
                background: '#e5e7eb',
                borderRadius: '3px',
                overflow: 'hidden'
              }}>
                <div style={{
                  width: `${storageInfo.percent || 0}%`,
                  height: '100%',
                  background: (storageInfo.percent || 0) > 80 
                    ? '#ef4444' 
                    : (storageInfo.percent || 0) > 60 
                      ? '#f59e0b' 
                      : '#667eea',
                  transition: 'width 0.3s ease'
                }} />
              </div>
            </div>
          )}

          {/* Menu Items */}
          <div style={{ padding: '8px 0' }}>
            <button
              onClick={handleMyModels}
              style={{
                width: '100%',
                padding: '12px 16px',
                border: 'none',
                background: 'transparent',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                cursor: 'pointer',
                fontSize: '0.95rem',
                color: '#374151',
                transition: 'background 0.15s ease'
              }}
              onMouseEnter={(e) => e.target.style.background = '#f3f4f6'}
              onMouseLeave={(e) => e.target.style.background = 'transparent'}
            >
              <span style={{ fontSize: '1.2rem' }}>📦</span>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: '500' }}>My Models</div>
                <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                  View all saved models
                </div>
              </div>
            </button>

            <button
              onClick={handleSettings}
              style={{
                width: '100%',
                padding: '12px 16px',
                border: 'none',
                background: 'transparent',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                cursor: 'pointer',
                fontSize: '0.95rem',
                color: '#374151',
                transition: 'background 0.15s ease'
              }}
              onMouseEnter={(e) => e.target.style.background = '#f3f4f6'}
              onMouseLeave={(e) => e.target.style.background = 'transparent'}
            >
              <span style={{ fontSize: '1.2rem' }}>⚙️</span>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: '500' }}>Settings</div>
                <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                  Manage storage & preferences
                </div>
              </div>
            </button>

            <div style={{
              height: '1px',
              background: '#e5e7eb',
              margin: '8px 0'
            }} />

            <button
              onClick={() => {
                window.open('https://www.ganjingworld.com/@ndmphuc', '_blank')
                setIsOpen(false)
              }}
              style={{
                width: '100%',
                padding: '12px 16px',
                border: 'none',
                background: 'transparent',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                cursor: 'pointer',
                fontSize: '0.95rem',
                color: '#374151',
                transition: 'background 0.15s ease'
              }}
              onMouseEnter={(e) => e.target.style.background = '#f3f4f6'}
              onMouseLeave={(e) => e.target.style.background = 'transparent'}
            >
              <span style={{ fontSize: '1.2rem' }}>ℹ️</span>
              <span style={{ fontWeight: '500' }}>About Developer</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
