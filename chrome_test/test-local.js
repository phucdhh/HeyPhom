const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

async function testLocalUpload() {
  console.log('🧪 Testing local backend upload (bypass Cloudflare)...');
  
  const testImagesDir = path.join(__dirname, 'test-images');
  const testImages = fs.readdirSync(testImagesDir)
    .filter(f => /\.(jpg|jpeg|png|heic)$/i.test(f))
    .map(f => path.join(testImagesDir, f));
  
  console.log(`📤 Uploading ${testImages.length} images...`);
  
  const form = new FormData();
  
  // Add files
  testImages.forEach(imagePath => {
    form.append('files', fs.createReadStream(imagePath));
  });
  
  // Add metadata
  form.append('quality', 'low');
  form.append('formats', 'usdz,obj,stl');
  
  // Use LOCAL IP instead of Cloudflare tunnel
  const url = 'http://192.168.1.100:4444/api/upload';
  
  console.log('🌐 Sending request to:', url);
  
  // Get length asynchronously
  const contentLength = await new Promise((resolve, reject) => {
    form.getLength((err, length) => {
      if (err) reject(err);
      else resolve(length);
    });
  });
  console.log(`📊 Total size: ${(contentLength / 1024 / 1024).toFixed(2)} MB`);
  
  const startTime = Date.now();
  let lastProgress = 0;
  
  return new Promise((resolve, reject) => {
    const request = form.submit(url, (err, res) => {
      if (err) {
        console.error('❌ Request error:', err.message);
        reject(err);
        return;
      }
      
      console.log('📡 Response status:', res.statusCode);
      console.log('📡 Response headers:', res.headers);
      
      let data = '';
      
      res.on('data', chunk => {
        data += chunk.toString();
      });
      
      res.on('end', () => {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`⏱️  Upload completed in ${elapsed}s`);
        console.log('📄 Response:', data);
        
        try {
          const json = JSON.parse(data);
          if (json.success) {
            console.log('✅ Upload successful!');
            console.log('🆔 Job ID:', json.jobId);
            resolve(json);
          } else {
            console.log('⚠️  Upload failed:', json.message || json.error);
            resolve(json);
          }
        } catch (e) {
          console.log('⚠️  Could not parse response as JSON');
          resolve(data);
        }
      });
    });
    
    // Track upload progress
    let uploaded = 0;
    request.on('data', chunk => {
      uploaded += chunk.length;
      const progress = Math.floor((uploaded / contentLength) * 100);
      
      if (progress > lastProgress && progress % 10 === 0) {
        console.log(`📤 Upload progress: ${progress}%`);
        lastProgress = progress;
      }
    });
  });
}

// Run test
testLocalUpload()
  .then(() => {
    console.log('\n✅ Test completed');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ Test failed:', err);
    process.exit(1);
  });
