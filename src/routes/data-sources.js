import { Router } from 'express';
import { query } from '../db.js';

const router = Router();

/**
 * GET /api/v1/data-sources
 * Seznam všech datových zdrojů
 */
router.get('/', async (req, res, next) => {
  try {
    const rows = await query(
      'SELECT id, name, urls, created_at, updated_at FROM ds ORDER BY id DESC'
    );

    // Zpracuj URLs - rozdělíme na array podle řádků
    const dataSources = rows.map(row => ({
      ...row,
      urls: row.urls ? row.urls.split('\n').map(url => url.trim()).filter(Boolean) : []
    }));

    res.json({ items: dataSources });
  } catch (e) {
    next(e);
  }
});

/**
 * GET /api/v1/data-sources/:id
 * Detail datového zdroje
 */
router.get('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'Invalid id' });
    }

    const rows = await query(
      'SELECT id, name, urls, created_at, updated_at FROM ds WHERE id = ?',
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Data source not found' });
    }

    const dataSource = rows[0];
    // Zpracuj URLs na array
    dataSource.urls = dataSource.urls ? dataSource.urls.split('\n').map(url => url.trim()).filter(Boolean) : [];

    res.json(dataSource);
  } catch (e) {
    next(e);
  }
});

/**
 * POST /api/v1/data-sources
 * Vytvoření nového datového zdroje
 */
router.post('/', async (req, res, next) => {
  try {
    const { name, urls } = req.body ?? {};
    
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'name is required and must be non-empty string' });
    }

    // URLs může být array nebo string
    let urlsText = '';
    if (Array.isArray(urls)) {
      urlsText = urls.filter(url => url && typeof url === 'string' && url.trim()).join('\n');
    } else if (typeof urls === 'string') {
      urlsText = urls.trim();
    }

    const result = await query(
      'INSERT INTO ds (name, urls) VALUES (?, ?)',
      [name.trim(), urlsText]
    );

    const newDataSource = await query(
      'SELECT id, name, urls, created_at, updated_at FROM ds WHERE id = ?',
      [result.insertId]
    );

    const dataSource = newDataSource[0];
    // Zpracuj URLs na array pro response
    dataSource.urls = dataSource.urls ? dataSource.urls.split('\n').map(url => url.trim()).filter(Boolean) : [];

    res.status(201).json(dataSource);
  } catch (e) {
    next(e);
  }
});

/**
 * PUT /api/v1/data-sources/:id
 * Aktualizace datového zdroje
 */
router.put('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'Invalid id' });
    }

    const { name, urls } = req.body ?? {};

    // Validace
    if (name !== undefined && (typeof name !== 'string' || !name.trim())) {
      return res.status(400).json({ error: 'name must be non-empty string' });
    }

    // Sestavíme UPDATE query pouze pro poskytnutá pole
    const updates = [];
    const values = [];

    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name.trim());
    }

    if (urls !== undefined) {
      let urlsText = '';
      if (Array.isArray(urls)) {
        urlsText = urls.filter(url => url && typeof url === 'string' && url.trim()).join('\n');
      } else if (typeof urls === 'string') {
        urlsText = urls.trim();
      }
      updates.push('urls = ?');
      values.push(urlsText);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(id);
    const result = await query(
      `UPDATE ds SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Data source not found' });
    }

    const updatedDataSource = await query(
      'SELECT id, name, urls, created_at, updated_at FROM ds WHERE id = ?',
      [id]
    );

    const dataSource = updatedDataSource[0];
    // Zpracuj URLs na array pro response
    dataSource.urls = dataSource.urls ? dataSource.urls.split('\n').map(url => url.trim()).filter(Boolean) : [];

    res.json(dataSource);
  } catch (e) {
    next(e);
  }
});

/**
 * DELETE /api/v1/data-sources/:id
 * Smazání datového zdroje
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'Invalid id' });
    }

    const result = await query('DELETE FROM ds WHERE id = ?', [id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Data source not found' });
    }

    res.json({ success: true, id });
  } catch (e) {
    next(e);
  }
});

export default router;