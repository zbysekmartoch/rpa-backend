# Scripts Management API

API pro správu souborů ve složce `scripts/` a podadresářích.

## 🎯 Účel

Umožňuje React frontendu spravovat scripty pro analýzy, reporty a workflow:
- Prohlížení souborů a složek
- Editace textových souborů (`.py`, `.js`, `.workflow`, `.sql`, atd.)
- Upload/download souborů
- Mazání souborů

## 🔒 Bezpečnost

### Path Traversal Protection

API implementuje několik úrovní ochrany:

1. **Normalizace cesty** - `path.normalize()` odstraní `..`, `./`, redundantní `/`
2. **Absolute path resolution** - `path.resolve()` vytvoří absolutní cestu
3. **Prefix check** - Ověří že výsledná cesta začína na `SCRIPTS_ROOT`
4. **Authentication** - Všechny endpointy vyžadují JWT token

```javascript
// ✅ Bezpečné cesty:
"analyzy/script.py"
"reports/template.docx"
"workflow.txt"

// ❌ Blokované cesty:
"../../../etc/passwd"
"/etc/passwd"
"analyzy/../../secrets.txt"
```

### Autentifikace

Všechny endpointy vyžadují Bearer token:

```javascript
headers: {
  'Authorization': `Bearer ${token}`
}
```

## 📂 Struktura Složek

```
scripts/
├── analyzy/              # Python analysis scripts
│   ├── dbsettings.py
│   ├── plot_*.py
│   └── .venv/           # Ignorováno
├── reports/             # Report templates & generator
│   ├── reporter.js
│   ├── templateM.docx
│   └── templateUZ.docx
├── old-analyzy/         # Archived scripts
└── *.workflow           # Workflow definitions
```

## 🚀 Použití z React Frontendu

### 1. Výpis souborů

```typescript
interface ScriptFile {
  name: string;
  path: string;
  type: 'file' | 'directory';
  extension?: string;
  size: number;
  mtime: string;
  isText?: boolean;
  children?: ScriptFile[];
}

async function listScripts(subdir?: string): Promise<ScriptFile[]> {
  const url = subdir 
    ? `/api/v1/scripts?subdir=${encodeURIComponent(subdir)}`
    : '/api/v1/scripts';
    
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${getToken()}`
    }
  });
  
  const data = await response.json();
  return data.items;
}

// Použití:
const allScripts = await listScripts();
const analysisScripts = await listScripts('analyzy');
const reportScripts = await listScripts('reports');
```

### 2. Načtení obsahu souboru

```typescript
async function loadFileContent(filePath: string): Promise<string> {
  const response = await fetch(
    `/api/v1/scripts/content?file=${encodeURIComponent(filePath)}`,
    {
      headers: {
        'Authorization': `Bearer ${getToken()}`
      }
    }
  );
  
  if (!response.ok) {
    throw new Error('Failed to load file');
  }
  
  const data = await response.json();
  return data.content;
}

// Použití:
const scriptCode = await loadFileContent('analyzy/plot_cenovy_odstup_b.py');
```

### 3. Uložení změn

```typescript
async function saveFileContent(
  filePath: string, 
  content: string
): Promise<void> {
  const response = await fetch('/api/v1/scripts/content', {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${getToken()}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      file: filePath,
      content: content
    })
  });
  
  if (!response.ok) {
    throw new Error('Failed to save file');
  }
}

// Použití:
await saveFileContent(
  'analyzy/script.py',
  '#!/usr/bin/env python3\nprint("Updated")'
);
```

### 4. Upload nového souboru

```typescript
async function uploadFile(
  file: File, 
  targetDir: string
): Promise<void> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('targetPath', targetDir);
  
  const response = await fetch('/api/v1/scripts/upload', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${getToken()}`
    },
    body: formData
  });
  
  if (!response.ok) {
    throw new Error('Upload failed');
  }
}

// Použití:
const fileInput = document.querySelector('input[type="file"]');
await uploadFile(fileInput.files[0], 'analyzy');
```

### 5. Stažení souboru

```typescript
async function downloadFile(filePath: string): Promise<void> {
  const url = `/api/v1/scripts/download?file=${encodeURIComponent(filePath)}`;
  
  // Otevři v novém okně nebo použij fetch + blob
  window.open(url + `&token=${getToken()}`, '_blank');
  
  // Nebo s fetch:
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${getToken()}`
    }
  });
  
  const blob = await response.blob();
  const downloadUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = filePath.split('/').pop();
  a.click();
}
```

### 6. Smazání souboru

```typescript
async function deleteFile(filePath: string): Promise<void> {
  const response = await fetch(
    `/api/v1/scripts?file=${encodeURIComponent(filePath)}`,
    {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${getToken()}`
      }
    }
  );
  
  if (!response.ok) {
    throw new Error('Delete failed');
  }
}

// Použití s potvrzením:
if (confirm('Opravdu smazat?')) {
  await deleteFile('analyzy/old_script.py');
}
```

## 🎨 React Komponenta - Příklad

```tsx
import { useState, useEffect } from 'react';

function ScriptEditor() {
  const [files, setFiles] = useState<ScriptFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(false);

  // Načti seznam souborů
  useEffect(() => {
    loadFiles();
  }, []);

  async function loadFiles() {
    const data = await listScripts('analyzy');
    setFiles(data);
  }

  // Načti obsah vybraného souboru
  async function handleFileSelect(filePath: string) {
    setLoading(true);
    try {
      const fileContent = await loadFileContent(filePath);
      setSelectedFile(filePath);
      setContent(fileContent);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  // Ulož změny
  async function handleSave() {
    if (!selectedFile) return;
    
    setLoading(true);
    try {
      await saveFileContent(selectedFile, content);
      alert('Uloženo!');
    } catch (err) {
      alert('Chyba při ukládání');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="script-editor">
      <aside className="file-list">
        <h3>Scripty</h3>
        {files.map(file => (
          <div 
            key={file.path}
            onClick={() => file.isText && handleFileSelect(file.path)}
            className={file.path === selectedFile ? 'selected' : ''}
          >
            {file.name}
          </div>
        ))}
      </aside>
      
      <main className="editor">
        {selectedFile && (
          <>
            <header>
              <h2>{selectedFile}</h2>
              <button onClick={handleSave} disabled={loading}>
                Uložit
              </button>
            </header>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              disabled={loading}
            />
          </>
        )}
      </main>
    </div>
  );
}
```

## 📋 Podporované Formáty

### Textové soubory (editovatelné)
- `.js` - JavaScript
- `.py` - Python
- `.sql` - SQL
- `.workflow` - Workflow definition
- `.txt` - Plain text
- `.md` - Markdown
- `.json` - JSON
- `.sh` - Shell script
- `.css`, `.html`, `.xml`
- `.yaml`, `.yml`
- `.env`

### Binární soubory (jen download/upload)
- `.docx` - Word documents
- `.png`, `.jpg` - Images
- Ostatní formáty

## ⚠️ Omezení

- **Velikost souboru:** Max 50 MB
- **Hloubka rekurze:** 2 úrovně při výpisu
- **Autentifikace:** Povinná pro všechny operace
- **Scope:** Pouze `scripts/` složka

## 🔍 Error Handling

```typescript
try {
  await saveFileContent('analyzy/script.py', content);
} catch (error) {
  if (error.status === 400) {
    // Invalid path / Path traversal
  } else if (error.status === 404) {
    // File not found
  } else if (error.status === 401) {
    // Unauthorized - redirect to login
  } else {
    // Server error
  }
}
```

## 🛡️ Best Practices

1. **Vždy validuj cesty** - Použij `encodeURIComponent()` pro parametry
2. **Kontroluj isText flag** - Před editací ověř že soubor je textový
3. **Backup před mazáním** - Umožni stažení před DELETE
4. **Autosave** - Implementuj debounced autosave pro editaci
5. **Syntax highlighting** - Použij Monaco Editor nebo CodeMirror
6. **Diff view** - Ukaž změny před uložením

## 📚 Reference

- [API Documentation](../API.md#-správa-skriptů)
- [Multer Documentation](https://github.com/expressjs/multer)
- [Path Security Best Practices](https://owasp.org/www-community/attacks/Path_Traversal)
