import { useState } from 'react'
import Workflow from './components/Workflow'
import UserAvatar from './components/UserAvatar'
import MyModels from './components/MyModels'
import Settings from './components/Settings'
import './App.css'

function App() {
  const [showMyModels, setShowMyModels] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [viewModelUrl, setViewModelUrl] = useState(null)
  const [datasetToBuild, setDatasetToBuild] = useState(null)

  const handleViewModel = (stlUrl) => {
    setViewModelUrl(stlUrl)
    setShowMyModels(false) // Close My Models dialog
    // Scroll to viewer section
    setTimeout(() => {
      const viewer = document.querySelector('.model-viewer')
      if (viewer) {
        viewer.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }, 100)
  }

  const handleBuildDataset = (dataset) => {
    setDatasetToBuild(dataset)
    setShowSettings(false) // Close Settings
    setViewModelUrl(null) // Clear any external model
    // Scroll to top to show upload process
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }, 100)
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <div className="logo">
            <span className="logo-icon">📸</span>
            <h1>HeyPhom</h1>
          </div>
          <p className="subtitle">Photogrammetry Processing on Apple Silicon</p>
          <div style={{ position: 'absolute', top: '20px', right: '20px' }}>
            <UserAvatar 
              onMyModelsClick={() => setShowMyModels(true)} 
              onSettingsClick={() => setShowSettings(true)}
            />
          </div>
        </div>
      </header>

      {showMyModels && (
        <MyModels 
          onClose={() => setShowMyModels(false)} 
          onViewModel={handleViewModel}
        />
      )}

      {showSettings && (
        <Settings 
          onClose={() => setShowSettings(false)} 
          onBuildDataset={handleBuildDataset}
        />
      )}

      <main className="main">
        <Workflow 
          externalModelUrl={viewModelUrl} 
          datasetToBuild={datasetToBuild}
          onDatasetBuildStart={() => setDatasetToBuild(null)}
        />
      </main>

      <footer className="footer">
        <p>
          🍎 Developed by <a href="https://www.ganjingworld.com/@ndmphuc" target="_blank" rel="noreferrer">Nguyễn Đăng Minh Phúc </a> | 
          💾 Port 4444-4445
        </p>
      </footer>
    </div>
  )
}

export default App
