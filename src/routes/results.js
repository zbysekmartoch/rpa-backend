import { Router } from 'express';
import { query } from '../db.js';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import archiver from 'archiver';

// Získáme absolutní cestu k backend složce
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const BACKEND_DIR = path.join(__dirname, '../..');

const router = Router();

/**
 * GET /api/v1/results
 * Volitelné: ?analysis_id=<number> pro filtrování podle analýzy
 */
router.get('/', async (req, res, next) => {
  try {
    const { analysis_id } = req.query;
    const params = [];
    let where = '';
    
    if (analysis_id) {
      const id = Number(analysis_id);
      if (!Number.isInteger(id)) {
        return res.status(400).json({ error: 'Invalid analysis_id' });
      }
      where = 'WHERE r.analysis_id = ?';
      params.push(id);
    }

    const rows = await query(
      `
      SELECT r.id, r.analysis_id, r.status, r.created_at, r.output,
             a.name as analysisName, r.report
      FROM result r
      LEFT JOIN analysis a ON a.id = r.analysis_id
      ${where}
      ORDER BY r.id DESC
      `,
      params
    );

    res.json({ items: rows });
  } catch (e) {
    next(e);
  }
});

/**
 * GET /api/v1/results/:id
 * Vrací detail výsledku včetně detailů analýzy a seznamu DOCX/XLSX souborů
 */
router.get('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'Invalid id' });
    }

    const rows = await query(
      `
      SELECT r.id, r.analysis_id, r.status, r.created_at, r.output,
             a.name as analysisName, r.report
      FROM result r
      LEFT JOIN analysis a ON a.id = r.analysis_id
      WHERE r.id = ?
      `,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Result not found' });
    }

    // Parse settings pokud existují
    const result = rows[0];
    if (typeof result.analysis_settings === 'string' && result.analysis_settings.trim()) {
      try {
        result.analysis_settings = JSON.parse(result.analysis_settings);
      } catch {
        result.analysis_settings = null;
      }
    }

    // Načti seznam DOCX a XLSX souborů z results složky
    const resultDir = path.join(BACKEND_DIR, 'results', id.toString());
    result.files = [];
    
    try {
      await fs.access(resultDir);
      const files = await fs.readdir(resultDir, { withFileTypes: true });
      
      for (const file of files) {
        if (!file.isFile()) continue;
        
        const ext = path.extname(file.name).toLowerCase();
        
        // Pouze DOCX a XLSX soubory
        if (ext === '.docx' || ext === '.xlsx') {
          const filePath = path.join(resultDir, file.name);
          const stats = await fs.stat(filePath);
          
          result.files.push({
            name: file.name,
            extension: ext,
            size: stats.size,
            mtime: stats.mtime.toISOString(),
            downloadUrl: `/api/v1/results-public/${id}/files/${encodeURIComponent(file.name)}`
          });
        }
      }
      
      // Seřaď podle typu a pak názvu
      result.files.sort((a, b) => {
        if (a.extension !== b.extension) {
          return a.extension.localeCompare(b.extension);
        }
        return a.name.localeCompare(b.name);
      });
      
    } catch (err) {
      // Složka neexistuje nebo není přístupná
      result.files = [];
    }

    res.json(result);
  } catch (e) {
    next(e);
  }
});

/**
 * GET /api/v1/results/:id/download
 * Stáhne zip soubor s výsledky analýzy
 */
router.get('/:id/download', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'Invalid id' });
    }

    // Ověřím, že výsledek existuje
    const rows = await query(
      `SELECT id, analysis_id FROM result WHERE id = ?`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Result not found' });
    }

    const resultDir = path.join(BACKEND_DIR, 'results', id.toString());
    
    // Zkontroluju, že složka existuje
    try {
      await fs.access(resultDir);
    } catch {
      return res.status(404).json({ error: 'Result files not found' });
    }

    // Nastavím hlavičky pro zip download
    const zipFilename = `result-${id}.zip`;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${zipFilename}"`);

    // Vytvořím zip stream
    const archive = archiver('zip', {
      zlib: { level: 9 }
    });

    // Napojím na response
    archive.pipe(res);

    // Přidám celou složku do zipu
    archive.directory(resultDir, false);

    // Dokončím archiv
    await archive.finalize();

  } catch (e) {
    next(e);
  }
});

/**
 * DELETE /api/v1/results/:id
 * Smaže výsledek z DB a odstraní složku s výsledky
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'Invalid id' });
    }

    // Ověř že výsledek existuje
    const rows = await query(
      `SELECT id FROM result WHERE id = ?`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Result not found' });
    }

    // Smaž složku s výsledky pokud existuje
    const resultDir = path.join(BACKEND_DIR, 'results', id.toString());
    try {
      await fs.rm(resultDir, { recursive: true, force: true });
    } catch (err) {
      console.warn(`Failed to delete result directory ${resultDir}:`, err.message);
      // Pokračuj i když se nepodařilo smazat složku
    }

    // Smaž záznam z DB
    await query('DELETE FROM result WHERE id = ?', [id]);

    res.json({
      success: true,
      id: id,
      message: 'Result deleted successfully'
    });

  } catch (e) {
    next(e);
  }
});

export default router;