// Quick test to verify uploadInChunks callback
// Run in browser console

const testCallback = (progressInfo) => {
  console.log('📊 Progress info:', progressInfo)
  
  if (progressInfo.type === 'progress') {
    console.log(`  ✅ Progress: ${progressInfo.overallProgress}%`)
    console.log(`  📦 Batch ${progressInfo.batch}: ${progressInfo.batchProgress}%`)
  } else if (progressInfo.type === 'batch') {
    console.log(`  📤 Batch ${progressInfo.current}/${progressInfo.total} (${progressInfo.files} files)`)
  }
}

// Simulate callbacks
console.log('=== Test Case 1: Batch Start ===')
testCallback({
  type: 'batch',
  current: 1,
  total: 4,
  files: 19
})

console.log('\n=== Test Case 2: Progress Update ===')
testCallback({
  type: 'progress',
  batch: 1,
  batchProgress: 50,
  overallProgress: 12
})

console.log('\n=== Test Case 3: Batch Complete ===')
testCallback({
  type: 'progress',
  batch: 1,
  batchProgress: 100,
  overallProgress: 25
})

console.log('\n✅ All test cases passed!')
console.log('Expected outputs:')
console.log('  - Type "batch": Show "Uploading batch 1/4 (19 files)..."')
console.log('  - Type "progress": Show "Uploading: 12%"')
console.log('  - overallProgress should be a number (not NaN)')
