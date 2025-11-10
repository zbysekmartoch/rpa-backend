// backend/src/routes/baskets.js
import { Router } from 'express';
import { query } from '../db.js';

const router = Router();

/**
 * GET /api/v1/baskets
 * Vrátí košíky pro přihlášeného uživatele:
 * - Košíky kde usr_id = ID uživatele
 * - Košíky kde usr_id = 0 (sdílené všem)
 * 
 * Volitelné: ?search=... (fulltext name, LIKE)
 */
router.get('/', async (req, res, next) => {
  try {
    const { search } = req.query;
    const userId = req.userId; // Z JWT middleware
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const params = [userId];
    const conditions = ['(b.usr_id = ? OR b.usr_id = 0)'];
    
    if (search && search.trim()) {
      conditions.push('b.name LIKE ?');
      params.push(`%${search.trim()}%`);
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    const rows = await query(
      `
      SELECT 
        b.id, 
        b.name, 
        b.usr_id,
        b.created_at, 
        COUNT(bp.product_id) AS itemCount,
        CASE WHEN b.usr_id = 0 THEN 1 ELSE 0 END AS isShared
      FROM basket b
      LEFT JOIN bp ON bp.basket_id = b.id
      ${where}
      GROUP BY b.id
      ORDER BY b.usr_id DESC, b.id
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
 * Uživatel musí mít přístup ke košíku (svůj nebo sdílený).
 */
router.get('/:id/products', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const userId = req.userId;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'Invalid basket id' });
    }

    // Ověř že košík existuje a uživatel má k němu přístup
    const basketCheck = await query(
      'SELECT id, usr_id FROM basket WHERE id = ? AND (usr_id = ? OR usr_id = 0)',
      [id, userId]
    );
    
    if (basketCheck.length === 0) {
      return res.status(404).json({ error: 'Basket not found or access denied' });
    }

    const rows = await query(
      `
    SELECT p.id, p.name, p.brand, p.category,p.url,
    COUNT(DISTINCT pr.seller) as sellerCount,
    COUNT(pr.id) as priceCount,
    min(pr.date) minDate,
    max(pr.date) maxDate
    FROM bp
    JOIN product p ON p.id = bp.product_id
    LEFT JOIN price pr ON pr.product_id = p.id AND pr.invalid = 0
    WHERE bp.basket_id = ?
    GROUP BY p.id
    ORDER BY p.id`
    , [id]);

    res.json({ items: rows });
  } catch (e) {
    next(e);
  }
});

/**
 * POST /api/v1/baskets { name, usr_id? }
 * Vytvoří nový košík.
 * - Pokud není usr_id zadáno, použije se ID přihlášeného uživatele
 * - usr_id = 0 vytvoří sdílený košík (viditelný pro všechny)
 */
router.post('/', async (req, res, next) => {
  try {
    const { name, usr_id } = req.body ?? {};
    const userId = req.userId;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    if (!name || String(name).trim().length === 0) {
      return res.status(400).json({ error: 'name is required' });
    }
    
    // Pokud usr_id není zadáno, použij ID uživatele; pokud je zadáno, validuj
    let targetUsrId = userId;
    if (usr_id !== undefined) {
      const numUsrId = Number(usr_id);
      if (!Number.isInteger(numUsrId) || numUsrId < 0) {
        return res.status(400).json({ error: 'usr_id must be a non-negative integer' });
      }
      targetUsrId = numUsrId;
    }
    
    const result = await query(
      'INSERT INTO basket (name, usr_id) VALUES (?, ?)',
      [String(name).trim(), targetUsrId]
    );
    
    res.status(201).json({ 
      id: result.insertId, 
      name: String(name).trim(),
      usr_id: targetUsrId,
      isShared: targetUsrId === 0
    });
  } catch (e) {
    // unikátní jméno
    if (e?.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Basket name already exists' });
    }
    next(e);
  }
});

/**
 * PUT /api/v1/baskets/:id { name?, usr_id? }
 * Aktualizuje košík. Uživatel může editovat pouze své košíky nebo sdílené (usr_id=0).
 */
router.put('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { name, usr_id } = req.body ?? {};
    const userId = req.userId;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'Invalid basket id' });
    }
    
    // Ověř že košík existuje a uživatel má právo ho editovat
    const existing = await query(
      'SELECT id, name, usr_id FROM basket WHERE id = ?',
      [id]
    );
    
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Basket not found' });
    }
    
    const basket = existing[0];
    
    // Uživatel může editovat pouze své košíky nebo sdílené
    if (basket.usr_id !== userId && basket.usr_id !== 0) {
      return res.status(403).json({ error: 'You do not have permission to edit this basket' });
    }
    
    // Sestavíme UPDATE
    const updates = [];
    const values = [];
    
    if (name !== undefined) {
      if (String(name).trim().length === 0) {
        return res.status(400).json({ error: 'name cannot be empty' });
      }
      updates.push('name = ?');
      values.push(String(name).trim());
    }
    
    if (usr_id !== undefined) {
      const numUsrId = Number(usr_id);
      if (!Number.isInteger(numUsrId) || numUsrId < 0) {
        return res.status(400).json({ error: 'usr_id must be a non-negative integer' });
      }
      updates.push('usr_id = ?');
      values.push(numUsrId);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    values.push(id);
    const r = await query(
      `UPDATE basket SET ${updates.join(', ')} WHERE id = ?`,
      values
    );
    
    // Vrať aktualizovaný košík
    const updated = await query(
      'SELECT id, name, usr_id FROM basket WHERE id = ?',
      [id]
    );
    
    res.json({ 
      ...updated[0],
      isShared: updated[0].usr_id === 0
    });
  } catch (e) {
    if (e?.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Basket name already exists' });
    }
    next(e);
  }
});

/**
 * DELETE /api/v1/baskets/:id
 * Smaže košík. Uživatel může mazat pouze své košíky nebo sdílené (usr_id=0).
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const userId = req.userId;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'Invalid basket id' });
    }
    
    // Ověř že košík existuje a uživatel má právo ho smazat
    const existing = await query(
      'SELECT id, usr_id FROM basket WHERE id = ?',
      [id]
    );
    
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Basket not found' });
    }
    
    const basket = existing[0];
    
    // Uživatel může mazat pouze své košíky nebo sdílené
    if (basket.usr_id !== userId && basket.usr_id !== 0) {
      return res.status(403).json({ error: 'You do not have permission to delete this basket' });
    }
    
    const r = await query('DELETE FROM basket WHERE id = ?', [id]);
    
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

/**
 * POST /api/v1/baskets/:id/products { productIds: number[] }
 * Hromadné přidání produktů do košíku.
 * Uživatel musí mít právo editovat košík (svůj nebo sdílený).
 */
router.post('/:id/products', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { productIds } = req.body ?? {};
    const userId = req.userId;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    if (!Number.isInteger(id) || !Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({ error: 'invalid arguments' });
    }
    
    // Ověř přístup ke košíku
    const basketCheck = await query(
      'SELECT id, usr_id FROM basket WHERE id = ? AND (usr_id = ? OR usr_id = 0)',
      [id, userId]
    );
    
    if (basketCheck.length === 0) {
      return res.status(404).json({ error: 'Basket not found or access denied' });
    }
    
    let values = productIds.map((pid) => `(${id},'${pid}')`);
    let data = values.join(',');

    let stmt = `INSERT IGNORE INTO bp (basket_id, product_id) VALUES ${data}`;
    await query(stmt);
    res.status(204).end();
  } catch (e) { next(e); }
});

/**
 * DELETE /api/v1/baskets/:id/products/:productId
 * Odebrání produktu z košíku.
 * Uživatel musí mít právo editovat košík (svůj nebo sdílený).
 */
router.delete('/:id/products/:productId', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const pid = Number(req.params.productId);
    const userId = req.userId;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    if (!Number.isInteger(id) || !Number.isInteger(pid)) {
      return res.status(400).json({ error: 'invalid ids' });
    }
    
    // Ověř přístup ke košíku
    const basketCheck = await query(
      'SELECT id, usr_id FROM basket WHERE id = ? AND (usr_id = ? OR usr_id = 0)',
      [id, userId]
    );
    
    if (basketCheck.length === 0) {
      return res.status(404).json({ error: 'Basket not found or access denied' });
    }
    
    await query('DELETE FROM bp WHERE basket_id = ? AND product_id = ?', [id, pid]);
    res.status(204).end();
  } catch (e) { next(e); }
});

export default router;
