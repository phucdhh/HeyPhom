const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const BATCH_SIZE = 19; // ~80MB per batch

async function testChunkedUpload() {
  console.log('🧪 Testing chunked upload via Cloudflare...\n');
  
  const testImagesDir = path.join(__dirname, 'test-images');
  const allImages = fs.readdirSync(testImagesDir)
    .filter(f => /\.(jpg|jpeg|png|heic)$/i.test(f))
    .map(f => path.join(testImagesDir, f));
  
  console.log(`📦 Found ${allImages.length} images`);
  
  // Split into batches
  const batches = [];
  for (let i = 0; i < allImages.length; i += BATCH_SIZE) {
    batches.push(allImages.slice(i, i + BATCH_SIZE));
  }
  
  console.log(`📦 Split into ${batches.length} batches\n`);
  
  let sessionId = null;
  
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const batchNum = i + 1;
    const isLastBatch = i === batches.length - 1;
    
    console.log(`📤 Batch ${batchNum}/${batches.length}: ${batch.length} files`);
    
    const form = new FormData();
    
    // Add files
    batch.forEach(imagePath => {
      form.append('files', fs.createReadStream(imagePath));
    });
    
    // Add metadata
    form.append('quality', 'low');
    form.append('formats', 'usdz,obj,stl');
    
    // If not last batch, mark as more chunks coming
    if (!isLastBatch) {
      form.append('moreChunks', 'true');
    }
    
    // Get content length
    const contentLength = await new Promise((resolve, reject) => {
      form.getLength((err, length) => {
        if (err) reject(err);
        else resolve(length);
      });
    });
    
    console.log(`  Size: ${(contentLength / 1024 / 1024).toFixed(2)} MB`);
    if (sessionId) {
      console.log(`  Using session: ${sessionId}`);
    }
    
    const url = 'http://127.0.0.1:4444/api/upload';
    const startTime = Date.now();
    
    const result = await new Promise((resolve, reject) => {
      const headers = form.getHeaders();
      
      // Add X-Session-Id header if continuing
      if (sessionId) {
        headers['X-Session-Id'] = sessionId;
      }
      
      const request = form.submit({
        host: '127.0.0.1',
        port: 4444,
        path: '/api/upload',
        protocol: 'http:',
        headers: headers
      }, (err, res) => {
        if (err) {
          console.error('  ❌ Request error:', err.message);
          reject(err);
          return;
        }
        
        console.log(`  📡 Status: ${res.statusCode}`);
        
        let data = '';
        
        res.on('data', chunk => {
          data += chunk.toString();
        });
        
        res.on('end', () => {
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
          console.log(`  ⏱️  Completed in ${elapsed}s`);
          
          try {
            const json = JSON.parse(data);
            
            if (json.success) {
              console.log(`  ✅ Success: ${json.message}`);
              if (json.data?.sessionId) {
                console.log(`  🆔 Session ID: ${json.data.sessionId}`);
              }
              resolve(json);
            } else {
              console.log(`  ⚠️  Failed: ${json.message || json.error}`);
              reject(new Error(json.message || json.error));
            }
          } catch (e) {
            console.log(`  ⚠️  Could not parse response`);
            console.log(`  Response: ${data.substring(0, 200)}`);
            reject(new Error('Invalid JSON'));
          }
        });
      });
    });
    
    // Get session ID from first batch
    if (i === 0 && result.data?.sessionId) {
      sessionId = result.data.sessionId;
    }
    
    console.log('');
  }
  
  console.log('✅ All batches uploaded successfully!');
  console.log(`🆔 Final session: ${sessionId}`);
}

// Run test
testChunkedUpload()
  .then(() => {
    console.log('\n✅ Test completed');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ Test failed:', err.message);
    process.exit(1);
  });
