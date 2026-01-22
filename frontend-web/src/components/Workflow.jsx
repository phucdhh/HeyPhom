import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import { uploadInChunks } from '../utils/chunkedUpload'
import { getUserId } from '../utils/userIdManager'
import STLViewer from './STLViewer'
import './Workflow.css'

// IndexedDB operations
import {
  createProject,
  updateProject,
  updateProgress as updateDBProgress,
  completeProject,
  failProject,
  cleanupExpiredProjects
} from '../db/projects'
import { getDataset } from '../db/datasets'
import { downloadModelFiles, createThumbnail } from '../db/fileUtils'

// Processing stages with descriptions
const STAGES = [
  { id: 'upload', icon: '📤', title: 'Upload Images', description: 'Select and upload your images' },
  { id: 'processing', icon: '⚙️', title: 'Processing', description: 'Creating 3D model from images' },
  { id: 'complete', icon: '✅', title: 'Complete', description: 'Download your models' }
]

const PROCESSING_SUBSTAGES = [
  { key: 'preprocess', label: 'Preprocessing', icon: '🔍' },
  { key: 'feature', label: 'Feature Detection', icon: '🎯' },
  { key: 'matching', label: 'Feature Matching', icon: '🔗' },
  { key: 'reconstruction', label: '3D Reconstruction', icon: '📐' },
  { key: 'meshing', label: 'Mesh Generation', icon: '🧊' },
  { key: 'texturing', label: 'Texture Mapping', icon: '🎨' },
  { key: 'export', label: 'Exporting', icon: '💾' },
  { key: 'extracting', label: 'Extracting Formats', icon: '📦' }
]

function Workflow({ externalModelUrl, datasetToBuild, onDatasetBuildStart }) {
  // User ID state
  const [userId, setUserId] = useState(null)
  
  // Workflow state
  const [currentStage, setCurrentStage] = useState('upload') // upload, processing, complete
  const [sessionId, setSessionId] = useState(null)
  
  // Upload state
  const [files, setFiles] = useState([])
  const [quality, setQuality] = useState('high')
  const [formats, setFormats] = useState(['usdz', 'obj', 'stl'])
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadStatus, setUploadStatus] = useState('') // New: upload status text
  
  // Processing state
  const [progress, setProgress] = useState(0)
  const [jobStatus, setJobStatus] = useState('') // Track job status: downloading, processing, completed
  const [currentSubstage, setCurrentSubstage] = useState('')
  const [processingDetails, setProcessingDetails] = useState(null)
  const [isInitializing, setIsInitializing] = useState(false)
  
  // Timer state
  const [startTime, setStartTime] = useState(null)
  const [elapsedTime, setElapsedTime] = useState(0)
  
  // Result state
  const [results, setResults] = useState(null)
  const [error, setError] = useState(null)
  
  // WebSocket
  const wsRef = useRef(null)
  const reconnectTimerRef = useRef(null)
  const pollIntervalRef = useRef(null)
  const timerIntervalRef = useRef(null)
  
  // Initialize user ID on mount
  useEffect(() => {
    const initUserId = async () => {
      try {
        const id = await getUserId()
        setUserId(id)
        console.log('✅ User ID initialized:', id)
      } catch (err) {
        console.error('❌ Failed to initialize user ID:', err)
        // Use fallback user ID
        setUserId('default')
      }
    }
    initUserId()
  }, [])
  
  // Cleanup expired projects on mount
  useEffect(() => {
    const cleanup = async () => {
      try {
        const cleaned = await cleanupExpiredProjects()
        if (cleaned > 0) {
          console.log(`🧹 Cleaned up ${cleaned} expired projects from IndexedDB`)
        }
      } catch (error) {
        console.error('❌ Failed to cleanup expired projects:', error)
      }
    }
    cleanup()
  }, [])

  // Handle dataset build trigger
  useEffect(() => {
    if (datasetToBuild) {
      handleDatasetBuild(datasetToBuild)
      if (onDatasetBuildStart) {
        onDatasetBuildStart()
      }
    }
  }, [datasetToBuild])

  const handleDatasetBuild = async (dataset) => {
    console.log('🚀 Starting dataset build:', dataset)
    
    // Reset workflow to initial state for new build
    setCurrentStage('upload')
    setSessionId(null)
    setResults(null)
    setError(null)
    setProgress(0)
    setCurrentSubstage('')
    setElapsedTime(0)
    setStartTime(null)
    
    try {
      if (dataset.source === 'github') {
        // For GitHub datasets, send metadata directly to server
        // Server will download images directly from GitHub
        console.log('📦 Sending GitHub dataset info to server...')
        setUploading(true)
        setUploadProgress(0)
        setUploadStatus('Sending dataset information to server...')
        
        // Load full dataset with files from IndexedDB
        const fullDataset = await getDataset(dataset.id)
        const images = fullDataset.files || []
        
        if (images.length === 0) {
          throw new Error('No images found in dataset')
        }
        
        if (images.length < 30) {
          throw new Error(`Dataset has only ${images.length} images, need at least 30 for processing`)
        }
        
        // Prepare GitHub dataset payload
        const githubPayload = {
          source: 'github',
          owner: dataset.owner || dataset.metadata?.owner,
          repo: dataset.repo || dataset.metadata?.repo,
          branch: dataset.branch || dataset.metadata?.branch || 'master',
          path: dataset.path || dataset.metadata?.path || '',
          images: images.map(img => ({
            name: img.name,
            path: img.path,
            url: img.url || img.download_url,
            size: img.size
          })),
          quality: quality,
          formats: formats
        }
        
        console.log('📤 Sending GitHub dataset payload:', githubPayload)
        
        // Send to server
        const API_BASE = import.meta.env.VITE_API_URL || ''
        const response = await axios.post(`${API_BASE}/api/github-dataset`, githubPayload, {
          headers: {
            'X-User-Id': userId
          },
          onUploadProgress: (progressEvent) => {
            const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total)
            setUploadProgress(progress)
            setUploadStatus(`Sending dataset info: ${progress}%`)
          }
        })
        
        if (!response.data || !response.data.success) {
          throw new Error(response.data?.message || 'Server rejected dataset')
        }
        
        // Server will download images and start processing
        const sessId = response.data.sessionId
        setSessionId(sessId)
        setProcessingDetails(response.data)
        setStartTime(Date.now())
        setIsInitializing(false)
        setCurrentStage('processing')
        setProgress(0)
        setUploading(false)
        
        console.log('✅ Server accepted GitHub dataset, session:', sessId)
        
        // Save project to IndexedDB
        try {
          await createProject(sessId, {
            name: dataset.name,
            quality: quality,
            formats: formats,
            imageCount: images.length,
            source: 'github',
            githubUrl: dataset.url
          })
          console.log('✅ Project created in IndexedDB:', sessId)
        } catch (dbError) {
          console.error('Failed to save to IndexedDB:', dbError)
        }
        
      } else if (dataset.source === 'url') {
        // For URL datasets, download images from URLs
        console.log('🌐 Downloading images from URLs...')
        setUploading(true)
        setUploadProgress(0)
        setUploadStatus('Downloading images from URLs...')
        
        const imageUrls = dataset.files || dataset.images || []
        
        if (imageUrls.length === 0) {
          throw new Error('No image URLs found in dataset')
        }
        
        if (imageUrls.length < 30) {
          throw new Error(`Dataset has only ${imageUrls.length} images, need at least 30 for processing`)
        }
        
        // Download images as Blobs
        const downloadedFiles = []
        for (let i = 0; i < imageUrls.length; i++) {
          const imgUrl = imageUrls[i].url || imageUrls[i]
          const imgName = imageUrls[i].name || `image_${i + 1}.jpg`
          
          try {
            setUploadStatus(`Downloading ${i + 1}/${imageUrls.length}: ${imgName}`)
            setUploadProgress(Math.round((i / imageUrls.length) * 50)) // 0-50% for download
            
            const response = await fetch(imgUrl)
            if (!response.ok) throw new Error(`Failed to download ${imgName}`)
            
            const blob = await response.blob()
            const file = new File([blob], imgName, { type: blob.type || 'image/jpeg' })
            downloadedFiles.push(file)
            
          } catch (err) {
            console.error(`Failed to download ${imgName}:`, err)
            throw new Error(`Failed to download image ${i + 1}: ${err.message}`)
          }
        }
        
        console.log(`✅ Downloaded ${downloadedFiles.length} images, uploading to server...`)
        setUploadStatus(`Uploading ${downloadedFiles.length} images to server...`)
        
        // Upload to server using chunked upload
        const result = await uploadInChunks(downloadedFiles, quality, formats, userId, (progressInfo) => {
          if (progressInfo.type === 'batch') {
            setUploadStatus(`Uploading batch ${progressInfo.current}/${progressInfo.total}...`)
          } else if (progressInfo.type === 'progress') {
            setUploadProgress(50 + Math.round(progressInfo.overallProgress * 0.5)) // 50-100% for upload
            setUploadStatus(`Batch ${progressInfo.batch}: ${progressInfo.batchProgress}% • Overall: ${Math.round(50 + progressInfo.overallProgress * 0.5)}%`)
          }
        })
        
        // Extract sessionId from result structure
        const sessId = result.data?.sessionId || result.sessionId
        if (!sessId) {
          throw new Error('No session ID returned from upload')
        }
        
        setSessionId(sessId)
        setProcessingDetails(result.data || result)
        setStartTime(Date.now())
        setIsInitializing(false)
        setCurrentStage('processing')
        setProgress(0)
        setUploading(false)
        setUploadStatus('')
        
        console.log('✅ URL dataset uploaded, session:', sessId)
        
        // Save project to IndexedDB
        try {
          await createProject(sessId, {
            name: dataset.name,
            quality: quality,
            formats: formats,
            imageCount: downloadedFiles.length,
            source: 'url',
            sourceUrl: dataset.url
          })
          console.log('✅ Project created in IndexedDB:', sessId)
        } catch (dbError) {
          console.error('Failed to save to IndexedDB:', dbError)
        }
        
      } else if (dataset.source === 'local') {
        // For local datasets, load files and upload
        console.log('💻 Loading local dataset...')
        setUploading(true)
        setUploadProgress(0)
        setUploadStatus('Loading local images...')
        
        // If dataset has File objects, use them directly
        if (dataset.files && dataset.files.length > 0 && dataset.files[0] instanceof File) {
          console.log(`✅ Found ${dataset.files.length} File objects, uploading...`)
          
          const result = await uploadInChunks(dataset.files, quality, formats, userId, (progressInfo) => {
            if (progressInfo.type === 'batch') {
              setUploadStatus(`Uploading batch ${progressInfo.current}/${progressInfo.total} (${progressInfo.files} files)...`)
            } else if (progressInfo.type === 'progress') {
              setUploadProgress(progressInfo.overallProgress)
              setUploadStatus(`Batch ${progressInfo.batch}: ${progressInfo.batchProgress}% • Overall: ${progressInfo.overallProgress}%`)
            }
          })
          
          // Extract sessionId from result structure
          const sessId = result.data?.sessionId || result.sessionId
          if (!sessId) {
            throw new Error('No session ID returned from upload')
          }
          
          setSessionId(sessId)
          setProcessingDetails(result.data || result)
          setStartTime(Date.now())
          setIsInitializing(false)
          setCurrentStage('processing')
          setProgress(0)
          setUploading(false)
          setUploadStatus('')
          
          console.log('✅ Local dataset uploaded, session:', sessId)
          
          // Save project to IndexedDB
          try {
            await createProject(sessId, {
              name: dataset.name,
              quality: quality,
              formats: formats,
              imageCount: dataset.files.length,
              source: 'local'
            })
            console.log('✅ Project created in IndexedDB:', sessId)
          } catch (dbError) {
            console.error('Failed to save to IndexedDB:', dbError)
          }
        } else {
          throw new Error('Local dataset has no file objects. Please re-import the dataset.')
        }
      } else if (dataset.source === 'gdrive') {
        // For Google Drive datasets, download images via proxy then upload
        console.log('📁 Downloading images from Google Drive...')
        
        const fullDataset = await getDataset(dataset.id)
        if (!fullDataset || !fullDataset.files || fullDataset.files.length === 0) {
          throw new Error('Google Drive dataset has no file metadata. Please re-import the folder.')
        }
        
        const imageFiles = fullDataset.files
        
        if (imageFiles.length < 30) {
          throw new Error(`Dataset has only ${imageFiles.length} images, need at least 30 for processing`)
        }
        
        setUploading(true)
        setUploadProgress(0)
        setUploadStatus('Downloading images from Google Drive...')
        
        // Download images as Blobs via backend proxy
        const downloadedFiles = []
        for (let i = 0; i < imageFiles.length; i++) {
          const imgFile = imageFiles[i]
          const imgName = imgFile.name || `image_${i + 1}.jpg`
          
          try {
            setUploadStatus(`Downloading ${i + 1}/${imageFiles.length}: ${imgName}`)
            setUploadProgress(Math.round((i / imageFiles.length) * 50)) // 0-50% for download
            
            // Use backend proxy to download (bypass CORS)
            const proxyUrl = `/api/gdrive/download/${imgFile.id}`
            const response = await fetch(proxyUrl)
            if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`)
            
            const blob = await response.blob()
            const file = new File([blob], imgName, { type: blob.type || 'image/jpeg' })
            downloadedFiles.push(file)
            
          } catch (err) {
            console.error(`Failed to download ${imgName}:`, err)
            throw new Error(`Failed to download image ${i + 1}: ${err.message}`)
          }
        }
        
        console.log(`✅ Downloaded ${downloadedFiles.length} images from Google Drive, uploading to server...`)
        setUploadStatus(`Uploading ${downloadedFiles.length} images to server...`)
        
        // Upload to server using chunked upload
        const result = await uploadInChunks(downloadedFiles, quality, formats, userId, (progressInfo) => {
          if (progressInfo.type === 'batch') {
            setUploadStatus(`Uploading batch ${progressInfo.current}/${progressInfo.total}...`)
          } else if (progressInfo.type === 'progress') {
            setUploadProgress(50 + Math.round(progressInfo.overallProgress * 0.5)) // 50-100% for upload
            setUploadStatus(`Batch ${progressInfo.batch}: ${progressInfo.batchProgress}% • Overall: ${Math.round(50 + progressInfo.overallProgress * 0.5)}%`)
          }
        })
        
        // Extract sessionId from result structure
        const sessId = result.data?.sessionId || result.sessionId
        if (!sessId) {
          throw new Error('No session ID returned from upload')
        }
        
        setSessionId(sessId)
        setProcessingDetails(result.data || result)
        setStartTime(Date.now())
        setIsInitializing(false)
        setCurrentStage('processing')
        setProgress(0)
        setUploading(false)
        setUploadStatus('')
        
        console.log('✅ Google Drive dataset uploaded, session:', sessId)
        
        // Save project to IndexedDB
        try {
          await createProject(sessId, {
            name: dataset.name,
            quality: quality,
            formats: formats,
            imageCount: downloadedFiles.length,
            source: 'gdrive',
            gdriveUrl: dataset.url
          })
          console.log('✅ Project created in IndexedDB:', sessId)
        } catch (dbError) {
          console.error('Failed to save to IndexedDB:', dbError)
        }
      } else {
        alert(`Unsupported dataset source: ${dataset.source}`)
      }
    } catch (error) {
      console.error('Dataset build failed:', error)
      setError(`Failed to build dataset: ${error.message}`)
      setUploading(false)
      setUploadStatus('')
    }
  }
  
  // Timer effect - update every second when processing or initializing
  useEffect(() => {
    if (startTime && (currentStage === 'processing' || isInitializing)) {
      // Clear any existing interval
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current)
      }
      
      timerIntervalRef.current = setInterval(() => {
        const elapsed = Date.now() - startTime
        setElapsedTime(elapsed)
      }, 1000)
      
      return () => {
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current)
          timerIntervalRef.current = null
        }
      }
    } else if (currentStage === 'complete' && startTime) {
      // When complete, set final elapsed time and STOP timer
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current)
        timerIntervalRef.current = null
      }
      setElapsedTime(Date.now() - startTime)
    }
  }, [startTime, currentStage, isInitializing])
  
  // Connect to WebSocket when processing starts
  useEffect(() => {
    if (currentStage === 'processing' && sessionId && !wsRef.current) {
      connectWebSocket(sessionId)
      // Also poll job status initially to check if already complete
      checkJobStatus(sessionId)
      
      // Poll every 5 seconds as backup if WebSocket fails
      pollIntervalRef.current = setInterval(() => {
        checkJobStatus(sessionId)
      }, 5000)
      
      return () => {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current)
          pollIntervalRef.current = null
        }
      }
    }
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
      }
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current)
        timerIntervalRef.current = null
      }
    }
  }, [currentStage, sessionId])
  
  const checkJobStatus = async (sessId) => {
    try {
      const API_BASE = import.meta.env.VITE_API_URL || ''
      const userId = await getUserId()
      const response = await fetch(`${API_BASE}/api/jobs/${sessId}`, {
        headers: {
          'X-User-Id': userId
        }
      })
      const data = await response.json()
      
      if (data.success && data.data) {
        const job = data.data
        
        // Update job status
        if (job.status) {
          setJobStatus(job.status)
        }
        
        // Update progress and stage
        if (job.progress !== undefined) {
          setProgress(job.progress)
        }
        if (job.currentStage) {
          setCurrentSubstage(job.currentStage)
        }
        
        // Check if already completed
        if (job.status === 'completed' && job.results) {
          console.log('🎉 Job completed! Transitioning to complete stage with results:', job.results)
          setProgress(100)
          setResults(job.results)
          setCurrentStage('complete')
          setIsInitializing(false)
          
          // Download and save files to IndexedDB
          if (sessId && job.results) {
            (async () => {
              try {
                console.log('📥 Downloading model files from polling...')
                const files = await downloadModelFiles(job.results)
                await completeProject(sessId, files)
                console.log('✅ Project completed and saved to IndexedDB')
              } catch (dbError) {
                console.error('❌ Failed to save files to IndexedDB:', dbError)
              }
            })()
          }
          
          // Stop ALL timers and polling
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current)
            pollIntervalRef.current = null
          }
          if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current)
            timerIntervalRef.current = null
          }
          if (wsRef.current) {
            wsRef.current.close()
            wsRef.current = null
          }
        }
      }
    } catch (err) {
      console.error('Failed to check job status:', err)
    }
  }
  
  const connectWebSocket = (sessId) => {
    const API_BASE = import.meta.env.VITE_API_URL || ''
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = API_BASE ? `${wsProtocol}//${new URL(API_BASE).host}/ws/${sessId}` : `${wsProtocol}//${window.location.host}/ws/${sessId}`
    const ws = new WebSocket(wsUrl)
    
    ws.onopen = () => {
      console.log('WebSocket connected')
      wsRef.current = ws
    }
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        
        if (data.type === 'connected') {
          // Connected to WebSocket
        } else if (data.type === 'progress') {
          if (data.progress !== undefined && data.progress !== null) {
            setProgress(data.progress)
            // Update job status if provided
            if (data.status) {
              setJobStatus(data.status)
            }
            // Update progress in IndexedDB
            if (sessionId) {
              updateDBProgress(sessionId, data.progress, data.stage || currentSubstage).catch(err => {
                // Silent fail - don't spam console
              })
            }
          }
          if (data.stage) {
            setCurrentSubstage(data.stage)
            // Check if stage is Completed - trigger completion check
            if (data.stage === 'Completed' || data.stage === 'completed') {
              checkJobStatus(sessId)
            }
          }
        } else if (data.type === 'stage') {
          if (data.stage) {
            setCurrentSubstage(data.stage)
            // Update stage in IndexedDB
            if (sessionId) {
              updateProject(sessionId, { currentStage: data.stage }).catch(err => {
                // Silent fail - don't spam console
              })
            }
            // Check if stage is Completed
            if (data.stage === 'Completed' || data.stage === 'completed') {
              checkJobStatus(sessId)
            }
          }
        } else if (data.type === 'complete') {
          console.log('🎉 Job complete!')
          setProgress(100)
          setResults(data.results)
          setCurrentStage('complete')
          setIsInitializing(false)
          
          // Download and save files to IndexedDB
          if (sessionId && data.results) {
            (async () => {
              try {
                const files = await downloadModelFiles(data.results)
                await completeProject(sessionId, files)
                console.log('✅ Model saved to IndexedDB')
              } catch (dbError) {
                console.error('❌ Failed to save files:', dbError)
                // Don't fail the completion if IndexedDB fails
              }
            })()
          }
          
          // Stop polling interval
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current)
            pollIntervalRef.current = null
          }
          
          // Close WebSocket
          if (wsRef.current) {
            wsRef.current.close()
            wsRef.current = null
          }
        } else if (data.type === 'error') {
          setError(data.error)
          setCurrentStage('upload')
          
          // Mark project as failed in IndexedDB
          if (sessionId) {
            failProject(sessionId, data.error).catch(err => {
              // Silent fail
            })
          }
          
          if (wsRef.current) {
            wsRef.current.close()
            wsRef.current = null
          }
        }
      } catch (err) {
        console.error('Failed to parse WebSocket message:', err)
      }
    }
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error)
    }
    
    ws.onclose = () => {
      console.log('WebSocket closed')
      wsRef.current = null
      
      // Try to reconnect if still processing
      if (currentStage === 'processing') {
        reconnectTimerRef.current = setTimeout(() => {
          connectWebSocket(sessId)
        }, 3000)
      }
    }
  }
  
  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files)
    setFiles(selectedFiles)
    setError(null)
  }
  
  const handleFormatToggle = (format) => {
    if (formats.includes(format)) {
      setFormats(formats.filter(f => f !== format))
    } else {
      setFormats([...formats, format])
    }
  }
  
  const handleSubmit = async (e, filesOverride = null) => {
    if (e) e.preventDefault()
    
    const filesToUpload = filesOverride || files
    
    console.log('🚀 Upload function called')
    console.log('📁 Files:', filesToUpload.length)
    console.log('⚙️ Quality:', quality)
    console.log('📦 Formats:', formats)
    
    if (filesToUpload.length < 30) {
      setError('Please upload at least 30 images for processing')
      return
    }
    
    if (formats.length === 0) {
      setError('Please select at least one output format')
      return
    }
    
    setUploading(true)
    setUploadProgress(0)
    setUploadStatus('Preparing files...')
    setError(null)
    
    try {
      const totalFiles = filesToUpload.length
      const totalSize = filesToUpload.reduce((sum, f) => sum + f.size, 0)
      const totalSizeMB = (totalSize / 1024 / 1024).toFixed(1)
      
      console.log(`📦 Total: ${totalFiles} files, ${totalSizeMB} MB`)
      
      // Check if upload is large enough to need chunking (> 80MB)
      const needsChunking = totalSize > 80 * 1024 * 1024
      
      if (needsChunking) {
        console.log('📦 Large upload detected, using chunked upload')
        setUploadStatus('Preparing chunked upload...')
      } else {
        setUploadStatus(`Uploading ${totalFiles} images...`)
      }
      
      // Use chunked upload utility
      const response = await uploadInChunks(filesToUpload, quality, formats, userId, (progress) => {
        if (progress.type === 'batch') {
          setUploadStatus(`📦 Uploading batch ${progress.current}/${progress.total} (${progress.files} files)`)
        } else if (progress.type === 'progress') {
          setUploadProgress(progress.overallProgress)
          if (needsChunking) {
            setUploadStatus(`📦 Batch ${progress.batch}: ${progress.batchProgress}% (Overall: ${progress.overallProgress}%)`)
          } else {
            const uploadedMB = ((progress.overallProgress / 100) * totalSize / 1024 / 1024).toFixed(1)
            setUploadStatus(`📤 Uploading ${uploadedMB} MB / ${totalSizeMB} MB`)
          }
        }
      })
      
      // Upload successful, move to processing stage
      const sessId = response.data.sessionId
      setSessionId(sessId)
      setProcessingDetails(response.data)
      setStartTime(Date.now()) // Start timer
      setIsInitializing(false)
      setCurrentStage('processing')
      setProgress(0)
      
      // Save project to IndexedDB
      try {
        const thumbnail = files.length > 0 ? await createThumbnail(files[0]) : null
        await createProject(sessId, {
          name: `Model ${new Date().toLocaleString('vi-VN')}`,
          quality: quality,
          formats: formats,
          imageCount: files.length,
          thumbnail: thumbnail
        })
        console.log('✅ Project saved to IndexedDB')
      } catch (dbError) {
        console.error('❌ Failed to save project to IndexedDB:', dbError)
        // Don't fail the upload if IndexedDB fails
      }
      
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }
  
  const handleReset = () => {
    setCurrentStage('upload')
    setSessionId(null)
    setFiles([])
    setProgress(0)
    setCurrentSubstage('')
    setResults(null)
    setError(null)
    setProcessingDetails(null)
    setStartTime(null)
    setElapsedTime(0)
    setIsInitializing(false)
    
    // Clear all timers and connections
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current)
      pollIntervalRef.current = null
    }
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
    }
  }
  
  const totalSize = files.reduce((acc, file) => acc + file.size, 0)
  const totalSizeMB = (totalSize / 1024 / 1024).toFixed(2)
  
  // Format elapsed time as MM:SS
  const formatElapsedTime = (ms) => {
    const seconds = Math.floor(ms / 1000)
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }
  
  return (
    <div className="workflow-container">
      {/* Stage Progress Bar */}
      <div className="stage-progress">
        {STAGES.map((stage, index) => (
          <div key={stage.id} className="stage-item">
            <div className={`stage-indicator ${
              currentStage === stage.id ? 'active' : 
              STAGES.findIndex(s => s.id === currentStage) > index ? 'completed' : ''
            }`}>
              <div className="stage-icon">{stage.icon}</div>
              <div className="stage-number">{index + 1}</div>
            </div>
            <div className="stage-info">
              <h3 className="stage-title">{stage.title}</h3>
              <p className="stage-description">{stage.description}</p>
            </div>
            {index < STAGES.length - 1 && (
              <div className={`stage-connector ${
                STAGES.findIndex(s => s.id === currentStage) > index ? 'completed' : ''
              }`}></div>
            )}
          </div>
        ))}
      </div>
      
      {/* Stage Content */}
      <div className="stage-content">
        {/* Upload Stage */}
        {currentStage === 'upload' && (
          <div className="upload-stage">
            <div className="card">
              <h2>📤 Upload Your Images</h2>
              <p className="description">
                Upload at least 30 high-resolution images of your object from different angles
              </p>
              
              <form onSubmit={handleSubmit} className="upload-form">
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
                      <p className="file-count">✅ {files.length} files selected ({totalSizeMB} MB)</p>
                      {files.length < 30 && (
                        <p className="warning">⚠️ Need at least 30 images (current: {files.length})</p>
                      )}
                    </div>
                  )}
                </div>
                
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
                </div>
                
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
                
                {uploading && (
                  <div className="progress-container">
                    <div className="progress-bar">
                      <div 
                        className="progress-fill" 
                        style={{ width: `${uploadProgress}%` }}
                      ></div>
                    </div>
                    <p className="progress-text">{uploadStatus}</p>
                  </div>
                )}
              </form>
              
              {error && (
                <div className="error-message">
                  <span className="error-icon">❌</span>
                  <span>{error}</span>
                </div>
              )}
            </div>

            {/* External Model Viewer in Upload Stage */}
            {externalModelUrl && (
              <div className="card" style={{ marginTop: '24px' }}>
                <h3>📦 Viewing your models</h3>
                <div className="model-viewer">
                  <STLViewer url={externalModelUrl} />
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* Processing Stage */}
        {currentStage === 'processing' && (
          <div className="processing-stage">
            <div className="card">
              <h2>⚙️ Processing Your 3D Model</h2>
              <p className="session-id">Session ID: <code>{sessionId}</code></p>
              
              {/* Timer Display */}
              {startTime && (
                <div className="timer-display">
                  <span className="timer-icon">⏱️</span>
                  <span className="timer-text">Elapsed Time: <strong>{formatElapsedTime(elapsedTime)}</strong></span>
                </div>
              )}
              
              {/* Initializing Status */}
              {isInitializing && (
                <div className="initializing-status">
                  <span className="spinner"></span>
                  <span>Preparing images and initializing RealityKit engine...</span>
                </div>
              )}
              
              {processingDetails && (
                <div className="processing-info">
                  <div className="info-item">
                    <span className="label">Images:</span>
                    <span className="value">{processingDetails.uploadedCount}</span>
                  </div>
                  <div className="info-item">
                    <span className="label">Quality:</span>
                    <span className="value">{processingDetails.quality}</span>
                  </div>
                  <div className="info-item">
                    <span className="label">Estimated Time:</span>
                    <span className="value">{processingDetails.estimatedTime}</span>
                  </div>
                </div>
              )}
              
              {/* Download Progress - Show only during GitHub download phase */}
              {currentSubstage && currentSubstage.includes('Downloading images') && (
                <div className="overall-progress">
                  <div className="progress-header">
                    <h3>Download Progress</h3>
                    <span className="progress-percent">{progress}%</span>
                  </div>
                  <div className="progress-bar large">
                    <div 
                      className="progress-fill" 
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                </div>
              )}
              
              {/* Overall Progress - Only show during actual processing, not download */}
              {currentSubstage && !currentSubstage.includes('Downloading images') && (
              <div className="overall-progress">
                <div className="progress-header">
                  <h3>Overall Progress</h3>
                  <span className="progress-percent">{progress}%</span>
                </div>
                <div className="progress-bar large">
                  <div 
                    className="progress-fill" 
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
              </div>
              )}
              
              {/* Processing Substages - Only show during actual processing */}
              {currentSubstage && !currentSubstage.includes('Downloading images') && (
              <div className="substages">
                <h3>Processing Stages</h3>
                <div className="substage-list">
                  {PROCESSING_SUBSTAGES.map((substage, index) => {
                    const stageStartPercent = (index / PROCESSING_SUBSTAGES.length) * 100
                    const stageEndPercent = ((index + 1) / PROCESSING_SUBSTAGES.length) * 100
                    const isActive = progress >= stageStartPercent && progress < stageEndPercent
                    const isCompleted = progress >= stageEndPercent
                    
                    // Calculate substage progress (0-100 within this stage)
                    let substageProgress = 0
                    if (isCompleted) {
                      substageProgress = 100
                    } else if (isActive) {
                      substageProgress = ((progress - stageStartPercent) / (stageEndPercent - stageStartPercent)) * 100
                    }
                    
                    return (
                      <div 
                        key={substage.key} 
                        className={`substage-item ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
                      >
                        <div className="substage-header">
                          <div className="substage-icon">{substage.icon}</div>
                          <div className="substage-label">{substage.label}</div>
                          <div className="substage-status">
                            {isCompleted && '✅'}
                            {isActive && `${Math.round(substageProgress)}%`}
                            {!isActive && !isCompleted && '⏸️'}
                          </div>
                        </div>
                        {(isActive || isCompleted) && (
                          <div className="substage-progress-bar">
                            <div 
                              className="substage-progress-fill"
                              style={{ width: `${substageProgress}%` }}
                            ></div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
              )}
              
              {/* Current Stage */}
              {currentSubstage && (
                <div className="current-stage-display">
                  <span className="pulse-indicator"></span>
                  <span>Current Stage: <strong>{currentSubstage}</strong></span>
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Complete Stage */}
        {currentStage === 'complete' && (
          <div className="complete-stage">
            <div className="card">
              <h2>✅ Processing Complete!</h2>
              <p className="success-message">
                Your 3D model has been generated successfully
                {startTime && <> in <strong>{formatElapsedTime(elapsedTime)}</strong> minutes</>}
              </p>
              
              {/* Model Viewer */}
              {results && results.stl && (
                <div className="model-viewer">
                  <h3>Preview Model</h3>
                  <STLViewer url={`${import.meta.env.VITE_API_URL || ''}${results.stl.url}`} />
                </div>
              )}

              {/* External Model from My Models */}
              {!results && externalModelUrl && (
                <div className="model-viewer">
                  <h3>Preview Model (From My Models)</h3>
                  <STLViewer url={externalModelUrl} />
                </div>
              )}
              
              {results && Object.keys(results).length > 0 && (
                <div className="results">
                  <h3>Download Your Models</h3>
                  <div className="download-list compact">
                    {Object.entries(results)
                      .filter(([format, info]) => {
                        // Filter out empty/null entries
                        if (!format || format === '' || !info) return false
                        // Support both string URLs and {url, size} objects
                        return typeof info === 'string' || (typeof info === 'object' && info.url)
                      })
                      .map(([format, info]) => {
                        // Handle both string URLs and objects
                        const url = typeof info === 'string' ? info : info.url
                        const size = typeof info === 'object' ? info.size : null
                        
                        return (
                          <a 
                            key={format}
                            href={`${import.meta.env.VITE_API_URL || ''}${url}`}
                            className="download-btn"
                            download
                          >
                            <span className="format-icon">
                              {format === 'usdz' && '🍎'}
                              {format === 'obj' && '🌐'}
                              {format === 'stl' && '🖨️'}
                            </span>
                            <div className="download-info">
                              <div className="format-name">{format.toUpperCase()}</div>
                              {size && <div className="file-size">{size}</div>}
                            </div>
                            <span className="download-icon">⬇️</span>
                          </a>
                        )
                      })}
                  </div>
                </div>
              )}
              
              <button onClick={handleReset} className="reset-btn">
                🔄 Create Another Model
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Workflow
