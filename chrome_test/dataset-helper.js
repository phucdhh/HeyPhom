// Test script to add URL dataset to HeyPhom localStorage
// This creates a dataset with publicly accessible image URLs for testing

// Sample dataset: Unsplash random images (for demo)
const createURLDataset = () => {
  const datasets = JSON.parse(localStorage.getItem('datasets') || '[]')
  
  // Create a test URL dataset
  const urlDataset = {
    id: Date.now(),
    name: 'test-url-dataset',
    source: 'url',
    url: 'https://source.unsplash.com/collection/...',
    imageCount: 50,
    totalSize: 0, // Unknown for URLs
    createdAt: new Date().toISOString(),
    files: [
      // Sample image URLs - replace with actual publicly accessible images
      { name: 'image_1.jpg', url: 'https://example.com/image1.jpg', size: 0 },
      { name: 'image_2.jpg', url: 'https://example.com/image2.jpg', size: 0 },
      // ... add 48 more URLs to reach minimum 50 images
    ]
  }
  
  datasets.push(urlDataset)
  localStorage.setItem('datasets', JSON.stringify(datasets))
  
  console.log('✅ URL dataset added:', urlDataset)
  return urlDataset
}

// For chrome_test, we'll use a different approach - direct File upload
// Since we can't store File objects in localStorage, we need to:
// 1. Load files in Settings component when importing
// 2. Keep them in React state
// 3. Pass to Workflow when building

const createLocalDatasetPlaceholder = () => {
  const datasets = JSON.parse(localStorage.getItem('datasets') || '[]')
  
  // Create a placeholder for local dataset
  // The actual files will be loaded when user clicks "Import Local"
  const localDataset = {
    id: Date.now(),
    name: 'chrome_test',
    source: 'local',
    localPath: '/Users/mac/HeyPhom/chrome_test/test-images',
    imageCount: 67, // Known from folder
    totalSize: 280000000, // ~280MB
    createdAt: new Date().toISOString(),
    files: null // Will be populated when user imports
  }
  
  datasets.push(localDataset)
  localStorage.setItem('datasets', JSON.stringify(datasets))
  
  console.log('✅ Local dataset placeholder added:', localDataset)
  return localDataset
}

// Export functions
if (typeof window !== 'undefined') {
  window.createURLDataset = createURLDataset
  window.createLocalDatasetPlaceholder = createLocalDatasetPlaceholder
}

console.log('📦 Dataset helpers loaded!')
console.log('Run: createLocalDatasetPlaceholder() to add chrome_test')
console.log('Run: createURLDataset() to add URL dataset')
