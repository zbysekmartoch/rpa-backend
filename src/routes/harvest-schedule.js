import { Router } from 'express';
import { query } from '../db.js';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const BACKEND_DIR = path.join(__dirname, '../..');

const router = Router();

/**
 * Helper funkce pro volání harvester API
 */
async function callHarvesterAPI(host, endpoint, method = 'GET', body = null) {
  try {
    const url = `${host.replace(/\/$/, '')}${endpoint}`;
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 10000, // 10 sekund timeout
    };

    if (body && (method === 'POST' || method === 'PUT')) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    throw new Error(`Harvester API error: ${error.message}`);
  }
}

/**
 * Helper funkce pro stažení ZIP souboru z harvesteru
 */
async function downloadZipFromHarvester(host, endpoint, outputPath) {
  try {
    const url = `${host.replace(/\/$/, '')}${endpoint}`;
    console.log(`Downloading ZIP from: ${url}`);
    
    const response = await fetch(url, {
      method: 'GET',
      timeout: 300000, // 5 minut timeout pro velké soubory
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }

    // Zkontroluj content type
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/zip')) {
      console.warn(`Unexpected content type: ${contentType}`);
    }

    // Stáhni a ulož soubor
    const buffer = await response.arrayBuffer();
    await fs.writeFile(outputPath, Buffer.from(buffer));
    
    console.log(`ZIP file downloaded: ${outputPath} (${buffer.byteLength} bytes)`);
    return outputPath;
  } catch (error) {
    throw new Error(`Failed to download ZIP: ${error.message}`);
  }
}

/**
 * Helper funkce pro spuštění import scriptu
 */
async function runImportScript(zipFilePath) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(BACKEND_DIR, 'scripts', 'import-data.js');
    
    console.log(`Running import script: ${scriptPath} with file: ${zipFilePath}`);
    
    const childProcess = spawn('node', [scriptPath, zipFilePath], {
      cwd: BACKEND_DIR,
      env: process.env
    });

    let stdout = '';
    let stderr = '';

    childProcess.stdout.on('data', (data) => {
      const output = data.toString();
      stdout += output;
      console.log(`Import script output: ${output}`);
    });

    childProcess.stderr.on('data', (data) => {
      const output = data.toString();
      stderr += output;
      console.error(`Import script error: ${output}`);
    });

    childProcess.on('error', (error) => {
      reject(new Error(`Failed to start import script: ${error.message}`));
    });

    childProcess.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true, stdout, stderr });
      } else {
        reject(new Error(`Import script exited with code ${code}\nStderr: ${stderr}`));
      }
    });
  });
}

/**
 * GET /api/v1/harvest-schedule
 * Seznam všech naplánovaných harvest jobů
 */
router.get('/', async (req, res, next) => {
  try {
    const { harvester_id, datasource_id } = req.query;
    const params = [];
    const conditions = [];

    // Volitelné filtry
    if (harvester_id) {
      const id = Number(harvester_id);
      if (Number.isInteger(id)) {
        conditions.push('s.harvester_id = ?');
        params.push(id);
      }
    }

    if (datasource_id) {
      const id = Number(datasource_id);
      if (Number.isInteger(id)) {
        conditions.push('s.datasource_id = ?');
        params.push(id);
      }
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const rows = await query(
      `
      SELECT 
        s.id, 
        s.harvester_id, 
        s.datasource_id, 
        s.cron_expression,
        s.created_at,
        s.updated_at,
        s.lastImport,
        h.name as harvester_name,
        h.host as harvester_host,
        d.name as datasource_name
      FROM schedule s
      LEFT JOIN harvester h ON h.id = s.harvester_id
      LEFT JOIN ds d ON d.id = s.datasource_id
      ${whereClause}
      ORDER BY s.id DESC
      `,
      params
    );

    res.json({ items: rows });
  } catch (e) {
    next(e);
  }
});

/**
 * GET /api/v1/harvest-schedule/:id
 * Detail naplánovaného harvest jobu
 */
router.get('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'Invalid id' });
    }

    const rows = await query(
      `
      SELECT 
        s.id, 
        s.harvester_id, 
        s.datasource_id, 
        s.cron_expression,
        s.created_at,
        s.updated_at,
        s.lastImport,
        h.name as harvester_name,
        h.host as harvester_host,
        d.name as datasource_name,
        d.urls as datasource_urls
      FROM schedule s
      LEFT JOIN harvester h ON h.id = s.harvester_id
      LEFT JOIN ds d ON d.id = s.datasource_id
      WHERE s.id = ?
      `,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    const schedule = rows[0];
    // Zpracuj URLs z datasource
    if (schedule.datasource_urls) {
      schedule.datasource_urls = schedule.datasource_urls.split('\n').map(url => url.trim()).filter(Boolean);
    }

    res.json(schedule);
  } catch (e) {
    next(e);
  }
});

/**
 * POST /api/v1/harvest-schedule
 * Vytvoření nového naplánovaného harvest jobu
 */
router.post('/', async (req, res, next) => {
  try {
    const { harvester_id, datasource_id, cron_expression } = req.body ?? {};
    
    if (!harvester_id || !Number.isInteger(Number(harvester_id))) {
      return res.status(400).json({ error: 'harvester_id is required and must be integer' });
    }

    if (!datasource_id || !Number.isInteger(Number(datasource_id))) {
      return res.status(400).json({ error: 'datasource_id is required and must be integer' });
    }

    if (!cron_expression || typeof cron_expression !== 'string' || !cron_expression.trim()) {
      return res.status(400).json({ error: 'cron_expression is required and must be non-empty string' });
    }

    // Validace cron výrazu (základní)
    const cronParts = cron_expression.trim().split(/\s+/);
    if (cronParts.length !== 5) {
      return res.status(400).json({ error: 'cron_expression must have 5 parts (minute hour day month weekday)' });
    }

    // Ověříme, že harvester existuje
    const harvesterExists = await query('SELECT id FROM harvester WHERE id = ?', [harvester_id]);
    if (harvesterExists.length === 0) {
      return res.status(400).json({ error: 'Harvester not found' });
    }

    // Ověříme, že datasource existuje
    const datasourceExists = await query('SELECT id FROM ds WHERE id = ?', [datasource_id]);
    if (datasourceExists.length === 0) {
      return res.status(400).json({ error: 'Data source not found' });
    }

    const result = await query(
      'INSERT INTO schedule (harvester_id, datasource_id, cron_expression) VALUES (?, ?, ?)',
      [harvester_id, datasource_id, cron_expression.trim()]
    );

    const newSchedule = await query(
      `
      SELECT 
        s.id, 
        s.harvester_id, 
        s.datasource_id, 
        s.cron_expression,
        s.created_at,
        s.updated_at,
        h.name as harvester_name,
        h.host as harvester_host,
        d.name as datasource_name,
        d.urls as datasource_urls
      FROM schedule s
      LEFT JOIN harvester h ON h.id = s.harvester_id
      LEFT JOIN ds d ON d.id = s.datasource_id
      WHERE s.id = ?
      `,
      [result.insertId]
    );

    const schedule = newSchedule[0];

    // Informuj harvester o novém schedule
    try {
      if (schedule.harvester_host && schedule.datasource_urls) {
        const urls = schedule.datasource_urls.split('\n').map(url => url.trim()).filter(Boolean);
        
        await callHarvesterAPI(schedule.harvester_host, '/schedule', 'POST', {
          harvestingJobId: schedule.id.toString(),
          urls: urls,
          cronExpression: schedule.cron_expression
        });
      }
    } catch (apiError) {
      console.warn(`Failed to notify harvester about new schedule ${schedule.id}:`, apiError.message);
      // Nepřerušujeme operaci, jen logujeme chybu
    }

    // Odstraň URLs z response (vrátíme jen základní info)
    delete schedule.datasource_urls;

    res.status(201).json(schedule);
  } catch (e) {
    next(e);
  }
});

/**
 * PUT /api/v1/harvest-schedule/:id
 * Aktualizace naplánovaného harvest jobu
 */
router.put('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'Invalid id' });
    }

    const { harvester_id, datasource_id, cron_expression } = req.body ?? {};

    // Validace
    if (harvester_id !== undefined && !Number.isInteger(Number(harvester_id))) {
      return res.status(400).json({ error: 'harvester_id must be integer' });
    }

    if (datasource_id !== undefined && !Number.isInteger(Number(datasource_id))) {
      return res.status(400).json({ error: 'datasource_id must be integer' });
    }

    if (cron_expression !== undefined && (typeof cron_expression !== 'string' || !cron_expression.trim())) {
      return res.status(400).json({ error: 'cron_expression must be non-empty string' });
    }

    // Validace cron výrazu
    if (cron_expression !== undefined) {
      const cronParts = cron_expression.trim().split(/\s+/);
      if (cronParts.length !== 5) {
        return res.status(400).json({ error: 'cron_expression must have 5 parts (minute hour day month weekday)' });
      }
    }

    // Sestavíme UPDATE query pouze pro poskytnutá pole
    const updates = [];
    const values = [];

    if (harvester_id !== undefined) {
      // Ověříme, že harvester existuje
      const harvesterExists = await query('SELECT id FROM harvester WHERE id = ?', [harvester_id]);
      if (harvesterExists.length === 0) {
        return res.status(400).json({ error: 'Harvester not found' });
      }
      updates.push('harvester_id = ?');
      values.push(harvester_id);
    }

    if (datasource_id !== undefined) {
      // Ověříme, že datasource existuje
      const datasourceExists = await query('SELECT id FROM ds WHERE id = ?', [datasource_id]);
      if (datasourceExists.length === 0) {
        return res.status(400).json({ error: 'Data source not found' });
      }
      updates.push('datasource_id = ?');
      values.push(datasource_id);
    }

    if (cron_expression !== undefined) {
      updates.push('cron_expression = ?');
      values.push(cron_expression.trim());
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(id);
    const result = await query(
      `UPDATE schedule SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    const updatedSchedule = await query(
      `
      SELECT 
        s.id, 
        s.harvester_id, 
        s.datasource_id, 
        s.cron_expression,
        s.created_at,
        s.updated_at,
        h.name as harvester_name,
        h.host as harvester_host,
        d.name as datasource_name,
        d.urls as datasource_urls
      FROM schedule s
      LEFT JOIN harvester h ON h.id = s.harvester_id
      LEFT JOIN ds d ON d.id = s.datasource_id
      WHERE s.id = ?
      `,
      [id]
    );

    const schedule = updatedSchedule[0];

    // Informuj harvester o aktualizaci schedule
    try {
      if (schedule.harvester_host && schedule.datasource_urls) {
        const urls = schedule.datasource_urls.split('\n').map(url => url.trim()).filter(Boolean);
        
        await callHarvesterAPI(schedule.harvester_host, '/schedule', 'POST', {
          harvestingJobId: schedule.id.toString(),
          urls: urls,
          cronExpression: schedule.cron_expression
        });
      }
    } catch (apiError) {
      console.warn(`Failed to notify harvester about updated schedule ${schedule.id}:`, apiError.message);
      // Nepřerušujeme operaci, jen logujeme chybu
    }

    // Odstraň URLs z response
    delete schedule.datasource_urls;

    res.json(schedule);
  } catch (e) {
    next(e);
  }
});

/**
 * DELETE /api/v1/harvest-schedule/:id
 * Smazání naplánovaného harvest jobu
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'Invalid id' });
    }

    // Nejdřív získáme informace o schedule včetně harvester host
    const scheduleInfo = await query(
      `
      SELECT s.id, h.host as harvester_host
      FROM schedule s
      LEFT JOIN harvester h ON h.id = s.harvester_id
      WHERE s.id = ?
      `,
      [id]
    );

    if (scheduleInfo.length === 0) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    const schedule = scheduleInfo[0];

    // Smažeme ze schedule tabulky
    const result = await query('DELETE FROM schedule WHERE id = ?', [id]);

    // Informuj harvester o smazání schedule
    try {
      if (schedule.harvester_host) {
        await callHarvesterAPI(schedule.harvester_host, `/schedule/${id}`, 'DELETE');
      }
    } catch (apiError) {
      console.warn(`Failed to notify harvester about deleted schedule ${id}:`, apiError.message);
      // Nepřerušujeme operaci, jen logujeme chybu
    }

    res.json({ success: true, id });
  } catch (e) {
    next(e);
  }
});

/**
 * POST /api/v1/harvest-schedule/import/:id
 * Import dat z harvesteru - stáhne ZIP a spustí import script
 */
router.post('/import/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'Invalid id' });
    }

    // Získáme parametry z query nebo body
    const { from, to, images, screenshots } = req.query || {};

    // Validace date parametrů
    if (from && isNaN(Date.parse(from))) {
      return res.status(400).json({ error: 'Invalid from date format. Use ISO 8601 format.' });
    }
    if (to && isNaN(Date.parse(to))) {
      return res.status(400).json({ error: 'Invalid to date format. Use ISO 8601 format.' });
    }

    // Nejdřív získáme informace o schedule včetně harvester host
    const scheduleInfo = await query(
      `
      SELECT s.id, s.harvester_id, h.host as harvester_host, h.name as harvester_name
      FROM schedule s
      LEFT JOIN harvester h ON h.id = s.harvester_id
      WHERE s.id = ?
      `,
      [id]
    );

    if (scheduleInfo.length === 0) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    const schedule = scheduleInfo[0];

    if (!schedule.harvester_host) {
      return res.status(400).json({ error: 'Harvester host not configured for this schedule' });
    }

    // Sestavíme endpoint s parametry
    const params = new URLSearchParams();
    if (from) params.append('from', from);
    if (to) params.append('to', to);
    if (images === true || images === 'true') params.append('images', 'true');
    if (screenshots === true || screenshots === 'true') params.append('screenshots', 'true');

    const queryString = params.toString();
    const exportEndpoint = `/export/${id}${queryString ? '?' + queryString : ''}`;

    console.log(`Starting import for schedule ${id} from harvester ${schedule.harvester_name}`);
    console.log(`Export endpoint: ${exportEndpoint}`);

    // Vytvoříme temp složku pokud neexistuje
    const tempDir = path.join(BACKEND_DIR, 'temp');
    await fs.mkdir(tempDir, { recursive: true });

    // Vygenerujeme unikátní název souboru
    const timestamp = Date.now();
    const zipFilePath = path.join(tempDir, `${id}_${timestamp}.zip`);

    // Odpovíme klientovi, že import začal (async operace)
    res.json({ 
      message: 'Import started',
      scheduleId: id,
      status: 'downloading'
    });

    // Spustíme import asynchronně (neblokuje response)
    (async () => {
      try {
        // Stáhneme ZIP soubor z harvesteru
        console.log(`Downloading ZIP from harvester...`);
        await downloadZipFromHarvester(schedule.harvester_host, exportEndpoint, zipFilePath);

        // Spustíme import script
        console.log(`Running import script...`);
        const result = await runImportScript(zipFilePath);

        console.log(`Import completed successfully for schedule ${id}`);
        console.log(`Import result:`, result);

        // Smažeme dočasný ZIP soubor
        try {
          await fs.unlink(zipFilePath);
          console.log(`Deleted temporary ZIP file: ${zipFilePath}`);
        } catch (unlinkError) {
          console.warn(`Failed to delete temporary ZIP file: ${unlinkError.message}`);
        }

      } catch (importError) {
        console.error(`Import failed for schedule ${id}:`, importError.message);
        
        // Pokusíme se smazat ZIP i při chybě
        try {
          await fs.unlink(zipFilePath);
        } catch (unlinkError) {
          // Ignorujeme chybu při mazání
        }
      }
    })();

  } catch (e) {
    next(e);
  }
});

export default router;