# Test Guide: Build from Saved Datasets

## Tính năng mới đã implement:

✅ **IndexedDB Storage** - Lưu datasets với actual File objects
✅ **Local Dataset Support** - Upload và lưu local files
✅ **GitHub Dataset Support** - Lưu metadata và download khi build  
✅ **URL Dataset Support** - Download từ public URLs khi build
✅ **Build from Settings** - Chọn dataset và build model

## Test với chrome_test:

### Bước 1: Import Dataset
1. Mở HeyPhom web app
2. Click vào ⚙️ Settings (góc trên phải)
3. Scroll xuống "Datasets Management"
4. Click tab "💻 Local Files"
5. Click "📤 Upload Local Files"
6. **Select toàn bộ 67 files** từ `/Users/mac/HeyPhom/chrome_test/test-images/`
7. Nhập tên: "chrome_test"
8. Click OK

✅ Dataset sẽ được lưu vào IndexedDB với actual File objects

### Bước 2: Build Model
1. Trong Settings → "Saved Datasets"
2. Click vào dataset "chrome_test" để select
3. Click nút **"🚀 Build"**
4. Confirm dialog
5. Settings sẽ đóng và chuyển sang Upload UI
6. Files sẽ được upload từ IndexedDB → Server
7. Model sẽ được build

### Bước 3: Monitor Progress
- Upload progress bar sẽ hiển thị
- Processing stages: Preprocessing → Feature Detection → ... → Complete
- Wait ~2-3 minutes cho model hoàn thành

### Expected Results:
```
✅ Upload: 67 images (~280MB)
✅ Processing: 100% Complete
✅ Stage: "Complete" (not "Extracting"!)
✅ Results: USDZ, OBJ, STL files
```

## Code Changes:

### 1. IndexedDB Schema (`src/db/index.js`)
- Added `datasets` store with schema: `id, name, source, createdAt`
- Supports storing File objects and metadata

### 2. Dataset Functions (`src/db/datasets.js`)
- `saveDataset()` - Save dataset with files
- `getDataset()` - Load dataset with files
- `getAllDatasets()` - List all datasets (metadata only)
- `deleteDataset()` - Remove dataset
- `renameDataset()` - Update name
- `migrateLocalStorageDatasets()` - Migrate old data

### 3. Settings Component (`src/components/Settings.jsx`)
- Updated `loadDatasets()` - Load from IndexedDB
- Updated `handleDatasetUpload()` - Save files to IndexedDB
- Updated `handleBuildDataset()` - Load files for local datasets
- Updated `handleDeleteDataset()` - Delete from IndexedDB
- Updated `confirmRename()` - Rename in IndexedDB
- Updated `confirmAndSaveDataset()` - Save GitHub datasets

### 4. Workflow Component (`src/components/Workflow.jsx`)
- Added support for `source === 'url'` - Download from URLs
- Updated `source === 'local'` - Use files from dataset object
- Kept `source === 'github'` - Use existing GitHub download logic

## Test Scenarios:

### Scenario 1: Local Dataset (chrome_test)
```
Source: Local files
Files: 67 PNG images
Size: ~280MB
Expected: Upload from IndexedDB → Server → Build
```

### Scenario 2: GitHub Dataset
```
Source: GitHub repository
Files: Metadata with download URLs
Expected: Server downloads from GitHub → Build
```

### Scenario 3: URL Dataset
```
Source: Public image URLs
Files: Array of {name, url}
Expected: Frontend downloads → Upload to server → Build
```

## Troubleshooting:

### Issue: "Dataset has no files"
**Solution:** Re-import the dataset. Old localStorage datasets don't have files.

### Issue: IndexedDB quota exceeded
**Solution:** Delete old projects or datasets from Settings

### Issue: Upload fails
**Solution:** Check console for errors, verify file count >= 30 images

### Issue: Build button doesn't work
**Solution:** Make sure dataset is selected (highlighted in blue)

## Next Steps:

After successful test với chrome_test:
1. ✅ Verify core stability (already done!)
2. ✅ Test saved dataset build flow
3. → Resume GitHub dataset optimization
4. → Add batch processing for large datasets
5. → Improve progress estimation

---

**Test ngay:** Open Settings → Upload chrome_test images → Click Build → Enjoy! 🎉
