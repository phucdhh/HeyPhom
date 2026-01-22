/**
 * Google Drive Public Folder Handler
 * Fetch file list from publicly shared Google Drive folders
 */

const axios = require('axios')

/**
 * Fastify route plugin for Google Drive operations
 */
async function gdriveRoutes(fastify, options) {
  /**
   * GET /api/gdrive/list/:folderId
   * List files in a publicly accessible Google Drive folder
   */
  fastify.get('/list/:folderId', async (request, reply) => {
    try {
      const { folderId } = request.params
      
      if (!folderId) {
        return reply.status(400).send({ error: 'Folder ID is required' })
      }
      
      console.log(`📁 Fetching Google Drive folder: ${folderId}`)
      
      // Use Google Drive API v3 to list files in folder
      // This works for publicly shared folders without authentication
      const apiUrl = `https://www.googleapis.com/drive/v3/files`
      const params = {
        q: `'${folderId}' in parents and trashed=false`,
        fields: 'files(id,name,mimeType,size,webContentLink,thumbnailLink)',
        key: process.env.GOOGLE_API_KEY || 'AIzaSyDummyKeyForPublicAccess' // Fallback for public folders
      }
      
      let files = []
      
      // Try with API key first (if available)
      try {
        const response = await axios.get(apiUrl, { params })
        files = response.data.files || []
        console.log(`✅ Found ${files.length} files via API`)
      } catch (apiError) {
        console.log('❌ API failed, trying alternative method...')
        
        // Fallback: Try to fetch folder page and parse HTML
        // This is a workaround for folders without API key
        try {
          const folderUrl = `https://drive.google.com/drive/folders/${folderId}`
          const response = await axios.get(folderUrl)
          
          // Parse file information from HTML
          // Note: This is fragile and may break if Google changes their HTML
          const matches = response.data.match(/"([^"]+\.(?:jpg|jpeg|png|webp|gif))"/gi)
          
          if (matches && matches.length > 0) {
            files = matches.map((match, index) => {
              const fileName = match.replace(/"/g, '')
              return {
                id: `file_${index}`,
                name: fileName,
                mimeType: 'image/jpeg',
                size: 0,
                webContentLink: `https://drive.google.com/uc?export=download&id=${folderId}/${fileName}`,
                thumbnailLink: null
              }
            })
            console.log(`✅ Parsed ${files.length} files from HTML`)
          } else {
            throw new Error('No files found in folder. Make sure folder is publicly accessible.')
          }
        } catch (parseError) {
          throw new Error(`Cannot access folder. Please ensure it's shared as "Anyone with the link can view"`)
        }
      }
      
      // Filter for image files only
      const imageFiles = files.filter(file => {
        const isImage = file.mimeType && file.mimeType.startsWith('image/')
        const hasImageExt = /\.(jpg|jpeg|png|webp|gif|bmp)$/i.test(file.name)
        return isImage || hasImageExt
      })
      
      if (imageFiles.length === 0) {
        return reply.status(404).send({ 
          error: 'No image files found in this folder',
          totalFiles: files.length 
        })
      }
      
      // Convert to format compatible with our system
      const processedFiles = imageFiles.map(file => ({
        id: file.id,
        name: file.name,
        size: parseInt(file.size) || 0,
        download_url: file.webContentLink || `https://drive.google.com/uc?id=${file.id}&export=download`,
        thumbnail_url: file.thumbnailLink,
        type: 'image'
      }))
      
      console.log(`✅ Returning ${processedFiles.length} image files`)
      
      reply.send({
        success: true,
        folderId,
        fileCount: processedFiles.length,
        files: processedFiles
      })
      
    } catch (error) {
      console.error('Google Drive list error:', error)
      reply.status(500).send({ 
        error: 'Failed to fetch folder contents',
        message: error.message,
        suggestion: 'Ensure folder is shared as "Anyone with the link can view"'
      })
    }
  })

  /**
   * GET /api/gdrive/download/:fileId
   * Proxy to download a file from Google Drive (bypass CORS)
   */
  fastify.get('/download/:fileId', async (request, reply) => {
    try {
      const { fileId } = request.params
      
      if (!fileId) {
        return reply.status(400).send({ error: 'File ID is required' })
      }
      
      console.log(`📥 Downloading file from Google Drive: ${fileId}`)
      
      // Try multiple download methods
      const downloadUrls = [
        // Method 1: Direct download link (works for most public files)
        `https://drive.google.com/uc?export=download&id=${fileId}`,
        // Method 2: API endpoint (requires API key but more reliable)
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${process.env.GOOGLE_API_KEY}`
      ]
      
      let lastError = null
      
      for (const downloadUrl of downloadUrls) {
        try {
          const response = await axios.get(downloadUrl, {
            responseType: 'arraybuffer',
            maxContentLength: 50 * 1024 * 1024, // 50MB max
            timeout: 30000, // 30 seconds
            maxRedirects: 5,
            validateStatus: (status) => status === 200 || status === 302 || status === 307
          })
          
          // Set appropriate headers
          const contentType = response.headers['content-type'] || 'image/jpeg'
          reply.header('Content-Type', contentType)
          reply.header('Access-Control-Allow-Origin', '*')
          reply.header('Cache-Control', 'public, max-age=3600')
          
          console.log(`✅ Downloaded file ${fileId} (${response.data.byteLength} bytes)`)
          return reply.send(Buffer.from(response.data))
          
        } catch (err) {
          lastError = err
          console.log(`⚠️ Download method failed: ${err.message}`)
          continue
        }
      }
      
      // All methods failed
      throw lastError || new Error('All download methods failed')
      
    } catch (error) {
      console.error('Google Drive download error:', error.message)
      reply.status(500).send({ 
        error: 'Failed to download file',
        message: error.message,
        suggestion: 'File may not be publicly accessible or API quota exceeded'
      })
    }
  })
}

module.exports = gdriveRoutes
