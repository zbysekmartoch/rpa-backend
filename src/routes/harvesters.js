import { Router } from 'express';
import { query } from '../db.js';

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
 * Helper funkce pro získání statusu z harvester API
 */
async function getHarvesterStatus(host) {
  try {
    return await callHarvesterAPI(host, '/status');
  } catch (error) {
    return { error: 'Harvester API unavailable', details: error.message };
  }
}

/**
 * GET /api/v1/harvesters
 * Seznam všech harvesterů
 */
router.get('/', async (req, res, next) => {
  try {
    const rows = await query(
      'SELECT id, name, host, upload, download, ping, last_update, created_at FROM harvester ORDER BY id DESC'
    );

    // Získáme status pro každý harvester z API
    const harvesters = await Promise.all(
      rows.map(async harvester => ({
        ...harvester,
        status: await getHarvesterStatus(harvester.host)
      }))
    );

    res.json({ items: harvesters });
  } catch (e) {
    next(e);
  }
});

/**
 * GET /api/v1/harvesters/:id
 * Detail harvesteru
 */
router.get('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'Invalid id' });
    }

    const rows = await query(
      'SELECT id, name, host, upload, download, ping, last_update, created_at FROM harvester WHERE id = ?',
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Harvester not found' });
    }

    const harvester = rows[0];
    // Získáme aktuální status z harvester API
    harvester.status = await getHarvesterStatus(harvester.host);

    res.json(harvester);
  } catch (e) {
    next(e);
  }
});

/**
 * POST /api/v1/harvesters
 * Vytvoření nového harvesteru
 */
router.post('/', async (req, res, next) => {
  try {
    const { name, host, upload, download, ping } = req.body ?? {};
    
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'name is required and must be string' });
    }

    if (!host || typeof host !== 'string' || !host.trim()) {
      return res.status(400).json({ error: 'host is required and must be string' });
    }

    // Validace číselných hodnot (volitelné)
    const uploadVal = upload !== undefined ? Number(upload) : null;
    const downloadVal = download !== undefined ? Number(download) : null;
    const pingVal = ping !== undefined ? Number(ping) : null;

    if (uploadVal !== null && (!Number.isFinite(uploadVal) || uploadVal < 0)) {
      return res.status(400).json({ error: 'upload must be a positive number' });
    }

    if (downloadVal !== null && (!Number.isFinite(downloadVal) || downloadVal < 0)) {
      return res.status(400).json({ error: 'download must be a positive number' });
    }

    if (pingVal !== null && (!Number.isFinite(pingVal) || pingVal < 0)) {
      return res.status(400).json({ error: 'ping must be a positive number' });
    }

    const result = await query(
      'INSERT INTO harvester (name, host, upload, download, ping) VALUES (?, ?, ?, ?, ?)',
      [name.trim(), host.trim(), uploadVal, downloadVal, pingVal]
    );

    const newHarvester = await query(
      'SELECT id, name, host, upload, download, ping, created_at FROM harvester WHERE id = ?',
      [result.insertId]
    );

    const harvester = newHarvester[0];
    // Získáme status z harvester API
    harvester.status = await getHarvesterStatus(harvester.host);

    res.status(201).json(harvester);
  } catch (e) {
    next(e);
  }
});

/**
 * PUT /api/v1/harvesters/:id
 * Aktualizace harvesteru
 * :id může být číselné ID nebo název harvesteru
 */
router.put('/:id', async (req, res, next) => {
  try {
    const idParam = req.params.id;
    let harvesterId;

    // Pokud je :id číslo, použijeme jako ID, jinak jako název
    if (/^\d+$/.test(idParam)) {
      harvesterId = Number(idParam);
      
      // Zkontroluj, že harvester s ID existuje
      const existing = await query('SELECT id FROM harvester WHERE id = ?', [harvesterId]);
      if (existing.length === 0) {
        return res.status(404).json({ error: 'Harvester not found' });
      }
    } else {
      // Najdi harvester podle názvu
      const existing = await query('SELECT id FROM harvester WHERE name = ?', [idParam]);
      if (existing.length === 0) {
        // Harvester s tímto názvem neexistuje, vytvoříme nový
        const { host = 'localhost', upload, download, ping } = req.body ?? {};
        
        // Validace povinných polí pro nový harvester
        if (!host || typeof host !== 'string' || !host.trim()) {
          return res.status(400).json({ error: 'host is required and must be string for new harvester' });
        }

        // Validace číselných hodnot
        const uploadVal = upload !== undefined ? Number(upload) : null;
        const downloadVal = download !== undefined ? Number(download) : null;
        const pingVal = ping !== undefined ? Number(ping) : null;

        if (uploadVal !== null && (!Number.isFinite(uploadVal) || uploadVal < 0)) {
          return res.status(400).json({ error: 'upload must be a positive number' });
        }

        if (downloadVal !== null && (!Number.isFinite(downloadVal) || downloadVal < 0)) {
          return res.status(400).json({ error: 'download must be a positive number' });
        }

        if (pingVal !== null && (!Number.isFinite(pingVal) || pingVal < 0)) {
          return res.status(400).json({ error: 'ping must be a positive number' });
        }

        // Vytvoříme nový harvester
        const result = await query(
          'INSERT INTO harvester (name, host, upload, download, ping, last_update) VALUES (?, ?, ?, ?, ?, NOW())',
          [idParam, host.trim(), uploadVal, downloadVal, pingVal]
        );

        const newHarvester = await query(
          'SELECT id, name, host, upload, download, ping, last_update, created_at FROM harvester WHERE id = ?',
          [result.insertId]
        );

        const harvester = newHarvester[0];
        // Získáme status z harvester API
        harvester.status = await getHarvesterStatus(harvester.host);

        return res.status(201).json(harvester);
      }
      harvesterId = existing[0].id;
    }

    const { name, host, upload, download, ping } = req.body ?? {};

    // Validace podobná jako u POST
    if (name !== undefined && (typeof name !== 'string' || !name.trim())) {
      return res.status(400).json({ error: 'name must be non-empty string' });
    }

    if (host !== undefined && (typeof host !== 'string' || !host.trim())) {
      return res.status(400).json({ error: 'host must be non-empty string' });
    }

    const uploadVal = upload !== undefined ? Number(upload) : undefined;
    const downloadVal = download !== undefined ? Number(download) : undefined;
    const pingVal = ping !== undefined ? Number(ping) : undefined;

    if (uploadVal !== undefined && (!Number.isFinite(uploadVal) || uploadVal < 0)) {
      return res.status(400).json({ error: 'upload must be a positive number' });
    }

    if (downloadVal !== undefined && (!Number.isFinite(downloadVal) || downloadVal < 0)) {
      return res.status(400).json({ error: 'download must be a positive number' });
    }

    if (pingVal !== undefined && (!Number.isFinite(pingVal) || pingVal < 0)) {
      return res.status(400).json({ error: 'ping must be a positive number' });
    }

    // Sestavíme UPDATE query pouze pro poskytnutá pole
    const updates = [];
    const values = [];

    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name.trim());
    }
    if (host !== undefined) {
      updates.push('host = ?');
      values.push(host.trim());
    }
    if (uploadVal !== undefined) {
      updates.push('upload = ?');
      values.push(uploadVal);
    }
    if (downloadVal !== undefined) {
      updates.push('download = ?');
      values.push(downloadVal);
    }
    if (pingVal !== undefined) {
      updates.push('ping = ?');
      values.push(pingVal);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    // Přidáme last_update timestamp
    updates.push('last_update = NOW()');

    values.push(harvesterId);
    await query(
      `UPDATE harvester SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    const updatedHarvester = await query(
      'SELECT id, name, host, upload, download, ping, last_update, created_at FROM harvester WHERE id = ?',
      [harvesterId]
    );

    const harvester = updatedHarvester[0];
    // Získáme status z harvester API
    harvester.status = await getHarvesterStatus(harvester.host);

    res.json(harvester);
  } catch (e) {
    next(e);
  }
});

/**
 * DELETE /api/v1/harvesters/:id
 * Smazání harvesteru
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'Invalid id' });
    }

    const result = await query('DELETE FROM harvester WHERE id = ?', [id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Harvester not found' });
    }

    res.json({ success: true, id });
  } catch (e) {
    next(e);
  }
});

/**
 * GET /api/v1/harvesters/:id/status
 * Získání aktuálního statusu z harvester API
 */
router.get('/:id/status', async (req, res, next) => {
  try {
    const idParam = req.params.id;
    let harvesterHost;

    // Najdi harvester podle ID nebo názvu
    if (/^\d+$/.test(idParam)) {
      const rows = await query('SELECT host FROM harvester WHERE id = ?', [Number(idParam)]);
      if (rows.length === 0) {
        return res.status(404).json({ error: 'Harvester not found' });
      }
      harvesterHost = rows[0].host;
    } else {
      const rows = await query('SELECT host FROM harvester WHERE name = ?', [idParam]);
      if (rows.length === 0) {
        return res.status(404).json({ error: `Harvester "${idParam}" not found` });
      }
      harvesterHost = rows[0].host;
    }

    try {
      // Zavolej harvester API pro aktuální status
      const status = await callHarvesterAPI(harvesterHost, '/status');
      res.json(status);
    } catch (apiError) {
      // Harvester API není dostupné
      res.status(503).json({ 
        error: 'Harvester API unavailable',
        details: apiError.message
      });
    }
  } catch (e) {
    next(e);
  }
});

/**
 * POST /api/v1/harvesters/:id/schedule
 * Forward schedule request na harvester
 */
router.post('/:id/schedule', async (req, res, next) => {
  try {
    const idParam = req.params.id;
    let harvesterHost;

    // Najdi harvester podle ID nebo názvu
    if (/^\d+$/.test(idParam)) {
      const rows = await query('SELECT host FROM harvester WHERE id = ?', [Number(idParam)]);
      if (rows.length === 0) {
        return res.status(404).json({ error: 'Harvester not found' });
      }
      harvesterHost = rows[0].host;
    } else {
      const rows = await query('SELECT host FROM harvester WHERE name = ?', [idParam]);
      if (rows.length === 0) {
        return res.status(404).json({ error: `Harvester "${idParam}" not found` });
      }
      harvesterHost = rows[0].host;
    }

    try {
      // Forward request na harvester API
      const result = await callHarvesterAPI(harvesterHost, '/schedule', 'POST', req.body);
      res.json(result);
    } catch (apiError) {
      res.status(503).json({ 
        error: 'Harvester API unavailable',
        details: apiError.message
      });
    }
  } catch (e) {
    next(e);
  }
});

/**
 * DELETE /api/v1/harvesters/:id/schedule/:jobId
 * Forward unschedule request na harvester
 */
router.delete('/:id/schedule/:jobId', async (req, res, next) => {
  try {
    const idParam = req.params.id;
    const jobId = req.params.jobId;
    let harvesterHost;

    // Najdi harvester podle ID nebo názvu
    if (/^\d+$/.test(idParam)) {
      const rows = await query('SELECT host FROM harvester WHERE id = ?', [Number(idParam)]);
      if (rows.length === 0) {
        return res.status(404).json({ error: 'Harvester not found' });
      }
      harvesterHost = rows[0].host;
    } else {
      const rows = await query('SELECT host FROM harvester WHERE name = ?', [idParam]);
      if (rows.length === 0) {
        return res.status(404).json({ error: `Harvester "${idParam}" not found` });
      }
      harvesterHost = rows[0].host;
    }

    try {
      // Forward request na harvester API
      const result = await callHarvesterAPI(harvesterHost, `/schedule/${jobId}`, 'DELETE');
      res.json(result);
    } catch (apiError) {
      res.status(503).json({ 
        error: 'Harvester API unavailable',
        details: apiError.message
      });
    }
  } catch (e) {
    next(e);
  }
});

/**
 * POST /api/v1/harvesters/:id/harvest
 * Forward immediate harvest request na harvester
 */
router.post('/:id/harvest', async (req, res, next) => {
  try {
    const idParam = req.params.id;
    let harvesterHost;

    // Najdi harvester podle ID nebo názvu
    if (/^\d+$/.test(idParam)) {
      const rows = await query('SELECT host FROM harvester WHERE id = ?', [Number(idParam)]);
      if (rows.length === 0) {
        return res.status(404).json({ error: 'Harvester not found' });
      }
      harvesterHost = rows[0].host;
    } else {
      const rows = await query('SELECT host FROM harvester WHERE name = ?', [idParam]);
      if (rows.length === 0) {
        return res.status(404).json({ error: `Harvester "${idParam}" not found` });
      }
      harvesterHost = rows[0].host;
    }

    try {
      // Forward request na harvester API
      const result = await callHarvesterAPI(harvesterHost, '/harvest', 'POST', req.body);
      res.json(result);
    } catch (apiError) {
      res.status(503).json({ 
        error: 'Harvester API unavailable',
        details: apiError.message
      });
    }
  } catch (e) {
    next(e);
  }
});

export default router;