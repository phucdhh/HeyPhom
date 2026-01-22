import { useState, useEffect, useRef } from 'react'
import { getStorageInfo, getAllProjects, cleanupExpiredProjects } from '../db/projects'
import { 
  getAllDatasets, 
  saveDataset, 
  deleteDataset as deleteDatasetFromDB,
  renameDataset as renameDatasetInDB,
  getDataset,
  migrateLocalStorageDatasets
} from '../db/datasets'

export default function Settings({ onClose, onBuildDataset }) {
  const [avatar, setAvatar] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState(null)
  const [storage, setStorage] = useState({ usedGB: 0, quotaGB: 0, percent: 0 })
  const [projects, setProjects] = useState([])
  const [datasets, setDatasets] = useState([])
  const [uploadingDataset, setUploadingDataset] = useState(false)
  const [importSource, setImportSource] = useState('local') // local, github, gdrive
  const [importUrl, setImportUrl] = useState('')
  const [importing, setImporting] = useState(false)
  const [folderSelection, setFolderSelection] = useState(null) // { owner, repo, branch, folders }
  const [formatSelection, setFormatSelection] = useState(null) // { owner, repo, branch, path, formats }
  const [selectedDataset, setSelectedDataset] = useState(null) // Currently selected dataset for actions
  const [renameModal, setRenameModal] = useState(null) // { dataset, newName }
  const [datasetPreview, setDatasetPreview] = useState(null) // Preview images for selected dataset
  const [imageViewer, setImageViewer] = useState(null) // Full-size image viewer
  const fileInputRef = useRef(null)
  const datasetInputRef = useRef(null)

  useEffect(() => {
    loadSettings()
    loadStorageInfo()
    loadProjects()
    loadSavedAvatar()
    loadDatasets()
  }, [])

  const loadSettings = () => {
    // Load any saved settings from localStorage
  }

  const loadDatasets = async () => {
    try {
      // Migrate old localStorage datasets on first load
      await migrateLocalStorageDatasets()
      
      // Load datasets from IndexedDB
      const savedDatasets = await getAllDatasets()
      
      // Generate thumbnails for each dataset
      const datasetsWithThumbnails = await Promise.all(
        savedDatasets.map(async (ds) => {
          if (ds.source === 'local') {
            try {
              const fullDataset = await getDataset(ds.id)
              if (fullDataset?.files && fullDataset.files.length > 0) {
                const firstFile = fullDataset.files[0]
                const thumbnail = await new Promise((resolve) => {
                  const reader = new FileReader()
                  reader.onload = () => resolve(reader.result)
                  reader.onerror = () => resolve(null)
                  reader.readAsDataURL(firstFile)
                })
                return { ...ds, thumbnail }
              }
            } catch (err) {
              console.error('Failed to generate thumbnail:', err)
            }
          } else if (ds.source === 'github') {
            try {
              const fullDataset = await getDataset(ds.id)
              if (fullDataset?.files && fullDataset.files.length > 0) {
                const firstImage = fullDataset.files[0]
                // For GitHub, files are objects with download_url or url
                const imageUrl = firstImage.download_url || firstImage.url
                if (imageUrl) {
                  return { ...ds, thumbnail: imageUrl }
                }
              }
            } catch (err) {
              console.error('Failed to generate GitHub thumbnail:', err)
            }
          } else if (ds.source === 'gdrive') {
            try {
              const fullDataset = await getDataset(ds.id)
              if (fullDataset?.files && fullDataset.files.length > 0) {
                const firstImage = fullDataset.files[0]
                // For GDrive, files are objects with download_url or thumbnail_url
                if (firstImage.thumbnail_url || firstImage.download_url) {
                  return { ...ds, thumbnail: firstImage.thumbnail_url || firstImage.download_url }
                }
              }
            } catch (err) {
              console.error('Failed to generate GDrive thumbnail:', err)
            }
          }
          return ds
        })
      )
      
      setDatasets(datasetsWithThumbnails)
    } catch (error) {
      console.error('Failed to load datasets:', error)
      setDatasets([])
    }
  }

  const loadDatasetPreview = async (dataset) => {
    setDatasetPreview({ loading: true, images: [] })
    
    try {
      if (dataset.source === 'local') {
        // For local datasets, load actual images from IndexedDB
        try {
          const fullDataset = await getDataset(dataset.id)
          if (!fullDataset || !fullDataset.files || fullDataset.files.length === 0) {
            setDatasetPreview({ loading: false, images: [] })
            return
          }
          
          // Convert first 20 File objects to data URLs for preview
          const filesToPreview = fullDataset.files.slice(0, 20)
          const previewPromises = filesToPreview.map(file => {
            return new Promise((resolve) => {
              const reader = new FileReader()
              reader.onload = () => {
                resolve({
                  url: reader.result,
                  name: file.name,
                  size: file.size
                })
              }
              reader.onerror = () => {
                resolve({
                  url: `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Crect fill='%23999' width='200' height='200'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='white' font-size='16'%3EError%3C/text%3E%3C/svg%3E`,
                  name: file.name,
                  size: file.size
                })
              }
              reader.readAsDataURL(file)
            })
          })
          
          const previewImages = await Promise.all(previewPromises)
          setDatasetPreview({ loading: false, images: previewImages })
        } catch (error) {
          console.error('Failed to load local preview:', error)
          setDatasetPreview({ loading: false, images: [] })
        }
      } else if (dataset.source === 'github') {
        // For GitHub datasets, load images from URLs
        try {
          const fullDataset = await getDataset(dataset.id)
          if (!fullDataset || !fullDataset.files || fullDataset.files.length === 0) {
            setDatasetPreview({ loading: false, images: [] })
            return
          }
          
          // Take first 20 images
          const filesToPreview = fullDataset.files.slice(0, 20)
          const previewImages = filesToPreview.map(file => ({
            url: file.download_url || file.url,
            name: file.name,
            size: file.size || 0
          }))
          
          setDatasetPreview({ loading: false, images: previewImages })
        } catch (error) {
          console.error('Failed to load GitHub dataset preview:', error)
          setDatasetPreview({ loading: false, images: [] })
        }
      } else if (dataset.source === 'gdrive') {
        // For Google Drive datasets, load images from URLs
        try {
          const fullDataset = await getDataset(dataset.id)
          if (!fullDataset || !fullDataset.files || fullDataset.files.length === 0) {
            setDatasetPreview({ 
              loading: false, 
              images: [],
              unavailable: true,
              message: 'No files found. Please re-import the Google Drive folder.'
            })
            return
          }
          
          // Take first 20 images
          const filesToPreview = fullDataset.files.slice(0, 20)
          const previewImages = filesToPreview.map(file => ({
            url: file.thumbnail_url || file.download_url,
            name: file.name,
            size: file.size || 0
          }))
          
          setDatasetPreview({ loading: false, images: previewImages })
        } catch (error) {
          console.error('Failed to load GDrive dataset preview:', error)
          setDatasetPreview({ 
            loading: false, 
            images: [],
            unavailable: true,
            message: 'Preview not available. Please ensure folder is publicly accessible.'
          })
        }
      } else {
        // Other sources: Show unavailable message
        setDatasetPreview({ 
          loading: false, 
          images: [],
          unavailable: true,
          message: 'Preview not available for this dataset source.'
        })
      }
    } catch (error) {
      console.error('Failed to load preview:', error)
      setDatasetPreview({ loading: false, images: [] })
    }
  }

  const loadStorageInfo = async () => {
    try {
      const info = await getStorageInfo()
      if (info) {
        setStorage(info)
      }
    } catch (error) {
      console.error('Failed to load storage info:', error)
    }
  }

  const loadProjects = async () => {
    const allProjects = await getAllProjects()
    setProjects(allProjects)
  }

  const loadSavedAvatar = () => {
    const savedAvatar = localStorage.getItem('userAvatar')
    if (savedAvatar) {
      setAvatarPreview(savedAvatar)
    }
  }

  const handleAvatarChange = (e) => {
    const file = e.target.files[0]
    if (!file) return

    if (file.size > 2 * 1024 * 1024) {
      alert('Avatar must be less than 2MB')
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      const dataUrl = event.target.result
      setAvatarPreview(dataUrl)
      localStorage.setItem('userAvatar', dataUrl)
      // Trigger custom event to refresh UserAvatar component
      window.dispatchEvent(new CustomEvent('avatarUpdated', { detail: dataUrl }))
      alert('Avatar updated!')
    }
    reader.readAsDataURL(file)
  }

  const handleGitHubImport = async () => {
    if (!importUrl.trim()) {
      alert('Please enter a GitHub repository URL')
      return
    }

    setImporting(true)
    try {
      // Parse GitHub URL - support both repo root and specific path
      let owner, repo, branch = 'master', path = ''
      
      // Format: https://github.com/owner/repo/tree/branch/path
      const treeMatch = importUrl.match(/github\.com\/([^\/]+)\/([^\/]+)\/tree\/([^\/]+)\/(.+)/)
      if (treeMatch) {
        [, owner, repo, branch, path] = treeMatch
      } else {
        // Format: https://github.com/owner/repo.git or https://github.com/owner/repo
        const repoMatch = importUrl.match(/github\.com\/([^\/]+)\/([^\/]+?)(\.git)?$/)
        if (!repoMatch) {
          throw new Error('Invalid GitHub URL format')
        }
        [, owner, repo] = repoMatch
      }
      
      repo = repo.replace('.git', '')
      
      // Recursive function to scan directories for images
      const scanDirectory = async (dirPath = '') => {
        const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${dirPath}${branch ? `?ref=${branch}` : ''}`
        const response = await fetch(apiUrl)
        
        if (!response.ok) {
          throw new Error(`Failed to fetch: ${response.statusText}`)
        }
        
        const contents = await response.json()
        const folders = []
        const images = []
        
        for (const item of contents) {
          if (item.type === 'dir') {
            folders.push({ name: item.name, path: item.path })
          } else if (item.type === 'file' && /\.(jpg|jpeg|png|gif|webp|heic|heif)$/i.test(item.name)) {
            images.push({
              name: item.name,
              path: item.path,
              url: item.download_url,
              size: item.size,
              extension: item.name.split('.').pop().toLowerCase()
            })
          }
        }
        
        return { folders, images, path: dirPath }
      }
      
      // Start scanning from specified path or root
      const startPath = path || ''
      const rootScan = await scanDirectory(startPath)
      
      // If specific path provided and has images, use it directly
      if (startPath && rootScan.images.length > 0) {
        await confirmAndSaveDataset(owner, repo, branch, startPath, rootScan.images)
        setImporting(false)
        return
      }
      
      // Otherwise, scan all subdirectories to find image folders
      const allFolders = [rootScan]
      const imageFolders = []
      
      if (rootScan.images.length > 0) {
        imageFolders.push(rootScan)
      }
      
      // Scan first level subdirectories
      for (const folder of rootScan.folders) {
        try {
          const folderScan = await scanDirectory(folder.path)
          allFolders.push(folderScan)
          
          if (folderScan.images.length > 0) {
            imageFolders.push(folderScan)
          }
        } catch (err) {
          console.error(`Failed to scan ${folder.path}:`, err)
        }
      }
      
      if (imageFolders.length === 0) {
        alert('❌ No image files found in repository.\n\nTip: Try providing direct path to folder with images:\nhttps://github.com/owner/repo/tree/branch/path')
        setImporting(false)
        return
      }
      
      // Show folder selection dialog
      if (imageFolders.length === 1) {
        await confirmAndSaveDataset(owner, repo, branch, imageFolders[0].path, imageFolders[0].images)
      } else {
        showFolderSelectionDialog(owner, repo, branch, imageFolders)
      }
      
    } catch (error) {
      console.error('GitHub import failed:', error)
      alert(`Failed to import from GitHub: ${error.message}`)
      setImporting(false)
    }
  }
  
  const showFolderSelectionDialog = (owner, repo, branch, imageFolders) => {
    // Group images by extension for each folder
    const folderOptions = imageFolders.map(folder => {
      const byExtension = {}
      folder.images.forEach(img => {
        if (!byExtension[img.extension]) {
          byExtension[img.extension] = []
        }
        byExtension[img.extension].push(img)
      })
      
      return {
        path: folder.path || '(root)',
        fullPath: folder.path,
        images: folder.images,
        byExtension
      }
    })
    
    setFolderSelection({ owner, repo, branch, folders: folderOptions })
    setImporting(false)
  }

  const handleFolderSelect = (folder) => {
    const formats = Object.keys(folder.byExtension)
    
    if (formats.length > 1) {
      // Show format selection
      setFormatSelection({
        owner: folderSelection.owner,
        repo: folderSelection.repo,
        branch: folderSelection.branch,
        path: folder.fullPath,
        folder: folder,
        formats: formats
      })
      setFolderSelection(null)
    } else {
      // Only one format, use it directly
      confirmAndSaveDataset(
        folderSelection.owner,
        folderSelection.repo,
        folderSelection.branch,
        folder.fullPath,
        folder.images
      )
      setFolderSelection(null)
    }
  }

  const handleFormatSelect = (format) => {
    if (format === 'all') {
      confirmAndSaveDataset(
        formatSelection.owner,
        formatSelection.repo,
        formatSelection.branch,
        formatSelection.path,
        formatSelection.folder.images
      )
    } else {
      confirmAndSaveDataset(
        formatSelection.owner,
        formatSelection.repo,
        formatSelection.branch,
        formatSelection.path,
        formatSelection.folder.byExtension[format]
      )
    }
    setFormatSelection(null)
  }
  
  const confirmAndSaveDataset = async (owner, repo, branch, path, images) => {
    const pathDisplay = path || 'root'
    const datasetName = `${repo}/${path.split('/').pop() || 'root'}`
    
    try {
      // Save GitHub dataset to IndexedDB with file metadata
      await saveDataset({
        name: datasetName,
        source: 'github',
        url: `https://github.com/${owner}/${repo}/tree/${branch}/${path}`,
        owner,
        repo,
        branch,
        path,
        // Store metadata at root level for easy access
        metadata: { owner, repo, branch, path }
      }, images) // images array contains GitHub file metadata
      
      await loadDatasets()
      
      setImportUrl('')
      setImporting(false)
      
      const totalMB = (images.reduce((acc, f) => acc + (f.size || 0), 0) / 1024 / 1024).toFixed(2)
      alert(`✅ Dataset "${datasetName}" saved!\n\n📁 Path: ${pathDisplay}\n🖼️ Images: ${images.length}\n💾 Size: ${totalMB} MB\n\n✨ Images will be downloaded when you use this dataset.`)
    } catch (error) {
      console.error('Failed to save GitHub dataset:', error)
      alert(`Failed to save dataset: ${error.message}`)
      setImporting(false)
    }
  }

  const handleGoogleDriveImport = async () => {
    if (!importUrl.trim()) {
      alert('Please enter a Google Drive folder URL')
      return
    }

    setImporting(true)
    try {
      // Extract folder ID from URL
      const match = importUrl.match(/folders\/([a-zA-Z0-9_-]+)/)
      if (!match) {
        throw new Error('Invalid Google Drive folder URL. Use: https://drive.google.com/drive/folders/...')
      }
      
      const folderId = match[1]
      console.log(`📁 Fetching files from Google Drive folder: ${folderId}`)
      
      // Fetch file list from backend
      const response = await fetch(`http://localhost:4444/api/gdrive/list/${folderId}`)
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.message || data.error || 'Failed to fetch folder contents')
      }
      
      if (!data.files || data.files.length === 0) {
        throw new Error('No image files found in this folder')
      }
      
      if (data.files.length < 30) {
        throw new Error(`Folder has only ${data.files.length} images. Need at least 30 for 3D reconstruction.`)
      }
      
      const datasetName = `GDrive: ${folderId.substring(0, 8)}`
      
      // Save to IndexedDB with file metadata
      await saveDataset({
        name: datasetName,
        source: 'gdrive',
        url: importUrl,
        metadata: {
          folderId: folderId
        }
      }, data.files) // Save file metadata with download URLs
      
      // Reload datasets from IndexedDB
      await loadDatasets()
      setImportUrl('')
      
      const totalMB = (data.files.reduce((acc, f) => acc + (f.size || 0), 0) / 1024 / 1024).toFixed(2)
      alert(`✅ Google Drive dataset saved!\n\n📁 Folder ID: ${folderId}\n🖼️ Images: ${data.files.length}\n💾 Size: ${totalMB} MB\n\n✨ Images will be downloaded when you build this dataset.`)
    } catch (error) {
      console.error('Google Drive import failed:', error)
      alert(`Failed to import from Google Drive:\n${error.message}\n\n⚠️ Make sure folder is shared as "Anyone with the link can view"`)
    } finally {
      setImporting(false)
    }
  }

  const handleDatasetUpload = async (e) => {
    const files = Array.from(e.target.files)
    if (files.length === 0) return

    setUploadingDataset(true)
    try {
      // Validate minimum images
      if (files.length < 30) {
        alert(`⚠️ Need at least 30 images for 3D reconstruction. You selected ${files.length} images.`)
        setUploadingDataset(false)
        return
      }

      const datasetName = prompt('Enter dataset name:', `Dataset ${new Date().toLocaleDateString()}`)
      if (!datasetName) {
        setUploadingDataset(false)
        return
      }

      // Save to IndexedDB with actual File objects
      const datasetId = await saveDataset({
        name: datasetName,
        source: 'local'
      }, files)
      
      // Reload datasets list
      await loadDatasets()
      
      alert(`✅ Dataset "${datasetName}" saved with ${files.length} images!`)
    } catch (error) {
      console.error('Failed to save dataset:', error)
      alert(`Failed to save dataset: ${error.message}`)
    } finally {
      setUploadingDataset(false)
      if (datasetInputRef.current) {
        datasetInputRef.current.value = '' // Reset file input
      }
    }
  }

  const handleBuildDataset = async (dataset) => {
    if (!confirm(`Build 3D model from dataset "${dataset.name}"?\n\nThis will:\n• Download images from ${dataset.source === 'github' ? 'GitHub' : dataset.source === 'gdrive' ? 'Google Drive' : dataset.source === 'url' ? 'public URLs' : 'local storage'}\n• Upload to server\n• Start 3D reconstruction\n\nProceed?`)) return

    // For local datasets, load files from IndexedDB first
    if (dataset.source === 'local') {
      try {
        console.log('📦 Loading local dataset files from IndexedDB...')
        const fullDataset = await getDataset(dataset.id)
        
        if (!fullDataset.files || fullDataset.files.length === 0) {
          alert('❌ Dataset has no files. Please re-import the dataset.')
          return
        }
        
        console.log(`✅ Loaded ${fullDataset.files.length} files from IndexedDB`)
        
        // Pass full dataset with files to build callback
        if (onBuildDataset) {
          onBuildDataset(fullDataset)
        }
      } catch (error) {
        console.error('Failed to load dataset files:', error)
        alert(`Failed to load dataset: ${error.message}`)
      }
    } else {
      // For GitHub/URL datasets, pass metadata only
      if (onBuildDataset) {
        onBuildDataset(dataset)
      }
    }
  }

  const handleDeleteDataset = async (datasetId) => {
    const dataset = datasets.find(ds => ds.id === datasetId)
    if (!confirm(`Delete dataset "${dataset.name}"? This cannot be undone.`)) return

    try {
      await deleteDatasetFromDB(datasetId)
      await loadDatasets()
      
      if (selectedDataset?.id === datasetId) {
        setSelectedDataset(null)
      }
    } catch (error) {
      console.error('Failed to delete dataset:', error)
      alert(`Failed to delete dataset: ${error.message}`)
    }
  }

  const handleRenameDataset = (dataset) => {
    setRenameModal({ dataset, newName: dataset.name })
  }

  const confirmRename = async () => {
    if (!renameModal.newName.trim()) return

    try {
      await renameDatasetInDB(renameModal.dataset.id, renameModal.newName)
      await loadDatasets()
      
      if (selectedDataset?.id === renameModal.dataset.id) {
        setSelectedDataset({ ...selectedDataset, name: renameModal.newName })
      }
      setRenameModal(null)
    } catch (error) {
      console.error('Failed to rename dataset:', error)
      alert(`Failed to rename dataset: ${error.message}`)
    }
  }

  const handleDownloadDataset = async (dataset) => {
    if (dataset.source === 'github') {
      alert(`📦 GitHub Dataset: ${dataset.name}\n\n🔗 URL: ${dataset.url}\n📁 Path: ${dataset.path || 'root'}\n🖼️ Images: ${dataset.imageCount}\n💾 Size: ${(dataset.totalSize / 1024 / 1024).toFixed(2)} MB\n\n✨ Images will be downloaded when you use this dataset in a project.`)
    } else if (dataset.source === 'gdrive') {
      alert(`📦 Google Drive Dataset: ${dataset.name}\n\n🔗 URL: ${dataset.url}\n📁 Folder ID: ${dataset.folderId}\n\n⚠️ Setup Google Drive API credentials to download images.`)
    } else {
      alert(`📦 Local Dataset: ${dataset.name}\n\n🖼️ Images: ${dataset.imageCount}\n💾 Size: ${(dataset.totalSize / 1024 / 1024).toFixed(2)} MB\n\n✅ Images are already stored locally.`)
    }
  }

  const handleCleanupExpired = async () => {
    if (!confirm('Remove all expired projects (older than 24h)?')) return

    try {
      const count = await cleanupExpiredProjects()
      alert(`✅ Cleaned up ${count} expired projects`)
      await loadProjects()
      await loadStorageInfo()
    } catch (error) {
      console.error('Cleanup failed:', error)
      alert('Cleanup failed')
    }
  }

  const handleClearAllData = async () => {
    if (!confirm('⚠️ Clear ALL local data? This cannot be undone!')) return
    if (!confirm('Are you absolutely sure? All models and datasets will be deleted!')) return

    try {
      // Clear IndexedDB
      const db = await window.indexedDB.databases()
      for (const database of db) {
        window.indexedDB.deleteDatabase(database.name)
      }

      // Clear localStorage
      localStorage.removeItem('userAvatar')
      localStorage.removeItem('datasets')

      alert('✅ All data cleared')
      window.location.reload()
    } catch (error) {
      console.error('Failed to clear data:', error)
      alert('Failed to clear some data')
    }
  }

  const completedCount = projects.filter(p => p.status === 'completed').length
  const processingCount = projects.filter(p => ['uploading', 'processing'].includes(p.status)).length
  const failedCount = projects.filter(p => p.status === 'failed').length

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
      zIndex: 9999,
      padding: '20px'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '16px',
        maxWidth: '700px',
        width: '100%',
        maxHeight: '90vh',
        overflow: 'auto',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
      }}>
        {/* Header */}
        <div style={{
          padding: '24px',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          borderTopLeftRadius: '16px',
          borderTopRightRadius: '16px'
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '700' }}>⚙️ Settings</h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '14px', opacity: '0.9' }}>
              Manage your profile, storage, and preferences
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.2)',
              border: 'none',
              color: 'white',
              fontSize: '24px',
              cursor: 'pointer',
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '24px' }}>
          {/* Avatar Section */}
          <section style={{ marginBottom: '32px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px', color: '#1f2937' }}>
              👤 Profile Avatar
            </h3>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '20px',
              padding: '20px',
              background: '#f9fafb',
              borderRadius: '12px',
              border: '1px solid #e5e7eb'
            }}>
              <div style={{
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                background: avatarPreview ? `url(${avatarPreview})` : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '36px',
                color: 'white',
                border: '4px solid white',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
              }}>
                {!avatarPreview && '👤'}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ marginBottom: '8px', color: '#6b7280', fontSize: '14px' }}>
                  Upload a custom avatar (max 2MB, JPG/PNG)
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png"
                  onChange={handleAvatarChange}
                  style={{ display: 'none' }}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    padding: '10px 20px',
                    background: '#667eea',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#5568d3'}
                  onMouseLeave={(e) => e.currentTarget.style.background = '#667eea'}
                >
                  Choose Image
                </button>
              </div>
            </div>
          </section>

          {/* Storage Management */}
          <section style={{ marginBottom: '32px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px', color: '#1f2937' }}>
              💾 Storage Management
            </h3>
            <div style={{
              padding: '20px',
              background: '#f9fafb',
              borderRadius: '12px',
              border: '1px solid #e5e7eb'
            }}>
              {/* Storage Stats */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '16px',
                marginBottom: '20px'
              }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '32px', fontWeight: '700', color: '#10b981' }}>
                    {completedCount}
                  </div>
                  <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>
                    Completed
                  </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '32px', fontWeight: '700', color: '#f59e0b' }}>
                    {processingCount}
                  </div>
                  <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>
                    Processing
                  </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '32px', fontWeight: '700', color: '#ef4444' }}>
                    {failedCount}
                  </div>
                  <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>
                    Failed
                  </div>
                </div>
              </div>

              {/* Storage Bar */}
              <div>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '14px',
                  color: '#6b7280',
                  marginBottom: '8px'
                }}>
                  <span>Storage Used</span>
                  <span>
                    {storage?.usedGB ? `${(storage.usedGB * 1024).toFixed(1)} MB` : '0 MB'} / {storage?.quotaGB?.toFixed(0) || '0'} GB ({storage?.percent?.toFixed(1) || '0.0'}%)
                  </span>
                </div>
                <div style={{
                  height: '12px',
                  background: '#e5e7eb',
                  borderRadius: '6px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    height: '100%',
                    width: `${Math.min(storage?.percent || 0, 100)}%`,
                    background: (storage?.percent || 0) > 80 ? '#ef4444' : (storage?.percent || 0) > 50 ? '#f59e0b' : '#10b981',
                    transition: 'width 0.3s ease'
                  }} />
                </div>
              </div>

              {/* Actions */}
              <div style={{
                display: 'flex',
                gap: '12px',
                marginTop: '20px'
              }}>
                <button
                  onClick={handleCleanupExpired}
                  style={{
                    flex: 1,
                    padding: '12px',
                    background: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#2563eb'}
                  onMouseLeave={(e) => e.currentTarget.style.background = '#3b82f6'}
                >
                  🧹 Cleanup Expired
                </button>
                <button
                  onClick={handleClearAllData}
                  style={{
                    flex: 1,
                    padding: '12px',
                    background: '#ef4444',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#dc2626'}
                  onMouseLeave={(e) => e.currentTarget.style.background = '#ef4444'}
                >
                  🗑️ Clear All Data
                </button>
              </div>
            </div>
          </section>

          {/* Dataset Pre-loading */}
          <section>
            <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px', color: '#1f2937' }}>
              📦 Dataset Management
            </h3>
            <div style={{
              padding: '20px',
              background: '#f9fafb',
              borderRadius: '12px',
              border: '1px solid #e5e7eb'
            }}>
              <p style={{ marginBottom: '16px', color: '#6b7280', fontSize: '14px' }}>
                Pre-load image datasets from multiple sources for faster processing later
              </p>
              
              {/* Source Selection Tabs */}
              <div style={{
                display: 'flex',
                gap: '8px',
                marginBottom: '16px',
                borderBottom: '2px solid #e5e7eb',
                paddingBottom: '8px'
              }}>
                <button
                  onClick={() => setImportSource('local')}
                  style={{
                    padding: '8px 16px',
                    background: importSource === 'local' ? '#667eea' : 'transparent',
                    color: importSource === 'local' ? 'white' : '#6b7280',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: '500',
                    transition: 'all 0.2s'
                  }}
                >
                  💻 Local Files
                </button>
                <button
                  onClick={() => setImportSource('github')}
                  style={{
                    padding: '8px 16px',
                    background: importSource === 'github' ? '#667eea' : 'transparent',
                    color: importSource === 'github' ? 'white' : '#6b7280',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: '500',
                    transition: 'all 0.2s'
                  }}
                >
                  🐙 GitHub
                </button>
                <button
                  onClick={() => setImportSource('gdrive')}
                  style={{
                    padding: '8px 16px',
                    background: importSource === 'gdrive' ? '#667eea' : 'transparent',
                    color: importSource === 'gdrive' ? 'white' : '#6b7280',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: '500',
                    transition: 'all 0.2s'
                  }}
                >
                  📁 Google Drive
                </button>
              </div>

              {/* Local Files Upload */}
              {importSource === 'local' && (
                <>
                  <input
                    ref={datasetInputRef}
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleDatasetUpload}
                    style={{ display: 'none' }}
                  />
                  <button
                    onClick={() => datasetInputRef.current?.click()}
                    disabled={uploadingDataset}
                    style={{
                      padding: '12px 24px',
                      background: uploadingDataset ? '#9ca3af' : '#10b981',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: uploadingDataset ? 'not-allowed' : 'pointer',
                      fontSize: '14px',
                      fontWeight: '500',
                      transition: 'background 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                    onMouseEnter={(e) => !uploadingDataset && (e.currentTarget.style.background = '#059669')}
                    onMouseLeave={(e) => !uploadingDataset && (e.currentTarget.style.background = '#10b981')}
                  >
                    {uploadingDataset ? '⏳ Uploading...' : '📤 Upload Local Files'}
                  </button>
                </>
              )}

              {/* GitHub Import */}
              {importSource === 'github' && (
                <div>
                  <input
                    type="text"
                    placeholder="https://github.com/owner/repo.git"
                    value={importUrl}
                    onChange={(e) => setImportUrl(e.target.value)}
                    disabled={importing}
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '14px',
                      marginBottom: '12px',
                      boxSizing: 'border-box'
                    }}
                  />
                  <button
                    onClick={handleGitHubImport}
                    disabled={importing || !importUrl.trim()}
                    style={{
                      padding: '12px 24px',
                      background: (importing || !importUrl.trim()) ? '#9ca3af' : '#6366f1',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: (importing || !importUrl.trim()) ? 'not-allowed' : 'pointer',
                      fontSize: '14px',
                      fontWeight: '500',
                      transition: 'background 0.2s'
                    }}
                    onMouseEnter={(e) => !(importing || !importUrl.trim()) && (e.currentTarget.style.background = '#4f46e5')}
                    onMouseLeave={(e) => !(importing || !importUrl.trim()) && (e.currentTarget.style.background = '#6366f1')}
                  >
                    {importing ? '⏳ Importing...' : '🐙 Import from GitHub'}
                  </button>
                  <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '8px' }}>
                    💡 Example: https://github.com/BritishMuseumDH/alexanderTheGreat.git
                  </p>
                </div>
              )}

              {/* Google Drive Import */}
              {importSource === 'gdrive' && (
                <div>
                  <input
                    type="text"
                    placeholder="https://drive.google.com/drive/folders/..."
                    value={importUrl}
                    onChange={(e) => setImportUrl(e.target.value)}
                    disabled={importing}
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '14px',
                      marginBottom: '12px',
                      boxSizing: 'border-box'
                    }}
                  />
                  <button
                    onClick={handleGoogleDriveImport}
                    disabled={importing || !importUrl.trim()}
                    style={{
                      padding: '12px 24px',
                      background: (importing || !importUrl.trim()) ? '#9ca3af' : '#ea4335',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: (importing || !importUrl.trim()) ? 'not-allowed' : 'pointer',
                      fontSize: '14px',
                      fontWeight: '500',
                      transition: 'background 0.2s'
                    }}
                    onMouseEnter={(e) => !(importing || !importUrl.trim()) && (e.currentTarget.style.background = '#d33426')}
                    onMouseLeave={(e) => !(importing || !importUrl.trim()) && (e.currentTarget.style.background = '#ea4335')}
                  >
                    {importing ? '⏳ Importing...' : '📁 Import from Google Drive'}
                  </button>
                  <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '8px' }}>
                    ⚠️ Folder must be publicly accessible or require API setup
                  </p>
                </div>
              )}

              {/* Saved Datasets - Finder Style */}
              {datasets.length > 0 && (
                <div style={{ marginTop: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#1f2937' }}>
                      Saved Datasets ({datasets.length})
                    </h4>
                    {selectedDataset && (
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => handleBuildDataset(selectedDataset)}
                          style={{
                            padding: '6px 12px',
                            background: '#10b981',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: '500'
                          }}
                        >
                          🚀 Build
                        </button>
                        <button
                          onClick={() => handleDownloadDataset(selectedDataset)}
                          style={{
                            padding: '6px 12px',
                            background: '#3b82f6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: '500'
                          }}
                        >
                          📥 Download
                        </button>
                        <button
                          onClick={() => handleRenameDataset(selectedDataset)}
                          style={{
                            padding: '6px 12px',
                            background: '#8b5cf6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: '500'
                          }}
                        >
                          ✏️ Rename
                        </button>
                        <button
                          onClick={() => handleDeleteDataset(selectedDataset.id)}
                          style={{
                            padding: '6px 12px',
                            background: '#ef4444',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: '500'
                          }}
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    )}
                  </div>
                  
                  {/* Grid View - Finder Style */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                    gap: '16px',
                    padding: '16px',
                    background: 'white',
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb'
                  }}>
                    {datasets.map(ds => {
                      const isSelected = selectedDataset?.id === ds.id
                      const getSourceIcon = () => {
                        if (ds.source === 'github') return '🐙'
                        if (ds.source === 'gdrive') return '📁'
                        return '💻'
                      }
                      
                      return (
                        <div
                          key={ds.id}
                          onClick={() => {
                            setSelectedDataset(ds)
                            loadDatasetPreview(ds)
                          }}
                          style={{
                            cursor: 'pointer',
                            padding: '12px',
                            borderRadius: '8px',
                            background: isSelected ? '#eff6ff' : 'transparent',
                            border: isSelected ? '2px solid #3b82f6' : '2px solid transparent',
                            transition: 'all 0.2s',
                            textAlign: 'center'
                          }}
                          onMouseEnter={(e) => {
                            if (!isSelected) {
                              e.currentTarget.style.background = '#f9fafb'
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!isSelected) {
                              e.currentTarget.style.background = 'transparent'
                            }
                          }}
                        >
                          {/* Thumbnail with source icon */}
                          <div style={{
                            width: '100%',
                            height: '100px',
                            borderRadius: '6px',
                            background: ds.thumbnail 
                              ? `url(${ds.thumbnail})`
                              : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginBottom: '8px',
                            position: 'relative',
                            overflow: 'hidden'
                          }}>
                            {/* Fallback icon if no thumbnail */}
                            {!ds.thumbnail && (
                              <div style={{
                                fontSize: '48px',
                                opacity: 0.3
                              }}>
                                {getSourceIcon()}
                              </div>
                            )}
                            
                            {/* Source icon badge - top right */}
                            <div style={{
                              position: 'absolute',
                              top: '6px',
                              right: '6px',
                              background: 'rgba(0,0,0,0.7)',
                              color: 'white',
                              padding: '4px 8px',
                              borderRadius: '12px',
                              fontSize: '16px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}>
                              {getSourceIcon()}
                            </div>
                            
                            {/* Image count badge - top left */}
                            {(ds.imageCount > 0 || ds.source !== 'gdrive') && (
                              <div style={{
                                position: 'absolute',
                                top: '6px',
                                left: '6px',
                                background: 'rgba(0,0,0,0.7)',
                                color: 'white',
                                padding: '2px 8px',
                                borderRadius: '12px',
                                fontSize: '11px',
                                fontWeight: '600'
                              }}>
                                {ds.source === 'gdrive' && ds.imageCount === 0 
                                  ? '? 🖼️' 
                                  : `${ds.imageCount} 🖼️`}
                              </div>
                            )}
                          </div>
                          
                          {/* Dataset Name */}
                          <div style={{
                            fontSize: '13px',
                            fontWeight: '500',
                            color: '#1f2937',
                            marginBottom: '4px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}>
                            {ds.name}
                          </div>
                          
                          {/* Size and Date */}
                          <div style={{
                            fontSize: '11px',
                            color: '#9ca3af'
                          }}>
                            {(ds.totalSize / 1024 / 1024).toFixed(2)} MB
                          </div>
                          <div style={{
                            fontSize: '10px',
                            color: '#d1d5db',
                            marginTop: '2px'
                          }}>
                            {new Date(ds.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Dataset Preview Panel - Finder Style */}
                  {selectedDataset && datasetPreview && (
                    <div style={{
                      marginTop: '16px',
                      padding: '16px',
                      background: 'white',
                      borderRadius: '8px',
                      border: '1px solid #e5e7eb'
                    }}>
                      <h5 style={{
                        fontSize: '13px',
                        fontWeight: '600',
                        color: '#1f2937',
                        marginBottom: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        🖼️ Preview: {selectedDataset.name}
                        {datasetPreview.loading && <span style={{ fontSize: '11px', color: '#6b7280' }}>(Loading...)</span>}
                      </h5>

                      {datasetPreview.loading ? (
                        <div style={{
                          display: 'flex',
                          justifyContent: 'center',
                          alignItems: 'center',
                          padding: '40px',
                          color: '#9ca3af'
                        }}>
                          ⏳ Loading images...
                        </div>
                      ) : datasetPreview.unavailable ? (
                        <div style={{
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'center',
                          alignItems: 'center',
                          padding: '40px',
                          color: '#9ca3af',
                          textAlign: 'center',
                          gap: '12px'
                        }}>
                          <div style={{ fontSize: '48px' }}>🚫</div>
                          <div style={{ fontSize: '14px', fontWeight: '500' }}>No preview available</div>
                          <div style={{ fontSize: '12px', maxWidth: '300px' }}>
                            {datasetPreview.message}
                          </div>
                        </div>
                      ) : datasetPreview.images.length === 0 ? (
                        <div style={{
                          display: 'flex',
                          justifyContent: 'center',
                          alignItems: 'center',
                          padding: '40px',
                          color: '#9ca3af'
                        }}>
                          No images found
                        </div>
                      ) : (
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
                          gap: '8px',
                          maxHeight: '400px',
                          overflowY: 'auto'
                        }}>
                          {datasetPreview.images.map((img, idx) => (
                            <div
                              key={idx}
                              onClick={() => setImageViewer(img)}
                              style={{
                                cursor: 'pointer',
                                aspectRatio: '1',
                                borderRadius: '6px',
                                overflow: 'hidden',
                                border: '1px solid #e5e7eb',
                                transition: 'transform 0.2s, box-shadow 0.2s'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'scale(1.05)'
                                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)'
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'scale(1)'
                                e.currentTarget.style.boxShadow = 'none'
                              }}
                            >
                              <img
                                src={img.url}
                                alt={img.name}
                                crossOrigin="anonymous"
                                style={{
                                  width: '100%',
                                  height: '100%',
                                  objectFit: 'cover'
                                }}
                                onError={(e) => {
                                  e.target.style.background = '#f3f4f6'
                                  e.target.alt = '⚠️'
                                }}
                              />
                            </div>
                          ))}
                        </div>
                      )}

                      <div style={{
                        marginTop: '12px',
                        fontSize: '11px',
                        color: '#6b7280',
                        textAlign: 'center'
                      }}>
                        {datasetPreview.images.length > 0 && `Showing ${datasetPreview.images.length} of ${selectedDataset.imageCount} images`}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* Info Footer */}
          <div style={{
            marginTop: '24px',
            padding: '16px',
            background: '#fef3c7',
            border: '1px solid #fcd34d',
            borderRadius: '12px',
            fontSize: '13px',
            color: '#92400e'
          }}>
            <strong>ℹ️ Note:</strong> Models expire from server after 24 hours but remain accessible in your browser's local storage indefinitely.
          </div>
        </div>
      </div>

      {/* Folder Selection Modal */}
      {folderSelection && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          padding: '20px'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '16px',
            maxWidth: '600px',
            width: '100%',
            maxHeight: '80vh',
            overflow: 'auto',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
          }}>
            {/* Header */}
            <div style={{
              padding: '24px',
              borderBottom: '1px solid #e5e7eb',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              borderTopLeftRadius: '16px',
              borderTopRightRadius: '16px'
            }}>
              <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '700' }}>
                📂 Select Dataset Folder
              </h3>
              <p style={{ margin: '8px 0 0 0', fontSize: '14px', opacity: '0.9' }}>
                Found {folderSelection.folders.length} folders with images
              </p>
            </div>

            {/* Folder List */}
            <div style={{ padding: '24px' }}>
              {folderSelection.folders.map((folder, idx) => (
                <div
                  key={idx}
                  onClick={() => handleFolderSelect(folder)}
                  style={{
                    padding: '16px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '12px',
                    marginBottom: '12px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    background: 'white'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#667eea'
                    e.currentTarget.style.background = '#f0f4ff'
                    e.currentTarget.style.transform = 'translateY(-2px)'
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.2)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#e5e7eb'
                    e.currentTarget.style.background = 'white'
                    e.currentTarget.style.transform = 'translateY(0)'
                    e.currentTarget.style.boxShadow = 'none'
                  }}
                >
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: '8px'
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '16px', fontWeight: '600', color: '#1f2937', marginBottom: '8px' }}>
                        📁 {folder.path}
                      </div>
                      <div style={{ fontSize: '13px', color: '#6b7280' }}>
                        {Object.entries(folder.byExtension).map(([ext, imgs]) => (
                          <div key={ext} style={{ marginBottom: '4px' }}>
                            • {imgs.length} {ext.toUpperCase()} files
                          </div>
                        ))}
                      </div>
                    </div>
                    <div style={{
                      padding: '6px 12px',
                      background: '#667eea',
                      color: 'white',
                      borderRadius: '6px',
                      fontSize: '13px',
                      fontWeight: '600'
                    }}>
                      {folder.images.length} images
                    </div>
                  </div>
                  <div style={{
                    fontSize: '12px',
                    color: '#9ca3af',
                    marginTop: '8px'
                  }}>
                    Click to select this folder
                  </div>
                </div>
              ))}
            </div>

            {/* Cancel Button */}
            <div style={{
              padding: '16px 24px',
              borderTop: '1px solid #e5e7eb',
              display: 'flex',
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={() => setFolderSelection(null)}
                style={{
                  padding: '10px 24px',
                  background: '#e5e7eb',
                  color: '#374151',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#d1d5db'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#e5e7eb'}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Format Selection Modal */}
      {formatSelection && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          padding: '20px'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '16px',
            maxWidth: '500px',
            width: '100%',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
          }}>
            {/* Header */}
            <div style={{
              padding: '24px',
              borderBottom: '1px solid #e5e7eb',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              borderTopLeftRadius: '16px',
              borderTopRightRadius: '16px'
            }}>
              <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '700' }}>
                🎨 Select Image Format
              </h3>
              <p style={{ margin: '8px 0 0 0', fontSize: '14px', opacity: '0.9' }}>
                Multiple formats found in this folder
              </p>
            </div>

            {/* Format List */}
            <div style={{ padding: '24px' }}>
              {formatSelection.formats.map((format) => {
                const count = formatSelection.folder.byExtension[format].length
                return (
                  <div
                    key={format}
                    onClick={() => handleFormatSelect(format)}
                    style={{
                      padding: '16px',
                      border: '2px solid #e5e7eb',
                      borderRadius: '12px',
                      marginBottom: '12px',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      background: 'white',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#667eea'
                      e.currentTarget.style.background = '#f0f4ff'
                      e.currentTarget.style.transform = 'translateY(-2px)'
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.2)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '#e5e7eb'
                      e.currentTarget.style.background = 'white'
                      e.currentTarget.style.transform = 'translateY(0)'
                      e.currentTarget.style.boxShadow = 'none'
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '16px', fontWeight: '600', color: '#1f2937' }}>
                        {format.toUpperCase()}
                      </div>
                      <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>
                        {count} files
                      </div>
                    </div>
                    <div style={{
                      padding: '6px 12px',
                      background: '#667eea',
                      color: 'white',
                      borderRadius: '6px',
                      fontSize: '13px',
                      fontWeight: '600'
                    }}>
                      Select
                    </div>
                  </div>
                )
              })}

              {/* All Formats Option */}
              <div
                onClick={() => handleFormatSelect('all')}
                style={{
                  padding: '16px',
                  border: '2px solid #10b981',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  background: 'white',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#059669'
                  e.currentTarget.style.background = '#f0fdf4'
                  e.currentTarget.style.transform = 'translateY(-2px)'
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.2)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#10b981'
                  e.currentTarget.style.background = 'white'
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              >
                <div>
                  <div style={{ fontSize: '16px', fontWeight: '600', color: '#10b981' }}>
                    All Formats
                  </div>
                  <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>
                    {formatSelection.folder.images.length} total files
                  </div>
                </div>
                <div style={{
                  padding: '6px 12px',
                  background: '#10b981',
                  color: 'white',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: '600'
                }}>
                  Select All
                </div>
              </div>
            </div>

            {/* Cancel Button */}
            <div style={{
              padding: '16px 24px',
              borderTop: '1px solid #e5e7eb',
              display: 'flex',
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={() => setFormatSelection(null)}
                style={{
                  padding: '10px 24px',
                  background: '#e5e7eb',
                  color: '#374151',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#d1d5db'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#e5e7eb'}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename Dataset Modal */}
      {renameModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10001,
          padding: '20px'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '16px',
            maxWidth: '500px',
            width: '100%',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
            overflow: 'hidden'
          }}>
            {/* Header */}
            <div style={{
              background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
              padding: '20px 24px',
              color: 'white'
            }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>
                ✏️ Rename Dataset
              </h3>
              <p style={{ margin: '4px 0 0', fontSize: '13px', opacity: 0.9 }}>
                Enter a new name for your dataset
              </p>
            </div>

            {/* Content */}
            <div style={{ padding: '24px' }}>
              <label style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '8px'
              }}>
                Dataset Name
              </label>
              <input
                type="text"
                value={renameModal.newName}
                onChange={(e) => setRenameModal({ ...renameModal, newName: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && renameModal.newName.trim()) {
                    confirmRename()
                  } else if (e.key === 'Escape') {
                    setRenameModal(null)
                  }
                }}
                autoFocus
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '14px',
                  outline: 'none',
                  transition: 'border-color 0.2s'
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = '#8b5cf6'}
                onBlur={(e) => e.currentTarget.style.borderColor = '#e5e7eb'}
              />
            </div>

            {/* Actions */}
            <div style={{
              padding: '16px 24px',
              borderTop: '1px solid #e5e7eb',
              display: 'flex',
              gap: '12px',
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={() => setRenameModal(null)}
                style={{
                  padding: '10px 20px',
                  background: '#e5e7eb',
                  color: '#374151',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#d1d5db'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#e5e7eb'}
              >
                Cancel
              </button>
              <button
                onClick={confirmRename}
                disabled={!renameModal.newName.trim()}
                style={{
                  padding: '10px 20px',
                  background: renameModal.newName.trim() ? '#8b5cf6' : '#d1d5db',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: renameModal.newName.trim() ? 'pointer' : 'not-allowed',
                  fontSize: '14px',
                  fontWeight: '500',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={(e) => renameModal.newName.trim() && (e.currentTarget.style.background = '#7c3aed')}
                onMouseLeave={(e) => renameModal.newName.trim() && (e.currentTarget.style.background = '#8b5cf6')}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full-size Image Viewer */}
      {imageViewer && (
        <div
          onClick={() => setImageViewer(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10002,
            padding: '20px',
            cursor: 'zoom-out'
          }}
        >
          <div style={{
            position: 'relative',
            maxWidth: '90vw',
            maxHeight: '90vh'
          }}>
            <img
              src={imageViewer.url}
              alt={imageViewer.name}
              style={{
                maxWidth: '100%',
                maxHeight: '90vh',
                objectFit: 'contain',
                borderRadius: '8px'
              }}
            />
            <div style={{
              position: 'absolute',
              bottom: '-40px',
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'rgba(0, 0, 0, 0.7)',
              color: 'white',
              padding: '8px 16px',
              borderRadius: '20px',
              fontSize: '12px',
              whiteSpace: 'nowrap'
            }}>
              {imageViewer.name}
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation()
                setImageViewer(null)
              }}
              style={{
                position: 'absolute',
                top: '-40px',
                right: '0',
                background: 'rgba(255, 255, 255, 0.2)',
                color: 'white',
                border: 'none',
                borderRadius: '50%',
                width: '36px',
                height: '36px',
                cursor: 'pointer',
                fontSize: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'}
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
