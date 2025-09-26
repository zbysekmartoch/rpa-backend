import { Router } from 'express';
import { query } from '../db.js';

const r = Router();

r.get('/', async (req, res, next) => {
  try {
    const cats = []
    .concat(req.query.category || [])
    .flat()
    .map(String)
    .map(s => s.trim())
    .filter(Boolean);
  
  const mode = (req.query.mode || 'subtree');
  const limit = Math.min(Number(req.query.limit ?? 20000), 20000) || 20000;
  const offset = Math.max(Number(req.query.offset ?? 0), 0) || 0;
  
  if (cats.length === 0) return res.json({ items: [], limit, offset });
  
  const chunks = [];
  const params = [];
  for (const c of cats) {
    if (mode === 'subtree') {
      chunks.push(`(category LIKE CONCAT(?, '|%') OR category = CONCAT(?, '|', name))`);
      params.push(c, c);
    } else {
      chunks.push(`category = CONCAT(?, '|', name)`);
      params.push(c);
    }
  }
  const where = chunks.join(' OR ');
  
  // 👇 inline čísel (po validaci) – vyhne se bugům prepared statements
  const sql = `
    SELECT id, name, brand, category
    FROM product
    WHERE ${where}
    ORDER BY id
    LIMIT ${limit} OFFSET ${offset}
  `;
  
  const rows = await query(sql, params);
  res.json({ items: rows, limit, offset });
  
  } catch (e) { next(e); }
});

export default r;
