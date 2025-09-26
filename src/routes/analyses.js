// backend/src/routes/analyses.js

import { Router } from 'express';
import { query } from '../db.js';

import { promises as fs } from 'fs';
import path from 'path';

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import process from 'process'; // Add this import

// Získáme absolutní cestu k backend složce (2 úrovně nad current file)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const BACKEND_DIR = path.join(__dirname, '../..');


const router = Router();

function parseSettings(row) {
  if (!row) return row;
  const out = { ...row };
  if (typeof out.settings === 'string' && out.settings.trim() !== '') {
    try { out.settings = JSON.parse(out.settings); }
    catch { out.settings = null; } // když je v DB nevalidní JSON
  }
  return out;
}

function toSettingsText(val) {
  // přijmeme objekt i string
  if (val == null) return null;
  if (typeof val === 'string') return val;      // očekáváme validní JSON string
  return JSON.stringify(val);
}

/**
 * GET /api/v1/analyses
 * Volitelné: ?search=<text> (LIKE nad name)
 */
router.get('/', async (req, res, next) => {
  try {
    const { search } = req.query;
    const params = [];
    let where = '';
    if (search && search.trim()) {
      where = 'WHERE name LIKE ?';
      params.push(`%${search.trim()}%`);
    }

    const rows = await query(
      `
      SELECT id, name, created_at
      FROM analysis
      ${where}
      ORDER BY id DESC
      `,
      params
    );

    res.json({ items: rows });
  } catch (e) {
    next(e);
  }
});

/**
 * GET /api/v1/analyses/:id
 * Vrací detail včetně settings (parsed)
 */
router.get('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });

    const rows = await query(
      `SELECT id, name, settings, created_at FROM analysis WHERE id = ?`,
      [id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' });

    res.json(parseSettings(rows[0]));
  } catch (e) {
    next(e);
  }
});

/**
 * POST /api/v1/analyses
 * Body: { name: string, settings?: object|string|null }
 */
router.post('/', async (req, res, next) => {
  try {
    const { name, settings } = req.body ?? {};
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'name is required' });
    }

    const settingsText = toSettingsText(settings);

    const [r] = await query(
      `INSERT INTO analysis (name, settings) VALUES (?, ?)`,
      [String(name).trim(), settingsText]
    );

    // vraťme rovnou detail (s parsed settings)
    res.status(201).json({
      id: r.insertId,
      name: String(name).trim(),
      settings: typeof settings === 'string' ? JSON.parse(settings) : (settings ?? null),
      created_at: new Date().toISOString().slice(0, 19).replace('T', ' ')
    });
  } catch (e) {
    // když by settings byl nevalidní JSON string
    if (e instanceof SyntaxError) {
      return res.status(400).json({ error: 'settings must be valid JSON' });
    }
    next(e);
  }
});

/**
 * PUT /api/v1/analyses/:id
 * Body: { name?: string, settings?: object|string|null }
 * Aktualizuje pouze poslané položky.
 */
router.put('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });

    const { name, settings } = req.body ?? {};

    const sets = [];
    const params = [];

    if (name !== undefined) {
      if (!String(name).trim()) return res.status(400).json({ error: 'name cannot be empty' });
      sets.push('name = ?');
      params.push(String(name).trim());
    }
    if (settings !== undefined) {
      // povolíme null (vyprázdnění settings)
      const settingsText = toSettingsText(settings);
      // validuj, pokud byl string
      if (typeof settings === 'string') {
        try { JSON.parse(settings); } catch { return res.status(400).json({ error: 'settings must be valid JSON' }); }
      }
      sets.push('settings = ?');
      params.push(settingsText);
    }

    if (sets.length === 0) return res.status(400).json({ error: 'nothing to update' });

    params.push(id);
    const r = await query(
      `UPDATE analysis SET ${sets.join(', ')} WHERE id = ?`,
      params
    );
    if (r.affectedRows === 0) return res.status(404).json({ error: 'Not found' });

    // vraťme aktuální stav
    const rows = await query(
      `SELECT id, name, settings, created_at FROM analysis WHERE id = ?`,
      [id]
    );
    res.json(parseSettings(rows[0]));
  } catch (e) {
    next(e);
  }
});

/**
 * DELETE /api/v1/analyses/:id
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });

    const [r] = await pool.query(`DELETE FROM analysis WHERE id = ?`, [id]);
    if (r.affectedRows === 0) return res.status(404).json({ error: 'Not found' });

    res.status(204).end();
  } catch (e) {
    next(e);
  }
});


/**
 * POST /api/v1/analyses/:id/run
 * Spustí analýzu
 */
router.post('/:id/run', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });

    // Nejdřív ověříme že analýza existuje
    const rows = await query(
      'SELECT id, name, settings FROM analysis WHERE id = ?',
      [id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Analysis not found' });

    let settingsStr=rows[0].settings;
    let analysisId=rows[0].id;
    let settings = null;

    if (typeof settingsStr === 'string' && settingsStr.trim() !== '') {
      try { 
        settings = JSON.parse(settingsStr); 
        runAnalysis(analysisId,settings);

      }
      catch { settings = null; } // když je v DB nevalidní JSON
    }
    // Můžeme zde případně upravit settings před spuštěním, např. přidat timestamp
    // settings.run_at = new Date().toISOString();


    res.status(201).json({
     // id: result.insertId,
      analysis_id: id,
      status: 'pending',
      created_at: new Date().toISOString().slice(0, 19).replace('T', ' ')
    });
  } catch (e) {
    next(e);
  }
});


async function runAnalysis(analysisId, settings) {
  // Simulace dlouho běžící úlohy
    console.log('Running analysis with settings:', settings);
    const r = await query(
      'INSERT INTO result(analysis_id, status) VALUES (?, ?)',
      [analysisId,'pending']
    );
    const resultId = r.insertId;

        // Vytvoříme složku pro výsledky
    const resultDir = path.join(BACKEND_DIR, 'results', resultId.toString());
    await fs.mkdir(resultDir, { recursive: true });

    // Uložíme settings do data.json
    await fs.writeFile(
      path.join(resultDir, 'data.json'),
      JSON.stringify(settings, null, 2)
    );



    let workflow = settings?.workflow||'';
    let steps=workflow.split('\n').map(s=>s.trim()).filter(s=>s);
    if (steps.length) {
      for (const step of steps) {
        console.log(`Executing step: ${step} `);
        const success = await runScript(step, resultDir);
        
        if (!success) {
          await query(
            'UPDATE result SET status = ? WHERE id = ?',
            ['failed', resultId]
          );
          return;
        }
      }
    }


    await query(
        'UPDATE result SET status = ? WHERE id = ?',
        ['completed', resultId]
      );
}   



/**
 * Spustí externí skript a počká na jeho dokončení
 * @param {string} scriptPath - Relativní cesta ke skriptu od složky scripts
 * @param {string} workDir - Pracovní adresář pro skript
 * @returns {Promise<boolean>} - true pokud skript uspěl, false pokud selhal
 */
async function runScript(scriptPath, workDir) {
  const fullScriptPath = path.join(BACKEND_DIR, 'scripts', scriptPath);
  const ext = path.extname(scriptPath).toLowerCase();
  
  let command, args;
  switch (ext) {
    case '.py':
      command = 'python3';
      args = [fullScriptPath, workDir];  // přidáme workDir jako argument
      break;
    case '.js':
    case '.cjs':
      command = 'node';
      args = [fullScriptPath, workDir];  // přidáme workDir jako argument
      break;
    default:
      console.error(`Unsupported script type: ${ext}`);
      return false;
  }
  
  return new Promise((resolve) => {
    const childProcess = spawn(command, args, {  // renamed from 'process' to 'childProcess'
      cwd: workDir,
      env: {
        ...process.env,
        WORK_DIR: workDir
      }
    });

    childProcess.stdout.on('data', (data) => {
      console.log(`Script output: ${data}`);
    });

    childProcess.stderr.on('data', (data) => {
      console.error(`Script error: ${data}`);
    });

    childProcess.on('error', (error) => {
      console.error(`Failed to start script: ${error}`);
      resolve(false);
    });

    childProcess.on('close', (code) => {
      resolve(code === 0);
    });
  });
}


export default router;
