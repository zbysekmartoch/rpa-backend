// backend/src/routes/scripts.js
import { Router } from 'express';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Absolutní cesta k scripts/ složce
const SCRIPTS_ROOT = path.resolve(__dirname, '../../scripts');

const router = Router();

/**
 * Bezpečná validace cesty - zamezí path traversal
 * @param {string} relativePath - Relativní cesta od scripts/
 * @returns {string|null} - Absolutní validní cesta nebo null
 */
function getSecurePath(relativePath) {
  if (!relativePath) return SCRIPTS_ROOT;
  
  // Normalizuj cestu (odstraň .., ./, redundantní /)
  const normalized = path.normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, '');
  
  // Vytvoř absolutní cestu
  const absolute = path.resolve(SCRIPTS_ROOT, normalized);
  
  // Ověř že výsledná cesta je pod SCRIPTS_ROOT
  if (!absolute.startsWith(SCRIPTS_ROOT)) {
    return null;
  }
  
  return absolute;
}

/**
 * Rekurzivní výpis souborů a složek
 * @param {string} dirPath - Absolutní cesta k adresáři
 * @param {string} relativeTo - Relativní prefix pro výstup
 * @param {number} maxDepth - Maximální hloubka rekurze
 * @param {number} currentDepth - Aktuální hloubka
 * @returns {Array} - Seznam souborů a složek
 */
async function listFiles(dirPath, relativeTo = '', maxDepth = 2, currentDepth = 0) {
  const items = [];
  
  if (currentDepth >= maxDepth) return items;
  
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      const relativePath = path.join(relativeTo, entry.name);
      
      try {
        const stats = await fs.stat(fullPath);
        
        if (entry.isDirectory()) {
          // Přidej složku
          items.push({
            name: entry.name,
            path: relativePath,
            type: 'directory',
            size: 0,
            mtime: stats.mtime.toISOString(),
            children: currentDepth < maxDepth - 1 
              ? await listFiles(fullPath, relativePath, maxDepth, currentDepth + 1)
              : []
          });
        } else if (entry.isFile()) {
          // Přidej soubor
          const ext = path.extname(entry.name).toLowerCase();
          items.push({
            name: entry.name,
            path: relativePath,
            type: 'file',
            extension: ext,
            size: stats.size,
            mtime: stats.mtime.toISOString(),
            isText: ['.js', '.py', '.txt', '.md', '.json', '.workflow', '.sql', '.sh', '.css', '.html', '.xml', '.yaml', '.yml', '.env'].includes(ext)
          });
        }
      } catch (err) {
        console.warn(`Skipping ${relativePath}: ${err.message}`);
      }
    }
  } catch (err) {
    throw new Error(`Cannot read directory: ${err.message}`);
  }
  
  return items;
}

/**
 * GET /api/v1/scripts
 * Vypíše soubory ve složce scripts/ a podadresářích
 * Query: ?subdir=analyzy (volitelné - omezí na podadresář)
 */
router.get('/', async (req, res, next) => {
  try {
    const { subdir } = req.query;
    
    // Validuj cestu
    const targetPath = getSecurePath(subdir || '');
    if (!targetPath) {
      return res.status(400).json({ error: 'Invalid path' });
    }
    
    // Ověř že cesta existuje a je to složka
    const stats = await fs.stat(targetPath);
    if (!stats.isDirectory()) {
      return res.status(400).json({ error: 'Path is not a directory' });
    }
    
    // Vypíš obsah
    const files = await listFiles(targetPath, subdir || '', 2);
    
    res.json({
      root: subdir || '',
      items: files,
      count: files.length
    });
  } catch (err) {
    if (err.code === 'ENOENT') {
      return res.status(404).json({ error: 'Directory not found' });
    }
    next(err);
  }
});

/**
 * GET /api/v1/scripts/download
 * Stáhne konkrétní soubor
 * Query: ?file=analyzy/script.py (povinné)
 */
router.get('/download', async (req, res, next) => {
  try {
    const { file } = req.query;
    
    if (!file) {
      return res.status(400).json({ error: 'Missing file parameter' });
    }
    
    // Validuj cestu
    const filePath = getSecurePath(file);
    if (!filePath) {
      return res.status(400).json({ error: 'Invalid file path' });
    }
    
    // Ověř že soubor existuje
    const stats = await fs.stat(filePath);
    if (!stats.isFile()) {
      return res.status(400).json({ error: 'Path is not a file' });
    }
    
    // Odešli soubor
    res.download(filePath, path.basename(filePath));
  } catch (err) {
    if (err.code === 'ENOENT') {
      return res.status(404).json({ error: 'File not found' });
    }
    next(err);
  }
});

/**
 * GET /api/v1/scripts/content
 * Načte obsah textového souboru
 * Query: ?file=analyzy/script.py (povinné)
 */
router.get('/content', async (req, res, next) => {
  try {
    const { file } = req.query;
    
    if (!file) {
      return res.status(400).json({ error: 'Missing file parameter' });
    }
    
    // Validuj cestu
    const filePath = getSecurePath(file);
    if (!filePath) {
      return res.status(400).json({ error: 'Invalid file path' });
    }
    
    // Ověř že soubor existuje
    const stats = await fs.stat(filePath);
    if (!stats.isFile()) {
      return res.status(400).json({ error: 'Path is not a file' });
    }
    
    // Načti obsah (UTF-8)
    const content = await fs.readFile(filePath, 'utf-8');
    
    res.json({
      file: file,
      content: content,
      size: stats.size,
      mtime: stats.mtime.toISOString()
    });
  } catch (err) {
    if (err.code === 'ENOENT') {
      return res.status(404).json({ error: 'File not found' });
    }
    next(err);
  }
});

/**
 * PUT /api/v1/scripts/content
 * Uloží změny obsahu textového souboru
 * Body: { file: string, content: string }
 */
router.put('/content', async (req, res, next) => {
  try {
    const { file, content } = req.body;
    
    if (!file || content === undefined) {
      return res.status(400).json({ error: 'Missing file or content parameter' });
    }
    
    // Validuj cestu
    const filePath = getSecurePath(file);
    if (!filePath) {
      return res.status(400).json({ error: 'Invalid file path' });
    }
    
    // Ověř že soubor existuje (jen update existujících)
    try {
      const stats = await fs.stat(filePath);
      if (!stats.isFile()) {
        return res.status(400).json({ error: 'Path is not a file' });
      }
    } catch (err) {
      if (err.code === 'ENOENT') {
        return res.status(404).json({ error: 'File not found. Use upload to create new files.' });
      }
      throw err;
    }
    
    // Ulož obsah (UTF-8)
    await fs.writeFile(filePath, content, 'utf-8');
    
    // Vrať nové stats
    const stats = await fs.stat(filePath);
    
    res.json({
      success: true,
      file: file,
      size: stats.size,
      mtime: stats.mtime.toISOString()
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Multer config pro upload souborů
 */
const upload = multer({
  storage: multer.diskStorage({
    destination: async (req, file, cb) => {
      try {
        const targetPath = req.body.targetPath || '';
        const dirPath = getSecurePath(targetPath);
        
        if (!dirPath) {
          return cb(new Error('Invalid target path'));
        }
        
        // Vytvoř složku pokud neexistuje
        await fs.mkdir(dirPath, { recursive: true });
        
        cb(null, dirPath);
      } catch (err) {
        cb(err);
      }
    },
    filename: (req, file, cb) => {
      // Použij původní název souboru
      cb(null, file.originalname);
    }
  }),
  limits: {
    fileSize: 50 * 1024 * 1024 // 50 MB max
  }
});

/**
 * POST /api/v1/scripts/upload
 * Nahraje nový soubor nebo přepíše existující
 * Form data: 
 *   - file: soubor (multipart)
 *   - targetPath: relativní cesta k cílovému adresáři (např. "analyzy")
 */
router.post('/upload', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const relativePath = path.join(req.body.targetPath || '', req.file.filename);
    const stats = await fs.stat(req.file.path);
    
    res.status(201).json({
      success: true,
      file: {
        name: req.file.filename,
        path: relativePath,
        size: stats.size,
        mtime: stats.mtime.toISOString()
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/v1/scripts
 * Smaže soubor
 * Query: ?file=analyzy/script.py (povinné)
 */
router.delete('/', async (req, res, next) => {
  try {
    const { file } = req.query;
    
    if (!file) {
      return res.status(400).json({ error: 'Missing file parameter' });
    }
    
    // Validuj cestu
    const filePath = getSecurePath(file);
    if (!filePath) {
      return res.status(400).json({ error: 'Invalid file path' });
    }
    
    // Ověř že soubor existuje
    const stats = await fs.stat(filePath);
    if (!stats.isFile()) {
      return res.status(400).json({ error: 'Path is not a file' });
    }
    
    // Smaž soubor
    await fs.unlink(filePath);
    
    res.json({
      success: true,
      file: file
    });
  } catch (err) {
    if (err.code === 'ENOENT') {
      return res.status(404).json({ error: 'File not found' });
    }
    next(err);
  }
});

export default router;
