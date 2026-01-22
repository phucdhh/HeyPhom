# HeyPhom API Documentation

## Base URL

```
Production:  https://heyphom.truyenthong.edu.vn
Local:       http://localhost:3333
```

## API Version

Current version: `v1`

---

## Authentication (Optional)

If `API_KEY_REQUIRED=true` in `.env`, include API key in headers:

```http
Authorization: Bearer YOUR_API_KEY
```

---

## Endpoints

### 1. Health Check

**GET** `/health`

Check if the API server is running.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-01-18T12:00:00Z",
  "uptime": 3600,
  "version": "1.0.0"
}
```

---

### 2. API Info

**GET** `/api/info`

Get API information and system status.

**Response:**
```json
{
  "name": "HeyPhom API",
  "version": "1.0.0",
  "description": "Photogrammetry Processing API",
  "system": {
    "platform": "darwin",
    "arch": "arm64",
    "cpus": 8,
    "memory": {
      "total": "24 GB",
      "free": "12 GB",
      "used": "12 GB"
    }
  },
  "limits": {
    "maxImagesPerSession": 300,
    "maxFileSizeMB": 10,
    "maxTotalSizeGB": 3,
    "allowedFormats": ["jpg", "jpeg", "png", "heic", "heif"]
  }
}
```

---

### 3. Upload Images

**POST** `/api/upload`

Upload images for 3D reconstruction.

**Request:**
- Content-Type: `multipart/form-data`
- Max total size: 3GB (configurable)
- Max file size: 10MB per image (configurable)

**Form Fields:**
- `files` (required): Image files (multiple)
- `quality` (optional): Processing quality - `low`, `medium`, `high`, `ultra` (default: `high`)
- `formats` (optional): Output formats - comma-separated: `usdz`, `obj`, `stl` (default: `usdz,obj,stl`)
- `email` (optional): Email for notification when complete
- `webhook` (optional): Webhook URL for completion notification

**Example with cURL:**
```bash
curl -X POST http://localhost:3333/api/upload \
  -F "files=@image001.jpg" \
  -F "files=@image002.jpg" \
  -F "files=@image003.jpg" \
  -F "quality=high" \
  -F "formats=usdz,obj,stl"
```

**Example with JavaScript:**
```javascript
const formData = new FormData();
formData.append('quality', 'high');
formData.append('formats', 'usdz,obj,stl');

// Add multiple files
files.forEach(file => {
  formData.append('files', file);
});

const response = await fetch('http://localhost:3333/api/upload', {
  method: 'POST',
  body: formData
});

const data = await response.json();
console.log(data);
```

**Response (202 Accepted):**
```json
{
  "success": true,
  "message": "Upload successful, processing started",
  "data": {
    "sessionId": "sess_20260118_abc123",
    "uploadedCount": 150,
    "totalSize": "1.2 GB",
    "quality": "high",
    "formats": ["usdz", "obj", "stl"],
    "estimatedTime": "15-20 minutes",
    "statusUrl": "/api/jobs/sess_20260118_abc123"
  }
}
```

**Error Response (400 Bad Request):**
```json
{
  "success": false,
  "error": "Invalid file format",
  "details": {
    "invalidFiles": ["document.pdf"],
    "allowedFormats": ["jpg", "jpeg", "png", "heic", "heif"]
  }
}
```

---

### 4. Get Job Status

**GET** `/api/jobs/:sessionId`

Check the processing status of a session.

**Parameters:**
- `sessionId` (required): Session ID from upload response

**Example:**
```bash
curl http://localhost:3333/api/jobs/sess_20260118_abc123
```

**Response (Processing):**
```json
{
  "success": true,
  "data": {
    "sessionId": "sess_20260118_abc123",
    "status": "processing",
    "progress": 45,
    "stage": "mesh_generation",
    "stages": {
      "upload": "completed",
      "validation": "completed",
      "feature_extraction": "completed",
      "point_cloud": "completed",
      "mesh_generation": "in_progress",
      "texture_mapping": "pending",
      "export": "pending"
    },
    "startedAt": "2026-01-18T12:00:00Z",
    "estimatedCompletion": "2026-01-18T12:18:00Z",
    "imageCount": 150,
    "quality": "high"
  }
}
```

**Response (Completed):**
```json
{
  "success": true,
  "data": {
    "sessionId": "sess_20260118_abc123",
    "status": "completed",
    "progress": 100,
    "startedAt": "2026-01-18T12:00:00Z",
    "completedAt": "2026-01-18T12:17:30Z",
    "processingTime": "17 minutes 30 seconds",
    "results": {
      "usdz": {
        "url": "/api/download/sess_20260118_abc123/model.usdz",
        "size": "245 MB",
        "vertexCount": 125000,
        "faceCount": 250000
      },
      "obj": {
        "url": "/api/download/sess_20260118_abc123/model.obj",
        "size": "180 MB",
        "vertexCount": 125000,
        "faceCount": 250000
      },
      "stl": {
        "url": "/api/download/sess_20260118_abc123/model.stl",
        "size": "95 MB"
      }
    },
    "expiresAt": "2026-01-19T12:17:30Z"
  }
}
```

**Response (Failed):**
```json
{
  "success": false,
  "data": {
    "sessionId": "sess_20260118_abc123",
    "status": "failed",
    "error": "Insufficient features detected",
    "details": "Not enough matching features found. Please ensure images have good overlap.",
    "startedAt": "2026-01-18T12:00:00Z",
    "failedAt": "2026-01-18T12:05:00Z"
  }
}
```

---

### 5. Download Model

**GET** `/api/download/:sessionId/:filename`

Download the generated 3D model.

**Parameters:**
- `sessionId` (required): Session ID
- `filename` (required): File name (e.g., `model.usdz`, `model.obj`, `model.stl`)

**Example:**
```bash
# Download USDZ
curl -O http://localhost:3333/api/download/sess_20260118_abc123/model.usdz

# Download OBJ with materials
curl -O http://localhost:3333/api/download/sess_20260118_abc123/model.obj
curl -O http://localhost:3333/api/download/sess_20260118_abc123/model.mtl
curl -O http://localhost:3333/api/download/sess_20260118_abc123/textures.zip

# Download STL
curl -O http://localhost:3333/api/download/sess_20260118_abc123/model.stl
```

**Response:**
- Content-Type: `application/octet-stream` or specific mime type
- Content-Disposition: `attachment; filename="model.usdz"`
- Binary file data

---

### 6. List Jobs

**GET** `/api/jobs`

Get list of all jobs (with pagination).

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20, max: 100)
- `status` (optional): Filter by status - `pending`, `processing`, `completed`, `failed`

**Example:**
```bash
curl "http://localhost:3333/api/jobs?page=1&limit=10&status=completed"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "jobs": [
      {
        "sessionId": "sess_20260118_abc123",
        "status": "completed",
        "imageCount": 150,
        "quality": "high",
        "createdAt": "2026-01-18T12:00:00Z",
        "completedAt": "2026-01-18T12:17:30Z"
      },
      // ... more jobs
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 45,
      "pages": 5
    }
  }
}
```

---

### 7. Cancel Job

**DELETE** `/api/jobs/:sessionId`

Cancel a processing job.

**Parameters:**
- `sessionId` (required): Session ID to cancel

**Example:**
```bash
curl -X DELETE http://localhost:3333/api/jobs/sess_20260118_abc123
```

**Response:**
```json
{
  "success": true,
  "message": "Job cancelled successfully",
  "data": {
    "sessionId": "sess_20260118_abc123",
    "status": "cancelled"
  }
}
```

---

### 8. Delete Session

**DELETE** `/api/sessions/:sessionId`

Delete a completed session and all its files.

**Parameters:**
- `sessionId` (required): Session ID to delete

**Example:**
```bash
curl -X DELETE http://localhost:3333/api/sessions/sess_20260118_abc123
```

**Response:**
```json
{
  "success": true,
  "message": "Session deleted successfully",
  "data": {
    "sessionId": "sess_20260118_abc123",
    "deletedFiles": 156,
    "freedSpace": "1.5 GB"
  }
}
```

---

## Status Codes

| Code | Description |
|------|-------------|
| 200 | OK - Request successful |
| 201 | Created - Resource created |
| 202 | Accepted - Request accepted for processing |
| 400 | Bad Request - Invalid parameters |
| 401 | Unauthorized - Invalid or missing API key |
| 404 | Not Found - Resource not found |
| 413 | Payload Too Large - File size exceeds limit |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error - Server error |
| 503 | Service Unavailable - Server overloaded |

---

## Webhooks

If you provide a webhook URL during upload, HeyPhom will send a POST request when processing is complete.

**Webhook Payload:**
```json
{
  "event": "job.completed",
  "sessionId": "sess_20260118_abc123",
  "status": "completed",
  "timestamp": "2026-01-18T12:17:30Z",
  "results": {
    "usdz": {
      "url": "https://heyphom.truyenthong.edu.vn/api/download/sess_20260118_abc123/model.usdz",
      "size": "245 MB"
    },
    "obj": {
      "url": "https://heyphom.truyenthong.edu.vn/api/download/sess_20260118_abc123/model.obj",
      "size": "180 MB"
    },
    "stl": {
      "url": "https://heyphom.truyenthong.edu.vn/api/download/sess_20260118_abc123/model.stl",
      "size": "95 MB"
    }
  }
}
```

**Webhook for Failed Jobs:**
```json
{
  "event": "job.failed",
  "sessionId": "sess_20260118_abc123",
  "status": "failed",
  "timestamp": "2026-01-18T12:05:00Z",
  "error": "Insufficient features detected",
  "details": "Not enough matching features found."
}
```

---

## Rate Limiting

Default rate limits (configurable in `.env`):
- **100 requests** per 15 minutes per IP
- **10 uploads** per day per IP (recommended)

Headers included in response:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642512000
```

---

## Best Practices

### 1. Image Quality
- Use high-resolution images (5+ megapixels)
- Ensure good lighting and minimal motion blur
- Capture from multiple angles (360° coverage)
- Maintain 60-80% overlap between consecutive images

### 2. Number of Images
- Minimum: 30-40 images for simple objects
- Recommended: 100-150 images for detailed objects
- Maximum: 300 images (hardware dependent)

### 3. Processing Time
- Poll status every 10-30 seconds (not every second)
- Use webhooks instead of polling when possible
- Expect 1-2 minutes per 10 images on M2 24GB

### 4. File Management
- Download results within 24 hours (auto-deleted after)
- Delete sessions after download to free up space
- Use appropriate quality settings (lower = faster)

---

## Error Codes

| Code | Message | Solution |
|------|---------|----------|
| `INVALID_FORMAT` | Unsupported file format | Use JPG, PNG, or HEIC |
| `FILE_TOO_LARGE` | File exceeds size limit | Reduce image size or quality |
| `TOO_MANY_FILES` | Too many files uploaded | Reduce number of images |
| `INSUFFICIENT_FEATURES` | Not enough features detected | Improve image quality/overlap |
| `PROCESSING_FAILED` | Processing error | Check logs or retry |
| `SESSION_NOT_FOUND` | Session doesn't exist | Verify session ID |
| `SESSION_EXPIRED` | Session has expired | Re-upload images |
| `RATE_LIMIT_EXCEEDED` | Too many requests | Wait and retry |

---

## Example Workflow

### Complete Upload → Process → Download

```javascript
// 1. Upload images
const uploadResponse = await fetch('http://localhost:3333/api/upload', {
  method: 'POST',
  body: formData
});
const { data: { sessionId } } = await uploadResponse.json();

// 2. Poll for status
const checkStatus = async () => {
  const statusResponse = await fetch(`http://localhost:3333/api/jobs/${sessionId}`);
  const { data } = await statusResponse.json();
  
  if (data.status === 'completed') {
    console.log('Processing complete!');
    return data.results;
  } else if (data.status === 'failed') {
    throw new Error(data.error);
  } else {
    console.log(`Progress: ${data.progress}%`);
    setTimeout(checkStatus, 10000); // Check again in 10s
  }
};

const results = await checkStatus();

// 3. Download models
for (const [format, info] of Object.entries(results)) {
  const response = await fetch(info.url);
  const blob = await response.blob();
  // Save file...
}

// 4. Cleanup (optional)
await fetch(`http://localhost:3333/api/sessions/${sessionId}`, {
  method: 'DELETE'
});
```

---

## Support

For issues or questions:
- Check [Troubleshooting](../README.md#-troubleshooting)
- Create issue on GitHub
- Contact: [your-email@heyphom.truyenthong.edu.vn]
