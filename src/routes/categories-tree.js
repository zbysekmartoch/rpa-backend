// File: src/routes/categories-tree.js
// =============================
import { Router } from 'express';
import { query } from '../db.js';

const r = Router();

function ensureNode(map, parent, name) {
  const path = parent ? `${parent}|${name}` : name;
  if (!map.has(path)) {
    map.set(path, { name, path, productCount: 0, children: new Map() });
  }
  return map.get(path);
}

r.get('/tree', async (req, res, next) => {
  try {
    const rows = await query(`SELECT category FROM product`);

    // root is a Map of name->node; each node has children: Map as well
    const root = new Map();
    const allNodes = new Map();

    for (const row of rows) {
      const parts = String(row.category).split('|');
      if (parts.length < 2) continue; // expect at least one category + product name
      const catParts = parts.slice(0, -1); // drop product name

      let parentPath = '';
      let parentMap = root;
      for (let i = 0; i < catParts.length; i++) {
        const name = catParts[i];
        const path = parentPath ? `${parentPath}|${name}` : name;
        // create node if not exist
        let node = allNodes.get(path);
        if (!node) {
          node = { name, path, productCount: 0, children: new Map() };
          allNodes.set(path, node);
          // attach to parent map
          parentMap.set(name, node);
        }
        // increment counts for each level along the path
        node.productCount += 1;
        // advance
        parentMap = node.children;
        parentPath = path;
      }
    }

    // convert Maps to arrays recursively and sort by productCount desc then name
    function toArray(map) {
      const arr = Array.from(map.values()).map(n => ({
        name: n.name,
        path: n.path,
        productCount: n.productCount,
        children: toArray(n.children)
      }));
      arr.sort((a,b) => b.productCount - a.productCount || a.name.localeCompare(b.name));
      return arr;
    }

    res.json(toArray(root));
  } catch (e) { next(e); }
});

export default r;
