# Manual Import API - Frontend Guide

Guide for implementing manual data import on frontend.

## Endpoint

```
POST /api/v1/harvest/manual-import
```

## Authentication

✅ Requires JWT token in header

## Request

### Headers
```
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: multipart/form-data (automatically set when using FormData)
```

### Body
- FormData with `file` field containing ZIP file
- Max size: 500 MB

## Response

### Success (200 OK)
```json
{
  "message": "Import started",
  "filename": "manual_1697123456789_data.zip",
  "filesize": 15234567,
  "status": "processing"
}
```

### Error Responses

#### 400 Bad Request - No file
```json
{
  "error": "No file uploaded. Please provide a ZIP file in the \"file\" field."
}
```

#### 400 Bad Request - Invalid file type
```json
{
  "error": "Only ZIP files are allowed"
}
```

#### 413 Payload Too Large
```json
{
  "error": "File too large. Maximum size is 500 MB."
}
```

## Frontend Implementation

### 1. React Component with file input

```jsx
import { useState } from 'react';
import axios from 'axios';

function ManualImport() {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    
    // Frontend validation
    if (selectedFile) {
      if (!selectedFile.name.toLowerCase().endsWith('.zip')) {
        setError('Please select a ZIP file');
        return;
      }
      
      // Max 500 MB
      if (selectedFile.size > 500 * 1024 * 1024) {
        setError('File is too large. Maximum is 500 MB.');
        return;
      }
      
      setFile(selectedFile);
      setError('');
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file');
      return;
    }

    setUploading(true);
    setError('');
    setMessage('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const token = localStorage.getItem('token'); // or wherever you get token from

      const response = await axios.post(
        'http://localhost:3000/api/v1/harvest/manual-import',
        formData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            // 'Content-Type': 'multipart/form-data' - axios sets automatically
          },
          onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            setMessage(`Uploading: ${percentCompleted}%`);
          }
        }
      );

      setMessage(`Import started! File: ${response.data.filename}`);
      setFile(null);
      
      // Reset file input
      document.getElementById('file-input').value = '';

    } catch (err) {
      setError(err.response?.data?.error || 'Error uploading file');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="manual-import">
      <h2>Manual Data Import</h2>
      
      <div className="file-input-container">
        <input
          id="file-input"
          type="file"
          accept=".zip"
          onChange={handleFileChange}
          disabled={uploading}
        />
        
        {file && (
          <div className="file-info">
            <p>Selected file: {file.name}</p>
            <p>Size: {(file.size / (1024 * 1024)).toFixed(2)} MB</p>
          </div>
        )}
      </div>

      <button 
        onClick={handleUpload} 
        disabled={!file || uploading}
      >
        {uploading ? 'Uploading...' : 'Upload and Import'}
      </button>

      {message && (
        <div className="success-message">
          ✅ {message}
        </div>
      )}

      {error && (
        <div className="error-message">
          ❌ {error}
        </div>
      )}

      <div className="info">
        <p>ℹ️ Import runs in background. Results can be found in server console.</p>
        <p>📦 Maximum file size: 500 MB</p>
        <p>📄 Supported format: ZIP</p>
      </div>
    </div>
  );
}

export default ManualImport;
```

### 2. Vanilla JavaScript with fetch

```javascript
async function uploadZipFile(file) {
  const formData = new FormData();
  formData.append('file', file);

  const token = localStorage.getItem('token');

  try {
    const response = await fetch('http://localhost:3000/api/v1/harvest/manual-import', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Upload failed');
    }

    const data = await response.json();
    console.log('Import started:', data);
    return data;

  } catch (error) {
    console.error('Upload error:', error);
    throw error;
  }
}

// Usage
document.getElementById('upload-btn').addEventListener('click', async () => {
  const fileInput = document.getElementById('file-input');
  const file = fileInput.files[0];

  if (!file) {
    alert('Please select a file');
    return;
  }

  if (!file.name.endsWith('.zip')) {
    alert('Please select a ZIP file');
    return;
  }

  try {
    const result = await uploadZipFile(file);
    alert(`Import started! File: ${result.filename}`);
  } catch (error) {
    alert(`Error: ${error.message}`);
  }
});
```

### 3. Drag & Drop Implementation

```jsx
import { useState, useRef } from 'react';

function DragDropImport() {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      
      if (!file.name.toLowerCase().endsWith('.zip')) {
        alert('Please upload a ZIP file');
        return;
      }

      await handleUpload(file);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      handleUpload(file);
    }
  };

  const handleUpload = async (file) => {
    const formData = new FormData();
    formData.append('file', file);

    const token = localStorage.getItem('token');

    try {
      const response = await fetch('/api/v1/harvest/manual-import', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const data = await response.json();
      
      if (response.ok) {
        alert(`Import started! ${data.message}`);
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      alert(`Error: ${error.message}`);
    }
  };

  return (
    <div
      className={`drop-zone ${isDragging ? 'dragging' : ''}`}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={() => fileInputRef.current?.click()}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".zip"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />
      
      <div className="drop-zone-content">
        <p>📦 Drag and drop ZIP file here</p>
        <p>or click to select file</p>
      </div>
    </div>
  );
}

// CSS
const styles = `
.drop-zone {
  border: 2px dashed #ccc;
  border-radius: 8px;
  padding: 40px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s;
}

.drop-zone:hover {
  border-color: #007bff;
  background-color: #f8f9fa;
}

.drop-zone.dragging {
  border-color: #007bff;
  background-color: #e3f2fd;
}
`;
```

### 4. Upload Progress with Axios

```jsx
import { useState } from 'react';
import axios from 'axios';

function ProgressUpload() {
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (file) => {
    setUploading(true);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append('file', file);

    const token = localStorage.getItem('token');

    try {
      const response = await axios.post(
        '/api/v1/harvest/manual-import',
        formData,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          },
          onUploadProgress: (progressEvent) => {
            const progress = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            setUploadProgress(progress);
          }
        }
      );

      alert(`Import started! ${response.data.message}`);
      
    } catch (error) {
      alert(`Error: ${error.response?.data?.error || error.message}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      {uploading && (
        <div className="progress-bar">
          <div 
            className="progress-fill" 
            style={{ width: `${uploadProgress}%` }}
          >
            {uploadProgress}%
          </div>
        </div>
      )}
    </div>
  );
}
```

## Best Practices

### 1. Frontend Validation
```javascript
function validateZipFile(file) {
  const errors = [];
  
  // Type check
  if (!file.name.toLowerCase().endsWith('.zip')) {
    errors.push('File must be in ZIP format');
  }
  
  // Size check (500 MB)
  if (file.size > 500 * 1024 * 1024) {
    errors.push('File is too large (max 500 MB)');
  }
  
  // Check not empty
  if (file.size === 0) {
    errors.push('File is empty');
  }
  
  return errors;
}
```

### 2. Error Handling
```javascript
try {
  const response = await uploadFile(file);
  showSuccess(response.message);
} catch (error) {
  if (error.response?.status === 413) {
    showError('File is too large');
  } else if (error.response?.status === 400) {
    showError(error.response.data.error);
  } else if (error.response?.status === 401) {
    showError('Not logged in');
    redirectToLogin();
  } else {
    showError('Error occurred during upload');
  }
}
```

### 3. UX Improvements
```jsx
// Display file size in human-readable format
function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

// Prevent page leave during upload
useEffect(() => {
  const handleBeforeUnload = (e) => {
    if (uploading) {
      e.preventDefault();
      e.returnValue = '';
    }
  };
  
  window.addEventListener('beforeunload', handleBeforeUnload);
  return () => window.removeEventListener('beforeunload', handleBeforeUnload);
}, [uploading]);
```

## Troubleshooting

### File not uploading
- Check you're using correct Content-Type (multipart/form-data)
- Verify field name is `file`
- Check JWT token in Authorization header

### 413 Payload Too Large
- File is larger than 500 MB
- Check size before upload

### CORS errors
- Verify backend has CORS configured correctly
- Check that Authorization header is allowed

### Timeout
- For large files increase timeout in axios config
```javascript
axios.post(url, formData, {
  timeout: 300000 // 5 minutes
})
```
