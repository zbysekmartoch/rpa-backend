import { Router } from 'express';
import multer from 'multer';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { runImportScript } from '../utils/import-helpers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const BACKEND_DIR = path.join(__dirname, '../..');

const router = Router();

// Konfigurace multer pro upload do temp složky
const upload = multer({
  storage: multer.diskStorage({
    destination: async (req, file, cb) => {
      const tempDir = path.join(BACKEND_DIR, 'temp');
      await fs.mkdir(tempDir, { recursive: true });
      cb(null, tempDir);
    },
    filename: (req, file, cb) => {
      const timestamp = Date.now();
      const sanitizedFilename = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
      cb(null, `manual_${timestamp}_${sanitizedFilename}`);
    }
  }),
  fileFilter: (req, file, cb) => {
    // Kontrola že je to ZIP soubor
    if (file.mimetype === 'application/zip' || 
        file.mimetype === 'application/x-zip-compressed' ||
        file.originalname.toLowerCase().endsWith('.zip')) {
      cb(null, true);
    } else {
      cb(new Error('Only ZIP files are allowed'));
    }
  },
  limits: {
    fileSize: 500 * 1024 * 1024, // 500 MB limit
  }
});

/**
 * POST /api/v1/harvest/manual-import
 * Manuální import dat ze ZIP souboru
 */
router.post('/manual-import', upload.single('file'), async (req, res, next) => {
  let zipFilePath = null;
  
  try {
    // Kontrola že byl nahrán soubor
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded. Please provide a ZIP file in the "file" field.' });
    }

    zipFilePath = req.file.path;
    const filename = req.file.filename;
    const filesize = req.file.size;

    console.log(`Manual import started - File: ${filename}, Size: ${filesize} bytes`);

    // Odpovíme klientovi, že import začal (async operace)
    res.json({ 
      message: 'Import started',
      filename: filename,
      filesize: filesize,
      status: 'processing'
    });

    // Spustíme import asynchronně (neblokuje response)
    (async () => {
      try {
        // Spustíme import script
        console.log(`Running import script for manual upload...`);
        const result = await runImportScript(zipFilePath);

        console.log(`Manual import completed successfully`);
        console.log(`Import result:`, result);

        // Smažeme dočasný ZIP soubor
        try {
          await fs.unlink(zipFilePath);
          console.log(`Deleted temporary ZIP file: ${zipFilePath}`);
        } catch (unlinkError) {
          console.warn(`Failed to delete temporary ZIP file: ${unlinkError.message}`);
        }

      } catch (importError) {
        console.error(`Manual import failed:`, importError.message);
        
        // Pokusíme se smazat ZIP i při chybě
        try {
          await fs.unlink(zipFilePath);
        } catch (unlinkError) {
          // Ignorujeme chybu při mazání
        }
      }
    })();

  } catch (e) {
    // Pokud nastane chyba před odesláním response, smažeme soubor hned
    if (zipFilePath) {
      try {
        await fs.unlink(zipFilePath);
      } catch (unlinkError) {
        // Ignorujeme
      }
    }
    next(e);
  }
});

export default router;
