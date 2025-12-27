#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const mysql = require('mysql2/promise');
const extract = require('extract-zip');
require('dotenv').config();

// Base directory paths
const BACKEND_DIR = __dirname;
const LOGS_DIR = path.join(BACKEND_DIR, '/logs');
const SQL_DIR = path.join(BACKEND_DIR, '/sql');
const PRODUCTS_IMG_DIR = path.join(BACKEND_DIR, '/common/img/products');


// Logger class for handling log and error files
class Logger {
  constructor() {
    const now = new Date();
    const timestamp = now.toISOString().replace(/[-:]/g, '').replace('T', '-').split('.')[0];
    const dateFormatted = timestamp.substring(0, 15); // YYYY-MM-DD-hhmm

    this.logFile = path.join(LOGS_DIR, `import-${dateFormatted}.log`);
    this.errFile = path.join(LOGS_DIR, `import-${dateFormatted}.err`);
    this.logContent = '';
    this.errContent = '';
  }

  async ensureLogsDir() {
    await fs.mkdir(LOGS_DIR, { recursive: true });
  }

  async log(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    console.log(message);
    this.logContent += logMessage;
    await fs.appendFile(this.logFile, logMessage, 'utf8');
  }

  async error(message, error = null) {
    const timestamp = new Date().toISOString();
    const errorMessage = error ? `[${timestamp}] ${message}: ${error.message}\n${error.stack}\n` : `[${timestamp}] ${message}\n`;
    console.error(message, error || '');
    this.errContent += errorMessage;
    await fs.appendFile(this.errFile, errorMessage, 'utf8');
  }

  getLogContent() {
    return this.logContent;
  }

  getErrorContent() {
    return this.errContent;
  }
}

// Main import class
class DataImporter {
  constructor(zipPath, logger) {
    this.zipPath = zipPath;
    this.logger = logger;
    this.connection = null;
    this.extractPath = null;
    this.importStartTime = null;
    this.importEndTime = null;
    this.stats = {
      productsProcessed: 0,
      productsInserted: 0,
      pricesProcessed: 0,
      pricesInserted: 0,
      filesProcessed: 0,
      imagesCopied: 0
    };
  }

  async connect() {
    try {
      this.connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT || 3306,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
      });
      await this.logger.log('Database connection established');
    } catch (error) {
      await this.logger.error('Failed to connect to database', error);
      throw error;
    }
  }

  async disconnect() {
    if (this.connection) {
      await this.connection.end();
      await this.logger.log('Database connection closed');
    }
  }

  async extractZip() {
    try {
      // Create temporary extraction directory
      this.extractPath = path.join(process.cwd(), 'temp_extract_' + Date.now());
      await fs.mkdir(this.extractPath, { recursive: true });

      await this.logger.log(`Extracting ZIP file: ${this.zipPath}`);
      await extract(this.zipPath, { dir: this.extractPath });
      await this.logger.log(`ZIP extracted to: ${this.extractPath}`);

      return this.extractPath;
    } catch (error) {
      await this.logger.error('Failed to extract ZIP file', error);
      throw error;
    }
  }

  async cleanup() {
    if (this.extractPath) {
      try {
        await this.logger.log('Cleaning up temporary files');
        await fs.rm(this.extractPath, { recursive: true, force: true });
      } catch (error) {
        await this.logger.error('Failed to cleanup temporary files', error);
      }
    }
  }

  async traverseDirectory(dirPath) {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          // Recursively traverse subdirectories
          await this.traverseDirectory(fullPath);
        } else if (entry.isFile() && entry.name.endsWith('.json')) {
          // Process JSON files
          await this.processJsonFile(fullPath, entry.name);
        } else if (entry.isFile() && /^product_.*\.jpg$/i.test(entry.name)) {
          // Copy product images to common/img/products/
          await this.copyProductImage(fullPath, entry.name);
        }
      }
    } catch (error) {
      await this.logger.error(`Failed to traverse directory: ${dirPath}`, error);
      throw error;
    }
  }

  async copyProductImage(filePath, fileName) {
    try {
      await fs.mkdir(PRODUCTS_IMG_DIR, { recursive: true });
      const destPath = path.join(PRODUCTS_IMG_DIR, fileName);
      await fs.copyFile(filePath, destPath);
      this.stats.imagesCopied++;
      await this.logger.log(`Copied product image: ${fileName}`);
    } catch (error) {
      await this.logger.error(`Failed to copy product image: ${fileName}`, error);
    }
  }

  async processJsonFile(filePath, fileName) {
    try {
      await this.logger.log(`Processing file: ${fileName}`);

      // Determine file type based on filename
      if (fileName.match(/\d{4}-\d{2}-\d{2}(-\d{4})?-products\.json$/)) {
        await this.processProductsFile(filePath, fileName);
      } else if (fileName.match(/\d{4}-\d{2}-\d{2}(-\d{4})?-prices\.json$/)) {
        await this.processPricesFile(filePath, fileName);
      } else {
        await this.logger.log(`Skipping file (unknown format): ${fileName}`);
      }

      this.stats.filesProcessed++;
    } catch (error) {
      await this.logger.error(`Failed to process file: ${fileName}`, error);
      throw error;
    }
  }

  extractDateFromFilename(fileName) {
    // Extract date from filename: YYYY-MM-DD or YYYY-MM-DD-hhmm
    const match = fileName.match(/^(\d{4}-\d{2}-\d{2})/);
    return match ? match[1] : null;
  }

  async processProductsFile(filePath, fileName) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const products = JSON.parse(content);

      if (!Array.isArray(products) || products.length === 0) {
        await this.logger.log(`No products found in file: ${fileName}`);
        return;
      }

      // Extract date from filename if not present in data
      const fileDate = this.extractDateFromFilename(fileName);

      // Prepare batch insert
      const values = [];
      const placeholders = [];

      for (const product of products) {
        const date = product.date || fileDate;

        if (!date) {
          await this.logger.error(`Product ${product.id} has no date and cannot extract from filename: ${fileName}`);
          continue;
        }

        values.push(
          product.id || '',
          product.name || '',
          product.url || '',
          product.priceText || '',
          product.seller || '',
          product.brand || '',
          product.category || '',
          date
        );

        placeholders.push('(?, ?, ?, ?, ?, ?, ?, ?)');
        this.stats.productsProcessed++;
      }

      if (placeholders.length > 0) {
        const query = `INSERT IGNORE INTO imp_product (\`id\`, \`name\`, \`url\`, \`priceText\`, \`seller\`, \`brand\`, \`category\`, \`date\`) VALUES ${placeholders.join(', ')}`;

        const [result] = await this.connection.execute(query, values);
        this.stats.productsInserted += result.affectedRows;

        await this.logger.log(`Inserted ${result.affectedRows} products from ${fileName} (${products.length} total in file)`);
      }
    } catch (error) {
      await this.logger.error(`Failed to process products file: ${fileName}`, error);
      throw error;
    }
  }

  async processPricesFile(filePath, fileName) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const prices = JSON.parse(content);

      if (!Array.isArray(prices) || prices.length === 0) {
        await this.logger.log(`No prices found in file: ${fileName}`);
        return;
      }

      // Extract date from filename if not present in data
      const fileDate = this.extractDateFromFilename(fileName);

      // Prepare batch insert
      const values = [];
      const placeholders = [];

      for (const priceEntry of prices) {
        const date = priceEntry.date || fileDate;

        if (!date) {
          await this.logger.error(`Price entry for product ${priceEntry.productId} has no date and cannot extract from filename: ${fileName}`);
          continue;
        }

        values.push(
          priceEntry.price || '',
          priceEntry.seller || '',
          priceEntry.productId || '',
          date
        );

        placeholders.push('(?, ?, ?, ?)');
        this.stats.pricesProcessed++;
      }

      if (placeholders.length > 0) {
        const query = `INSERT IGNORE INTO imp_price (\`price\`, \`seller\`, \`productId\`, \`date\`) VALUES ${placeholders.join(', ')}`;

        const [result] = await this.connection.execute(query, values);
        this.stats.pricesInserted += result.affectedRows;

        await this.logger.log(`Inserted ${result.affectedRows} prices from ${fileName} (${prices.length} total in file)`);
      }
    } catch (error) {
      await this.logger.error(`Failed to process prices file: ${fileName}`, error);
      throw error;
    }
  }

  async executeSQLSeries(fileName) {
    const sqlFilePath = path.join(SQL_DIR, fileName);

    try {
      // Check if sql file exists
      await fs.access(sqlFilePath);

      await this.logger.log(`Executing ${fileName} queries`);

      const sqlContent = await fs.readFile(sqlFilePath, 'utf8');

      // Split by semicolons to get individual queries
      const queries = sqlContent
        .split(';')
        .map(q => q.trim())
        .filter(q => q.length > 0);

      for (let i = 0; i < queries.length; i++) {
        const query = queries[i];
        await this.logger.log(`Executing query ${i + 1}/${queries.length}`);

        try {
          await this.connection.execute(query);
          await this.logger.log(`Query ${i + 1} completed successfully`);
        } catch (error) {
          await this.logger.error(`Query ${i + 1} failed: ${query.substring(0, 100)}...`, error);
          throw error;
        }
      }

      await this.logger.log(`All ${fileName} queries executed successfully`);
    } catch (error) {
      if (error.code === 'ENOENT') {
        await this.logger.log(`${fileName} not found, skipping queries`);
      } else {
        await this.logger.error(`Failed to execute ${fileName}`, error);
        throw error;
      }
    }

  }

  async executeAfterImportSQL() {
    await this.executeSQLSeries('after-import.sql');
  }

  async beforeImportSQL() {
    await this.executeSQLSeries('before-import.sql');
  }

  async ensureImportLogTable() {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS importlog (
        id INT AUTO_INCREMENT PRIMARY KEY,
        import_start DATETIME NOT NULL,
        import_end DATETIME DEFAULT NULL,
        product_count INT DEFAULT 0,
        price_count INT DEFAULT 0,
        images_copied INT DEFAULT 0,
        files_processed INT DEFAULT 0,
        zip_file VARCHAR(500) DEFAULT NULL,
        log_content LONGTEXT DEFAULT NULL,
        error_content LONGTEXT DEFAULT NULL,
        status ENUM('running', 'completed', 'failed') DEFAULT 'running',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `;
    await this.connection.execute(createTableQuery);
    await this.logger.log('Import log table ensured');
  }

  async createImportLogEntry() {
    const query = `
      INSERT INTO importlog (import_start, zip_file, status)
      VALUES (NOW(), ?, 'running')
    `;
    const [result] = await this.connection.execute(query, [this.zipPath]);
    this.importLogId = result.insertId;
    await this.logger.log(`Import log entry created with ID: ${this.importLogId}`);
  }

  async updateImportLogEntry(status = 'completed') {
    const query = `
      UPDATE importlog
      SET import_end = NOW(),
          product_count = ?,
          price_count = ?,
          images_copied = ?,
          files_processed = ?,
          log_content = ?,
          error_content = ?,
          status = ?
      WHERE id = ?
    `;
    await this.connection.execute(query, [
      this.stats.productsInserted,
      this.stats.pricesInserted,
      this.stats.imagesCopied,
      this.stats.filesProcessed,
      this.logger.getLogContent(),
      this.logger.getErrorContent(),
      status,
      this.importLogId
    ]);
    await this.logger.log(`Import log entry updated with status: ${status}`);
  }

  async run() {
    let importFailed = false;
    try {
      this.importStartTime = new Date();
      await this.logger.log('=== Import process started ===');
      await this.logger.log(`ZIP file: ${this.zipPath}`);

      // Verify ZIP file exists
      await fs.access(this.zipPath);

      // Connect to database
      await this.connect();

      // Ensure import log table exists and create entry
      await this.ensureImportLogTable();
      await this.createImportLogEntry();

      await this.beforeImportSQL();
      // Extract ZIP
      const extractedPath = await this.extractZip();

      // Traverse and process all JSON files and product images
      await this.traverseDirectory(extractedPath);

      // Execute after-import SQL queries
      await this.executeAfterImportSQL();

      // Log statistics
      this.importEndTime = new Date();
      await this.logger.log('=== Import statistics ===');
      await this.logger.log(`Files processed: ${this.stats.filesProcessed}`);
      await this.logger.log(`Products processed: ${this.stats.productsProcessed}`);
      await this.logger.log(`Products inserted: ${this.stats.productsInserted}`);
      await this.logger.log(`Prices processed: ${this.stats.pricesProcessed}`);
      await this.logger.log(`Prices inserted: ${this.stats.pricesInserted}`);
      await this.logger.log(`Images copied: ${this.stats.imagesCopied}`);
      await this.logger.log('=== Import completed successfully ===');

      // Update import log entry
      await this.updateImportLogEntry('completed');

    } catch (error) {
      importFailed = true;
      await this.logger.error('Import process failed', error);
      // Try to update import log with failed status
      if (this.importLogId && this.connection) {
        try {
          await this.updateImportLogEntry('failed');
        } catch (logError) {
          await this.logger.error('Failed to update import log', logError);
        }
      }
      throw error;
    } finally {
      // Cleanup
      await this.disconnect();
      await this.cleanup();
    }
  }
}

// Main execution
async function main() {
  const logger = new Logger();

  try {
    // Ensure logs directory exists
    await logger.ensureLogsDir();

    // Check command line arguments
    const args = process.argv.slice(2);

    if (args.length === 0) {
      await logger.error('Usage: node import-data.cjs <path-to-zip-file>');
      process.exit(1);
    }

    const zipPath = path.resolve(args[0]);

    // Create and run importer
    const importer = new DataImporter(zipPath, logger);
    await importer.run();

    process.exit(0);
  } catch (error) {
    await logger.error('Fatal error', error);
    process.exit(1);
  }
}

// Run main function
main();
