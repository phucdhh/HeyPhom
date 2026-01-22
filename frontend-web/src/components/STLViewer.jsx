import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'

export default function STLViewer({ url, width = '100%', height = '400px' }) {
  const containerRef = useRef(null)
  const sceneRef = useRef(null)
  const rendererRef = useRef(null)
  const cameraRef = useRef(null)
  const controlsRef = useRef(null)
  const meshRef = useRef(null)
  const animationIdRef = useRef(null)
  const [isLoading, setIsLoading] = useState(true)
  const [autoRotate, setAutoRotate] = useState(false)

  useEffect(() => {
    if (!containerRef.current) return

    // Scene setup
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0xf0f0f0)
    sceneRef.current = scene

    // Camera
    const camera = new THREE.PerspectiveCamera(
      45,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      1000
    )
    camera.position.set(0, 0, 100)
    cameraRef.current = camera

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight)
    renderer.setPixelRatio(window.devicePixelRatio)
    containerRef.current.appendChild(renderer.domElement)
    rendererRef.current = renderer

    // Lights - Brighter for better visibility
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8) // Increased from 0.6
    scene.add(ambientLight)

    const directionalLight1 = new THREE.DirectionalLight(0xffffff, 1.0) // Increased from 0.8
    directionalLight1.position.set(1, 1, 1)
    scene.add(directionalLight1)

    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.6) // Increased from 0.4
    directionalLight2.position.set(-1, -1, -1)
    scene.add(directionalLight2)
    
    // Add hemisphere light for better overall illumination
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.5)
    hemiLight.position.set(0, 200, 0)
    scene.add(hemiLight)

    // Grid helper
    const gridHelper = new THREE.GridHelper(100, 20, 0xcccccc, 0xeeeeee)
    scene.add(gridHelper)

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.05
    controls.screenSpacePanning = false
    controls.minDistance = 0.1 // Allow zooming VERY close
    controls.maxDistance = 1000
    controls.enableZoom = true
    controls.enablePan = true
    controls.enableRotate = true
    controls.autoRotate = false
    controls.autoRotateSpeed = 2.0
    // Enable touch gestures for trackpad/touch devices
    controls.touches = {
      ONE: THREE.TOUCH.ROTATE,
      TWO: THREE.TOUCH.DOLLY_PAN
    }
    controlsRef.current = controls

    // Load STL with custom fetch to include headers
    const loader = new STLLoader()
    
    // Custom load with headers support
    const loadSTLWithHeaders = async (url) => {
      try {
        // Import getUserId dynamically
        const { getUserId } = await import('../utils/userIdManager')
        const userId = await getUserId()
        
        const response = await fetch(url, {
          headers: {
            'X-User-Id': userId
          }
        })
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }
        
        const arrayBuffer = await response.arrayBuffer()
        const geometry = loader.parse(arrayBuffer)
        return geometry
      } catch (error) {
        throw error
      }
    }
    
    loadSTLWithHeaders(url).then((geometry) => {
        setIsLoading(false)
        
        // Center geometry
        geometry.computeBoundingBox()
        const center = new THREE.Vector3()
        geometry.boundingBox.getCenter(center)
        geometry.translate(-center.x, -center.y, -center.z)

        // Material
        const material = new THREE.MeshPhongMaterial({
          color: 0x667eea,
          specular: 0x111111,
          shininess: 100
        })

        // Mesh
        const mesh = new THREE.Mesh(geometry, material)
        scene.add(mesh)
        meshRef.current = mesh

        // Auto-fit camera - view from front-top angle
        const box = new THREE.Box3().setFromObject(mesh)
        const size = box.getSize(new THREE.Vector3())
        const maxDim = Math.max(size.x, size.y, size.z)
        const fov = camera.fov * (Math.PI / 180)
        let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2))
        cameraZ *= 1.5 // Distance from model
        // Position camera at front-top-right for best view
        camera.position.set(cameraZ * 0.7, cameraZ * 0.5, cameraZ * 0.7)
        controls.target.set(0, 0, 0)
        controls.update()
    }).catch((error) => {
      console.error('Error loading STL:', error)
      setIsLoading(false)
    })

    // Animation loop
    function animate() {
      animationIdRef.current = requestAnimationFrame(animate)
      if (controlsRef.current) {
        controlsRef.current.autoRotate = autoRotate
        controlsRef.current.update()
      }
      renderer.render(scene, camera)
    }
    animate()

    // Handle resize
    function handleResize() {
      if (!containerRef.current) return
      const width = containerRef.current.clientWidth
      const height = containerRef.current.clientHeight
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height)
    }
    window.addEventListener('resize', handleResize)

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize)
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current)
      }
      if (rendererRef.current && containerRef.current) {
        containerRef.current.removeChild(rendererRef.current.domElement)
      }
      if (sceneRef.current) {
        sceneRef.current.traverse((object) => {
          if (object.geometry) object.geometry.dispose()
          if (object.material) {
            if (Array.isArray(object.material)) {
              object.material.forEach(material => material.dispose())
            } else {
              object.material.dispose()
            }
          }
        })
      }
      if (rendererRef.current) {
        rendererRef.current.dispose()
      }
    }
  }, [url])

  // Control functions
  const handleZoomIn = () => {
    if (controlsRef.current && cameraRef.current) {
      const camera = cameraRef.current
      const distance = camera.position.length()
      const newDistance = distance * 0.5 // More aggressive zoom in
      camera.position.multiplyScalar(newDistance / distance)
      controlsRef.current.update()
    }
  }

  const handleZoomOut = () => {
    if (controlsRef.current && cameraRef.current) {
      const camera = cameraRef.current
      const distance = camera.position.length()
      const newDistance = distance * 1.2
      camera.position.multiplyScalar(newDistance / distance)
      controlsRef.current.update()
    }
  }

  const handleResetView = () => {
    if (controlsRef.current && cameraRef.current && meshRef.current) {
      const camera = cameraRef.current
      const mesh = meshRef.current
      
      // Reset camera position
      const box = new THREE.Box3().setFromObject(mesh)
      const size = box.getSize(new THREE.Vector3())
      const maxDim = Math.max(size.x, size.y, size.z)
      const fov = camera.fov * (Math.PI / 180)
      let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2))
      cameraZ *= 0.8 // Match initial position
      
      camera.position.set(cameraZ * 0.5, cameraZ * 0.3, cameraZ)
      controlsRef.current.target.set(0, 0, 0)
      controlsRef.current.update()
    }
  }

  const toggleAutoRotate = () => {
    setAutoRotate(!autoRotate)
  }

  return (
    <div style={{ position: 'relative', width, height }}>
      {/* Loading indicator */}
      {isLoading && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f0f0f0',
          borderRadius: '12px',
          zIndex: 1
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⏳</div>
            <div style={{ color: '#6b7280' }}>Loading 3D model...</div>
          </div>
        </div>
      )}

      {/* Controls */}
      <div style={{
        position: 'absolute',
        top: '12px',
        left: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        zIndex: 10
      }}>
        <button
          onClick={handleZoomIn}
          style={{
            width: '40px',
            height: '40px',
            border: 'none',
            borderRadius: '8px',
            background: 'rgba(255, 255, 255, 0.9)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            cursor: 'pointer',
            fontSize: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 1)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.9)'}
          title="Zoom In"
        >
          🔍+
        </button>

        <button
          onClick={handleZoomOut}
          style={{
            width: '40px',
            height: '40px',
            border: 'none',
            borderRadius: '8px',
            background: 'rgba(255, 255, 255, 0.9)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            cursor: 'pointer',
            fontSize: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 1)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.9)'}
          title="Zoom Out"
        >
          🔍-
        </button>

        <button
          onClick={handleResetView}
          style={{
            width: '40px',
            height: '40px',
            border: 'none',
            borderRadius: '8px',
            background: 'rgba(255, 255, 255, 0.9)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            cursor: 'pointer',
            fontSize: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 1)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.9)'}
          title="Reset View"
        >
          🏠
        </button>

        <button
          onClick={toggleAutoRotate}
          style={{
            width: '40px',
            height: '40px',
            border: 'none',
            borderRadius: '8px',
            background: autoRotate ? 'rgba(102, 126, 234, 0.9)' : 'rgba(255, 255, 255, 0.9)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            cursor: 'pointer',
            fontSize: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = autoRotate ? 'rgba(102, 126, 234, 1)' : 'rgba(255, 255, 255, 1)'}
          onMouseLeave={(e) => e.currentTarget.style.background = autoRotate ? 'rgba(102, 126, 234, 0.9)' : 'rgba(255, 255, 255, 0.9)'}
          title={autoRotate ? "Stop Auto Rotate" : "Auto Rotate"}
        >
          🔄
        </button>
      </div>

      {/* 3D Canvas Container */}
      <div 
        ref={containerRef} 
        style={{ 
          width, 
          height, 
          borderRadius: '12px', 
          overflow: 'hidden',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
        }} 
      />
    </div>
  )
}
