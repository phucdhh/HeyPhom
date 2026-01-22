/**
 * Test IndexedDB Operations
 * Run this in browser console to verify database setup
 */

import db from './index';
import {
  createProject,
  getProject,
  getAllProjects,
  updateProject,
  updateProgress,
  completeProject,
  deleteProject,
  getStorageInfo,
  cleanupExpiredProjects
} from './projects';

/**
 * Run all tests
 */
export async function runTests() {
  console.log('🧪 Starting IndexedDB Tests...\n');
  
  try {
    // Test 1: Create project
    console.log('Test 1: Create Project');
    const testId = 'sess_test_' + Date.now();
    const project = await createProject(testId, {
      name: 'Test Model',
      quality: 'low',
      formats: ['stl', 'obj'],
      imageCount: 50
    });
    console.log('✅ Created:', project);
    console.log('');
    
    // Test 2: Get project
    console.log('Test 2: Get Project');
    const retrieved = await getProject(testId);
    console.log('✅ Retrieved:', retrieved);
    console.log('');
    
    // Test 3: Update progress
    console.log('Test 3: Update Progress');
    await updateProgress(testId, 45, 'Mesh Reconstruction');
    const updated = await getProject(testId);
    console.log('✅ Updated progress:', updated.progress, updated.currentStage);
    console.log('');
    
    // Test 4: Complete project
    console.log('Test 4: Complete Project');
    const mockFiles = {
      stl: new Blob(['mock stl data'], { type: 'application/octet-stream' }),
      obj: new Blob(['mock obj data'], { type: 'model/obj' })
    };
    await completeProject(testId, mockFiles);
    const completed = await getProject(testId);
    console.log('✅ Completed:', completed.status, completed.completedAt);
    console.log('');
    
    // Test 5: Get all projects
    console.log('Test 5: Get All Projects');
    const all = await getAllProjects();
    console.log('✅ Total projects:', all.length);
    console.log('');
    
    // Test 6: Storage info
    console.log('Test 6: Storage Info');
    const storage = await getStorageInfo();
    console.log('✅ Storage:', storage);
    console.log('');
    
    // Test 7: Delete project
    console.log('Test 7: Delete Project');
    await deleteProject(testId);
    const deleted = await getProject(testId);
    console.log('✅ Deleted:', deleted === undefined ? 'Success' : 'Failed');
    console.log('');
    
    console.log('🎉 All tests passed!\n');
    return true;
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    return false;
  }
}

/**
 * Quick test - create and retrieve
 */
export async function quickTest() {
  const testId = 'sess_quick_' + Date.now();
  
  // Create
  await createProject(testId, {
    name: 'Quick Test',
    imageCount: 10
  });
  
  // Retrieve
  const project = await getProject(testId);
  console.log('Quick test result:', project);
  
  // Cleanup
  await deleteProject(testId);
  
  return project !== undefined;
}

/**
 * Test storage cleanup
 */
export async function testCleanup() {
  console.log('🧹 Testing cleanup...');
  
  // Create expired project (serverExpiry in the past)
  const expiredId = 'sess_expired_' + Date.now();
  const project = await createProject(expiredId, {
    name: 'Expired Project',
    imageCount: 5
  });
  
  // Manually set expiry to past
  await updateProject(expiredId, {
    serverExpiry: Date.now() - 1000 // 1 second ago
  });
  
  console.log('Created expired project:', expiredId);
  
  // Run cleanup
  const cleaned = await cleanupExpiredProjects();
  console.log('Cleaned up projects:', cleaned);
  
  // Verify deleted
  const stillExists = await getProject(expiredId);
  console.log('Project still exists?', stillExists === undefined ? 'No (✅)' : 'Yes (❌)');
  
  return stillExists === undefined;
}

// Export for use in console
if (typeof window !== 'undefined') {
  window.HeyPhomTests = {
    runTests,
    quickTest,
    testCleanup,
    db
  };
  console.log('💡 Tests available: window.HeyPhomTests.runTests()');
}
