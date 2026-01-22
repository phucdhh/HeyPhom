# Phase 1: IndexedDB Infrastructure - COMPLETED ✅

## Đã hoàn thành:

### 1. Setup Dexie.js
- ✅ Installed: `npm install dexie`
- ✅ Database initialized: `HeyPhomDB`
- ✅ Schema version 1 created

### 2. File Structure
```
frontend-web/src/db/
├── index.js         # Database setup & schema
├── projects.js      # CRUD operations (20+ functions)
├── fileUtils.js     # File download & Blob utilities
└── test.js          # Test suite for verification
```

### 3. Core Functions Created

#### projects.js (CRUD):
- `createProject()` - Tạo project mới
- `getProject()` - Lấy project theo ID
- `getAllProjects()` - Lấy tất cả projects
- `getProjectsSorted()` - Sắp xếp theo ngày tạo
- `updateProject()` - Cập nhật thông tin
- `updateProgress()` - Cập nhật progress/stage từ WebSocket
- `completeProject()` - Đánh dấu hoàn thành + save files
- `failProject()` - Đánh dấu failed
- `deleteProject()` - Xóa 1 project
- `deleteProjects()` - Xóa nhiều projects
- `getProjectsByStatus()` - Lọc theo status
- `cleanupExpiredProjects()` - **Xóa projects đã hết hạn (<24h)**
- `isProjectExpired()` - Kiểm tra hết hạn
- `getStorageInfo()` - Thông tin dung lượng
- `getProjectCount()` - Đếm số projects
- `clearAllProjects()` - Xóa tất cả (emergency)

#### fileUtils.js:
- `downloadFileAsBlob()` - Download file từ URL → Blob
- `downloadModelFiles()` - Download tất cả formats (OBJ/STL/USDZ)
- `createObjectURL()` - Tạo URL từ Blob
- `revokeObjectURL()` - Giải phóng memory
- `downloadBlob()` - Download Blob as file
- `createThumbnail()` - Tạo thumbnail từ ảnh
- `formatFileSize()` - Format size cho display

### 4. Schema Design
```javascript
projects: {
  id: 'sess_...',              // Primary Key
  name: 'Model name',
  status: 'uploading|processing|completed|failed',
  quality: 'low|medium|high|ultra',
  formats: ['usdz', 'obj', 'stl'],
  progress: 0-100,
  currentStage: 'Stage name',
  imageCount: 67,
  createdAt: 1768916705556,
  completedAt: 1768920000000,
  thumbnail: Blob,
  files: { obj: Blob, stl: Blob, usdz: Blob },
  serverExpiry: createdAt + 24h  // KEY: Server sẽ xóa sau 24h
}
```

## Testing

### Trong Browser Console:
```javascript
// Run full test suite
await window.HeyPhomTests.runTests()

// Quick test
await window.HeyPhomTests.quickTest()

// Test cleanup (expired projects)
await window.HeyPhomTests.testCleanup()

// Manual operations
const { db } = window.HeyPhomTests
await db.projects.toArray()  // Xem tất cả
```

### Manual Test Example:
```javascript
// 1. Create project
import { createProject } from './db/projects'
const project = await createProject('sess_test_123', {
  name: 'My Model',
  quality: 'low',
  imageCount: 50
})

// 2. Update progress
import { updateProgress } from './db/projects'
await updateProgress('sess_test_123', 45, 'Mesh Reconstruction')

// 3. Complete with files
import { completeProject } from './db/projects'
import { downloadModelFiles } from './db/fileUtils'

const results = {
  stl: { url: '/api/download/sess_test_123/model.stl', size: '1.2 MB' },
  obj: { url: '/api/download/sess_test_123/model.obj', size: '800 KB' }
}
const files = await downloadModelFiles(results)
await completeProject('sess_test_123', files)
```

## Key Features

### 1. Auto Cleanup (Giảm tải Server)
```javascript
// Chạy cleanup khi app load
import { cleanupExpiredProjects } from './db/projects'
await cleanupExpiredProjects()
// → Xóa projects có serverExpiry < now()
```

### 2. Storage Info
```javascript
import { getStorageInfo } from './db/projects'
const info = await getStorageInfo()
console.log(`Used: ${info.usedGB} GB / ${info.quotaGB} GB (${info.percentUsed}%)`)
```

### 3. Expired Check
```javascript
import { isProjectExpired } from './db/projects'
const expired = await isProjectExpired('sess_123')
if (expired) {
  alert('Project expired on server. Please re-upload.')
}
```

## Next Steps → Phase 2

Phase 2 sẽ integrate vào Workflow.jsx:
- [ ] Save project khi upload starts
- [ ] Update progress từ WebSocket
- [ ] Download và save files khi completed
- [ ] Load projects từ IndexedDB on mount

## Notes

⚠️ **Important**: 
- IndexedDB có quota limit (~60% disk trên Chrome)
- User clear browser data = mất tất cả projects
- Khuyến khích download files về máy
- Server tự động xóa files sau 24h để tiết kiệm dung lượng

✅ **Build Status**: Production build successful (286 KB + Three.js 497 KB)
