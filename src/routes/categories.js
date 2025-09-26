// src/routes/categories.js
import { Router } from 'express';
import { query } from '../db.js';

const r = Router();

r.get('/', async (req, res, next) => {
  try {
    const parent = (req.query.parent || '').trim(); // "" = root
    const like = parent ? `${parent}|%` : '%';

    // stáhneme jen potřebné sloupce
    const rows = await query(
      `SELECT id, name, category FROM product WHERE category LIKE ?`,
      [like]
    );

    // vytvoříme mapu child uzlů a počtů
    const childMap = new Map(); // key: childPath, value: {name, path, count}
    for (const row of rows) {
      const parts = row.category.split('|');
      // poslední token je název produktu → ignorovat
      const catParts = parts.slice(0, -1);
      if (parent) {
        if (!row.category.startsWith(parent + '|')) continue;
        const depthParent = parent.split('|').length;
        const childName = catParts[depthParent]; // první úroveň pod parentem
        if (!childName) continue; // produkt má jen parent bez další podúrovně
        const childPath = parent ? `${parent}|${childName}` : childName;
        const entry = childMap.get(childPath) || { name: childName, path: childPath, productCount: 0 };
        entry.productCount += 1;
        childMap.set(childPath, entry);
      } else {
        // root: první token
        const childName = catParts[0];
        if (!childName) continue;
        const childPath = childName;
        const entry = childMap.get(childPath) || { name: childName, path: childPath, productCount: 0 };
        entry.productCount += 1;
        childMap.set(childPath, entry);
      }
    }

    const result = Array.from(childMap.values())
      .map(x => ({ ...x, depth: x.path.split('|').length, childrenCount: undefined }))
      .sort((a,b) => b.productCount - a.productCount || a.name.localeCompare(b.name));

    res.json(result);
  } catch (e) { next(e); }
});

export default r;
