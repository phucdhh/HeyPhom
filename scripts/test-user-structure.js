#!/usr/bin/env node

/**
 * Test New Users Directory Structure
 * Tests userID generation and new directory structure
 */

const http = require('http');
const https = require('https');

function makeRequest(url, options = {}) {
  const urlObj = new URL(url);
  const client = urlObj.protocol === 'https:' ? https : http;
  
  return new Promise((resolve, reject) => {
    const req = client.request(url, {
      method: options.method || 'GET',
      headers: options.headers || {},
      ...options
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: JSON.parse(data)
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: data
          });
        }
      });
    });
    
    req.on('error', reject);
    
    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    
    req.end();
  });
}

async function testNewStructure() {
  console.log('🧪 Testing New Users Directory Structure\n');
  
  const userId = `user_test_${Date.now()}_abc123`;
  console.log(`👤 Test User ID: ${userId}\n`);
  
  // Test 1: GitHub Dataset with userID
  console.log('Test 1: GitHub Dataset with User ID');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  try {
    // Fetch minimal images from GitHub
    const githubResponse = await makeRequest(
      'https://api.github.com/repos/alicevision/dataset_monstree/contents/images',
      { headers: { 'User-Agent': 'HeyPhom-Test' } }
    );
    
    if (githubResponse.status !== 200) {
      throw new Error(`GitHub API returned ${githubResponse.status}`);
    }
    
    // Take first 30 images (minimum required)
    const imageFiles = githubResponse.data
      .filter(item => item.type === 'file' && /\.(jpg|jpeg|png)$/i.test(item.name))
      .slice(0, 30)
      .map(item => ({ download_url: item.download_url }));
    
    console.log(`✅ Found ${imageFiles.length} images from GitHub`);
    
    // Send to backend with userID
    const payload = {
      source: 'github',
      owner: 'alicevision',
      repo: 'dataset_monstree',
      images: imageFiles,
      quality: 'medium',
      formats: ['usdz', 'obj', 'stl']
    };
    
    const response = await makeRequest('http://localhost:4444/api/github-dataset', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': userId
      },
      body: payload
    });
    
    if (response.data.success) {
      console.log('✅ Request accepted!');
      console.log(`   Session ID: ${response.data.sessionId}`);
      console.log(`   User ID sent: ${userId}`);
      console.log(`   Images: ${response.data.uploadedCount || response.data.imageCount}`);
      console.log(`   Quality: ${response.data.quality}`);
      console.log(`   Status URL: ${response.data.statusUrl}`);
      
      const sessionId = response.data.sessionId;
      
      // Wait a bit for download to start
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Check session file in new structure
      console.log('\n📁 Checking Directory Structure:');
      const fs = require('fs');
      const path = require('path');
      
      const userSessionDir = path.join(__dirname, '../../users', userId, 'sessions', sessionId);
      const userUploadsDir = path.join(userSessionDir, 'uploads');
      const sessionFile = path.join(userSessionDir, 'session.json');
      
      if (fs.existsSync(userSessionDir)) {
        console.log(`✅ User session dir exists: users/${userId}/sessions/${sessionId}/`);
        
        if (fs.existsSync(sessionFile)) {
          const session = JSON.parse(fs.readFileSync(sessionFile, 'utf-8'));
          console.log(`✅ Session file exists with userId: ${session.userId}`);
        }
        
        if (fs.existsSync(userUploadsDir)) {
          const files = fs.readdirSync(userUploadsDir);
          console.log(`✅ Uploads directory exists with ${files.length} files`);
        }
      } else {
        console.log(`❌ User session dir NOT found: ${userSessionDir}`);
      }
      
      // Test 2: Check job status with userID
      console.log('\n\nTest 2: Get Job Status with User ID');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      const jobResponse = await makeRequest(`http://localhost:4444/api/jobs/${sessionId}`, {
        headers: {
          'X-User-Id': userId
        }
      });
      
      if (jobResponse.data.sessionId) {
        console.log('✅ Job status retrieved successfully!');
        console.log(`   Status: ${jobResponse.data.status}`);
        console.log(`   Progress: ${jobResponse.data.progress}%`);
        console.log(`   Stage: ${jobResponse.data.currentStage || jobResponse.data.currentSubstage || 'N/A'}`);
      } else {
        console.log('❌ Failed to get job status:', jobResponse.data);
      }
      
    } else {
      console.log('❌ Request failed:', response.data);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ Test completed!\n');
}

// Run test
testNewStructure().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
