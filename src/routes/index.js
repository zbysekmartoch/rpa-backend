// src/routes/index.js – hlavní router backendu
import { Router } from 'express';
import { notFound, errorHandler } from '../middleware/error.js';
import { config } from '../config.js';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';
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
import harvest from './harvest.js';
import scripts from './scripts.js';
import { authenticateToken } from '../middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();

// Rozšířený healthcheck s informacemi o systému
router.get('/health', async (req, res) => {
  try {
    // Načti verzi z package.json
    const packageJsonPath = path.join(__dirname, '../../package.json');
    let version = 'unknown';
    let appName = 'rpa-backend';
    
    try {
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
      version = packageJson.version || 'unknown';
      appName = packageJson.name || 'rpa-backend';
    } catch (e) {
      console.warn('Failed to read package.json:', e.message);
    }

    // Získej hostname a port
    const hostname = os.hostname();
    const port = config.port || process.env.PORT || 3000;

    res.json({ 
      ok: true,
      service: appName,
      version: version,
      build: process.env.BUILD_NUMBER || process.env.npm_package_version || version,
      server: {
        host: hostname,
        port: port,
        nodeVersion: process.version,
        platform: process.platform,
        uptime: process.uptime()
      },
      database: {
        host: config.db.host,
 //       port: config.db.port,
        name: config.db.database,
 //       user: config.db.user
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      ok: false, 
      error: 'Health check failed',
      message: error.message 
    });
  }
});

// API routes - auth endpoint bez autentifikace
router.use('/v1/auth', auth);

// Všechny ostatní v1 routes vyžadují autentifikaci
router.use('/v1/categories', authenticateToken, categoriesTree);
router.use('/v1/products', authenticateToken, products);
router.use('/v1/baskets', authenticateToken, baskets);
router.use('/v1/analyses', authenticateToken, analyses);
router.use('/v1/results', authenticateToken, results);
router.use('/v1/harvesters', authenticateToken, harvesters);
router.use('/v1/workflows', authenticateToken, workflows);
router.use('/v1/data-sources', authenticateToken, dataSources);
router.use('/v1/harvest-schedule', authenticateToken, harvestSchedule);
router.use('/v1/harvest', authenticateToken, harvest);
router.use('/v1/scripts', authenticateToken, scripts);
// Middleware na konec
router.use(notFound);
router.use(errorHandler);

export default router;
