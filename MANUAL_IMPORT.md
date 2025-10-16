# Manual Import API - Frontend Guide

Návod pro implementaci manuálního importu dat na frontendu.

## Endpoint

```
POST /api/v1/harvest/manual-import
```

## Autentifikace

✅ Vyžaduje JWT token v hlavičce

## Request

### Headers
```
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: multipart/form-data (automaticky nastaveno při použití FormData)
```

### Body
- FormData s polem `file` obsahujícím ZIP soubor
- Max velikost: 500 MB

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

### 1. React Component s file input

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
    
    // Validace na frontendu
    if (selectedFile) {
      if (!selectedFile.name.toLowerCase().endsWith('.zip')) {
        setError('Prosím vyberte ZIP soubor');
        return;
      }
      
      // Max 500 MB
      if (selectedFile.size > 500 * 1024 * 1024) {
        setError('Soubor je příliš velký. Maximum je 500 MB.');
        return;
      }
      
      setFile(selectedFile);
      setError('');
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Prosím vyberte soubor');
      return;
    }

    setUploading(true);
    setError('');
    setMessage('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const token = localStorage.getItem('token'); // nebo odkud získáváš token

      const response = await axios.post(
        'http://localhost:3000/api/v1/harvest/manual-import',
        formData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            // 'Content-Type': 'multipart/form-data' - axios nastaví automaticky
          },
          onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            setMessage(`Nahrávání: ${percentCompleted}%`);
          }
        }
      );

      setMessage(`Import spuštěn! Soubor: ${response.data.filename}`);
      setFile(null);
      
      // Reset file input
      document.getElementById('file-input').value = '';

    } catch (err) {
      setError(err.response?.data?.error || 'Chyba při nahrávání souboru');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="manual-import">
      <h2>Manuální import dat</h2>
      
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
            <p>Vybraný soubor: {file.name}</p>
            <p>Velikost: {(file.size / (1024 * 1024)).toFixed(2)} MB</p>
          </div>
        )}
      </div>

      <button 
        onClick={handleUpload} 
        disabled={!file || uploading}
      >
        {uploading ? 'Nahrávání...' : 'Nahrát a importovat'}
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
        <p>ℹ️ Import běží na pozadí. Výsledky naleznete v konzoli serveru.</p>
        <p>📦 Maximální velikost souboru: 500 MB</p>
        <p>📄 Podporovaný formát: ZIP</p>
      </div>
    </div>
  );
}

export default ManualImport;
```

### 2. Vanilla JavaScript s fetch

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

// Použití
document.getElementById('upload-btn').addEventListener('click', async () => {
  const fileInput = document.getElementById('file-input');
  const file = fileInput.files[0];

  if (!file) {
    alert('Prosím vyberte soubor');
    return;
  }

  if (!file.name.endsWith('.zip')) {
    alert('Prosím vyberte ZIP soubor');
    return;
  }

  try {
    const result = await uploadZipFile(file);
    alert(`Import spuštěn! Soubor: ${result.filename}`);
  } catch (error) {
    alert(`Chyba: ${error.message}`);
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
        alert('Prosím nahrajte ZIP soubor');
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
        alert(`Import spuštěn! ${data.message}`);
      } else {
        alert(`Chyba: ${data.error}`);
      }
    } catch (error) {
      alert(`Chyba: ${error.message}`);
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
        <p>📦 Přetáhněte ZIP soubor sem</p>
        <p>nebo klikněte pro výběr souboru</p>
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

### 4. Upload Progress s Axios

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

      alert(`Import spuštěn! ${response.data.message}`);
      
    } catch (error) {
      alert(`Chyba: ${error.response?.data?.error || error.message}`);
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

### 1. Validace na frontendu
```javascript
function validateZipFile(file) {
  const errors = [];
  
  // Kontrola typu
  if (!file.name.toLowerCase().endsWith('.zip')) {
    errors.push('Soubor musí být ve formátu ZIP');
  }
  
  // Kontrola velikosti (500 MB)
  if (file.size > 500 * 1024 * 1024) {
    errors.push('Soubor je příliš velký (max 500 MB)');
  }
  
  // Kontrola že není prázdný
  if (file.size === 0) {
    errors.push('Soubor je prázdný');
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
    showError('Soubor je příliš velký');
  } else if (error.response?.status === 400) {
    showError(error.response.data.error);
  } else if (error.response?.status === 401) {
    showError('Nejste přihlášeni');
    redirectToLogin();
  } else {
    showError('Nastala chyba při nahrávání');
  }
}
```

### 3. UX Improvements
```jsx
// Zobraz velikost souboru v lidsky čitelném formátu
function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

// Prevence opuštění stránky během uploadu
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

### Soubor se nenahraje
- Zkontroluj že používáš správný Content-Type (multipart/form-data)
- Ověř že pole se jmenuje `file`
- Zkontroluj JWT token v Authorization hlavičce

### 413 Payload Too Large
- Soubor je větší než 500 MB
- Zkontroluj velikost před uplodem

### CORS chyby
- Ověř že backend má správně nakonfigurovaný CORS
- Zkontroluj že Authorization header je povolený

### Timeout
- Pro velké soubory zvětši timeout v axios config
```javascript
axios.post(url, formData, {
  timeout: 300000 // 5 minut
})
```
