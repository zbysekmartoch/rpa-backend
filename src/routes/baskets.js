// backend/src/routes/baskets.js
import { Router } from 'express';
import { query } from '../db.js';

const router = Router();

/**
 * GET /api/v1/baskets
 * Volitelné: ?search=... (fulltext name, LIKE), bez limitu pokud nechceš stránkovat
 */
router.get('/', async (req, res, next) => {
  try {
    const { search } = req.query;
    const params = [];
    let where = '';
    if (search && search.trim()) {
      where = 'WHERE b.name LIKE ?';
      params.push(`%${search.trim()}%`);
    }

    const rows = await query(
      `
      SELECT b.id, b.name, b.created_at, COUNT(bp.product_id) AS itemCount
      FROM basket b
      LEFT JOIN bp ON bp.basket_id = b.id
      ${where}
      GROUP BY b.id
      ORDER BY b.id
      `
    , params);

    res.json({ items: rows });
  } catch (e) {
    next(e);
  }
});

/**
 * GET /api/v1/baskets/:id/products
 * Vrátí produkty v konkrétním košíku.
 */
router.get('/:id/products', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid basket id' });

    const rows = await query(
      `
      SELECT p.id, p.name, p.brand, p.category
      FROM bp
      JOIN product p ON p.id = bp.product_id
      WHERE bp.basket_id = ?
      ORDER BY p.id
      `
    , [id]);

    res.json({ items: rows });
  } catch (e) {
    next(e);
  }
});

/**
 * POST /api/v1/baskets { name }
 */
router.post('/', async (req, res, next) => {
  try {
    const { name } = req.body ?? {};
    if (!name || String(name).trim().length === 0) {
      return res.status(400).json({ error: 'name is required' });
    }
    const result = await query(
      'INSERT INTO basket (name) VALUES (?)',
      [String(name).trim()]
    );
    res.status(201).json({ id: result.insertId, name: String(name).trim() });
  } catch (e) {
    // unikátní jméno
    if (e?.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Basket name already exists' });
    }
    next(e);
  }
});

/**
 * PUT /api/v1/baskets/:id { name }
 */
router.put('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { name } = req.body ?? {};
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid basket id' });
    if (!name || String(name).trim().length === 0) {
      return res.status(400).json({ error: 'name is required' });
    }
    const r = await query('UPDATE basket SET name = ? WHERE id = ?', [String(name).trim(), id]);
    if (r.affectedRows === 0) return res.status(404).json({ error: 'Basket not found' });
    res.json({ id, name: String(name).trim() });
  } catch (e) {
    if (e?.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Basket name already exists' });
    }
    next(e);
  }
});

/**
 * DELETE /api/v1/baskets/:id
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid basket id' });
    const r = await query('DELETE FROM basket WHERE id = ?', [id]);
    if (r.affectedRows === 0) return res.status(404).json({ error: 'Basket not found' });
    
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

/**
 * (Volitelné do budoucna)
 * POST /api/v1/baskets/:id/products { productIds: number[] }  — hromadné přidání
 * DELETE /api/v1/baskets/:id/products/:productId              — odebrání
 */
router.post('/:id/products', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { productIds } = req.body ?? {};
    if (!Number.isInteger(id) || !Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({ error: 'invalid arguments' });
    }
    
    let values=productIds.map((pid)=>`(${id},'${pid}')`);
    let data=values.join(',');

    let stmt=`INSERT IGNORE INTO bp (basket_id, product_id) VALUES ${data}`;
    await query(stmt);
    res.status(204).end();
  } catch (e) { next(e); }
});

router.delete('/:id/products/:productId', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const pid = Number(req.params.productId);
    if (!Number.isInteger(id) || !Number.isInteger(pid)) {
      return res.status(400).json({ error: 'invalid ids' });
    }
    await query('DELETE FROM bp WHERE basket_id = ? AND product_id = ?', [id, pid]);
    res.status(204).end();
  } catch (e) { next(e); }
});

export default router;
