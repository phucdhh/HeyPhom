const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

async function testCloudflareUpload(numImages) {
  console.log(`🧪 Testing Cloudflare upload with ${numImages} images...`);
  
  const testImagesDir = path.join(__dirname, 'test-images');
  const testImages = fs.readdirSync(testImagesDir)
    .filter(f => /\.(jpg|jpeg|png|heic)$/i.test(f))
    .map(f => path.join(testImagesDir, f))
    .slice(0, numImages);  // Take only first N images
  
  console.log(`📤 Uploading ${testImages.length} images...`);
  
  const form = new FormData();
  
  // Add files
  testImages.forEach(imagePath => {
    form.append('files', fs.createReadStream(imagePath));
  });
  
  // Add metadata
  form.append('quality', 'low');
  form.append('formats', 'usdz');
  
  // Use Cloudflare URL
  const url = 'https://heyphom.truyenthong.edu.vn/api/upload';
  
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
  
  return new Promise((resolve, reject) => {
    const request = form.submit(url, (err, res) => {
      if (err) {
        console.error('❌ Request error:', err.message);
        reject(err);
        return;
      }
      
      console.log('📡 Response status:', res.statusCode);
      console.log('📡 Response headers:', JSON.stringify(res.headers, null, 2));
      
      let data = '';
      
      res.on('data', chunk => {
        data += chunk.toString();
      });
      
      res.on('end', () => {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`⏱️  Request completed in ${elapsed}s`);
        console.log('📄 Response:', data);
        
        try {
          const json = JSON.parse(data);
          if (json.success) {
            console.log('✅ Upload successful!');
            console.log('🆔 Session ID:', json.data?.sessionId);
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
  });
}

// Test with different sizes
const numImages = parseInt(process.argv[2]) || 30;

testCloudflareUpload(numImages)
  .then(() => {
    console.log('\n✅ Test completed');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ Test failed:', err);
    process.exit(1);
  });
