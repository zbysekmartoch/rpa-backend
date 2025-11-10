import { Router } from 'express';
import { query } from '../db.js';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Získáme absolutní cestu k backend složce
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const BACKEND_DIR = path.join(__dirname, '../..');

const router = Router();

/**
 * GET /api/v1/results-public/:id/files/:filename
 * Veřejné stažení DOCX nebo XLSX souboru z výsledku (bez autentifikace)
 * Pro použití jako direct link v prohlížeči
 */
router.get('/:id/files/:filename', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'Invalid id' });
    }

    const filename = req.params.filename;
    
    // Bezpečnostní kontrola - žádný path traversal
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({ error: 'Invalid filename' });
    }

    // Kontrola přípony - pouze DOCX a XLSX
    const ext = path.extname(filename).toLowerCase();
    if (ext !== '.docx' && ext !== '.xlsx') {
      return res.status(400).json({ error: 'Only DOCX and XLSX files are allowed' });
    }

    // Ověř, že výsledek existuje
    const rows = await query(
      `SELECT id FROM result WHERE id = ?`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Result not found' });
    }

    const filePath = path.join(BACKEND_DIR, 'results', id.toString(), filename);
    
    // Zkontroluj, že soubor existuje
    try {
      await fs.access(filePath);
    } catch {
      return res.status(404).json({ error: 'File not found' });
    }

    // Zjisti velikost souboru
    const stats = await fs.stat(filePath);

    // Nastav správný Content-Type
    const contentType = ext === '.docx' 
      ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

    // Nastav hlavičky pro download
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', stats.size);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Streamuj soubor
    const fileStream = (await import('fs')).createReadStream(filePath);
    fileStream.pipe(res);

  } catch (e) {
    next(e);
  }
});

export default router;
