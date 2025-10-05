// src/routes/index.js – hlavní router backendu
import { Router } from 'express';
import { notFound, errorHandler } from '../middleware/error.js';
import categoriesTree from './categories-tree.js'; // nový stromový endpoint
import products from './products.js';
import baskets from './baskets.js'; 
import analyses from './analyses.js'; 
import results from './results.js';
import harvesters from './harvesters.js';
import workflows from './workflows.js';
import auth from './auth.js';
import dataSources from './data-sources.js';
import harvestSchedule from './harvest-schedule.js';

const router = Router();

// Základní healthcheck (případně můžeš mít v samostatném souboru)
router.get('/health', (req, res) => {
  res.json({ ok: true });
});

// API routes
router.use('/v1/categories', categoriesTree);
router.use('/v1/products', products);
router.use('/v1/baskets', baskets);
router.use('/v1/analyses', analyses);
router.use('/v1/results', results);
router.use('/v1/harvesters', harvesters);
router.use('/v1/workflows', workflows);
router.use('/v1/data-sources', dataSources);
router.use('/v1/harvest-schedule', harvestSchedule);
router.use('/v1/auth', auth);
// Middleware na konec
router.use(notFound);
router.use(errorHandler);

export default router;
