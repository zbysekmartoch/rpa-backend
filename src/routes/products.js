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
                chunks.push(`(p.category LIKE CONCAT(?, '|%') OR p.category = CONCAT(?, '|', p.name))`);
                params.push(c, c);
            } else {
                chunks.push(`p.category = CONCAT(?, '|', p.name)`);
                params.push(c);
            }
        }
        const where = chunks.join(' OR ');

        // Upravený dotaz s joinem na price tabulku
        const sql = `
    SELECT 
        p.id, 
        p.name, 
        p.brand, 
        p.category,
        COUNT(DISTINCT pr.seller) as sellerCount,
        COUNT(pr.id) as priceCount,
        min(pr.date) minDate,
        max(pr.date) maxDate
    FROM product p
    LEFT JOIN price pr ON pr.product_id = p.id AND pr.invalid = 0
    WHERE ${where}
    GROUP BY p.id #, p.name, p.brand, p.category
    ORDER BY p.id
    LIMIT ${limit} OFFSET ${offset}
  `;

        const rows = await query(sql, params);
        res.json({ items: rows, limit, offset });

    } catch (e) { next(e); }
});

export default r;
