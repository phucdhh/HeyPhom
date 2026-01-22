#!/usr/bin/env node

/**
 * Test GitHub Dataset Import
 * Tests the full flow: API call -> Monitor progress -> Check results
 */

const https = require('https');
const http = require('http');

const API_BASE = 'http://localhost:4444';
const GITHUB_REPO = {
  owner: 'alicevision',
  repo: 'dataset_monstree',
  branch: 'master',
  path: 'full',
  quality: 'high',
  formats: ['usdz', 'obj', 'stl']
};

// Helper: Make HTTP request
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const lib = urlObj.protocol === 'https:' ? https : http;
    
    const reqOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    };

    const req = lib.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
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

// Helper: Get GitHub files
async function getGitHubFiles(owner, repo, branch, path) {
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`;
  console.log(`📥 Fetching files from GitHub: ${apiUrl}`);
  
  const response = await makeRequest(apiUrl, {
    headers: {
      'User-Agent': 'HeyPhom-Test'
    }
  });
  
  if (!Array.isArray(response)) {
    throw new Error('Invalid response from GitHub API');
  }
  
  const imageFiles = response.filter(file => 
    /\.(jpg|jpeg|png|heic)$/i.test(file.name)
  );
  
  console.log(`✅ Found ${imageFiles.length} images`);
  return imageFiles;
}

// Helper: Monitor job status
async function monitorJob(sessionId) {
  console.log(`\n👀 Monitoring job: ${sessionId}`);
  
  let lastProgress = -1;
  let lastStage = '';
  let attempts = 0;
  const maxAttempts = 60; // 5 minutes max (5s intervals)
  
  return new Promise((resolve, reject) => {
    const interval = setInterval(async () => {
      attempts++;
      
      try {
        const response = await makeRequest(`${API_BASE}/api/jobs/${sessionId}`);
        
        if (!response.success) {
          clearInterval(interval);
          reject(new Error('Failed to fetch job status'));
          return;
        }
        
        const job = response.data;
        
        // Log progress changes
        if (job.progress !== lastProgress) {
          console.log(`📊 Progress: ${job.progress}%`);
          lastProgress = job.progress;
        }
        
        // Log stage changes
        const currentStage = job.currentStage || job.stage || '';
        if (currentStage !== lastStage) {
          console.log(`📝 Stage: ${currentStage}`);
          lastStage = currentStage;
        }
        
        // Check completion
        if (job.status === 'completed') {
          clearInterval(interval);
          console.log('\n✅ Job completed!');
          console.log('Results:', JSON.stringify(job.results, null, 2));
          resolve(job);
        } else if (job.status === 'failed') {
          clearInterval(interval);
          console.log('\n❌ Job failed:', job.error);
          reject(new Error(job.error));
        } else if (attempts >= maxAttempts) {
          clearInterval(interval);
          console.log('\n⏱️  Timeout waiting for job completion');
          reject(new Error('Timeout'));
        }
      } catch (error) {
        console.error('Error checking job status:', error.message);
      }
    }, 5000); // Check every 5 seconds
  });
}

// Main test
async function testGitHubDataset() {
  console.log('🚀 Testing GitHub Dataset Import\n');
  
  try {
    // Step 1: Get files from GitHub
    console.log('Step 1: Fetching files from GitHub...');
    const files = await getGitHubFiles(
      GITHUB_REPO.owner,
      GITHUB_REPO.repo,
      GITHUB_REPO.branch,
      GITHUB_REPO.path
    );
    
    if (files.length < 30) {
      throw new Error(`Insufficient images: ${files.length} (minimum 30)`);
    }
    
    // Step 2: Send to backend
    console.log('\nStep 2: Sending to backend...');
    const payload = {
      source: 'github',
      owner: GITHUB_REPO.owner,
      repo: GITHUB_REPO.repo,
      branch: GITHUB_REPO.branch,
      path: GITHUB_REPO.path,
      quality: GITHUB_REPO.quality,
      formats: GITHUB_REPO.formats,
      images: files.map(f => ({
        name: f.name,
        download_url: f.download_url
      }))
    };
    
    const response = await makeRequest(`${API_BASE}/api/github-dataset`, {
      method: 'POST',
      body: payload
    });
    
    if (!response.success) {
      throw new Error(response.message || 'Backend rejected dataset');
    }
    
    console.log(`✅ Backend accepted dataset`);
    console.log(`Session ID: ${response.sessionId}`);
    console.log(`Images: ${response.uploadedCount || response.imageCount}`);
    console.log(`Quality: ${response.quality}`);
    console.log(`Estimated Time: ${response.estimatedTime}`);
    
    // Step 3: Monitor progress
    const result = await monitorJob(response.sessionId);
    
    console.log('\n🎉 Test completed successfully!');
    console.log(`\nDownload results at:`);
    if (result.results) {
      Object.entries(result.results).forEach(([format, info]) => {
        const url = typeof info === 'string' ? info : info.url;
        console.log(`  ${format.toUpperCase()}: ${API_BASE}${url}`);
      });
    }
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run test
testGitHubDataset();
