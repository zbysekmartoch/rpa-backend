# Data Importer

Node.js script for importing data from ZIP archives into a MySQL database.

## Installation

```bash
npm install
```

## Configuration

Set database connection credentials in the `.env` file:

```
DB_HOST=localhost
DB_PORT=3306
DB_USER=your_username
DB_PASSWORD=your_password
DB_NAME=your_database
```

## Usage

```bash
node import-data.cjs <path-to-zip-file>
```

Example:
```bash
node import-data.cjs /path/to/data.zip
```

## Data Structure

### Product Files

Files with names matching the pattern:
- `YYYY-MM-DD-hhmm-products.json` (newer version)
- `YYYY-MM-DD-products.json` (older version)

JSON structure:
```json
[
  {
    "id": "657762069",
    "name": "Bambu Lab P1S Combo",
    "url": "https://example.com/product",
    "priceText": "699,00 – 1 267,92 €",
    "seller": "in 10 stores",
    "brand": "Bambu Lab",
    "category": "Heureka.sk|Electronics|...",
    "date": "2025-10-05",
    "harvested_at": "2025-10-05 18:50:10"
  }
]
```

### Price Files

Files with names matching the pattern:
- `YYYY-MM-DD-hhmm-prices.json` (newer version)
- `YYYY-MM-DD-prices.json` (older version)

JSON structure:
```json
[
  {
    "price": "820 €",
    "seller": "Logo PCRobot.sk",
    "productId": "657762069",
    "date": "2025-10-12",
    "harvested_at": "2025-10-12 18:50:19"
  }
]
```

### Product Images

Files matching the pattern `product_*.jpg` are automatically copied to `common/img/products/` directory.

## Database Tables

### imp_product

```sql
CREATE TABLE imp_product (
  id VARCHAR(255),
  name VARCHAR(255),
  url VARCHAR(1500),
  priceText VARCHAR(255),
  seller VARCHAR(255),
  brand VARCHAR(255),
  category VARCHAR(255),
  date DATE,
  UNIQUE KEY (id, date)
);
```

### imp_price

```sql
CREATE TABLE imp_price (
  price VARCHAR(255),
  seller VARCHAR(255),
  productId VARCHAR(255),
  date DATE,
  UNIQUE KEY (date, seller, productId)
);
```

### importlog

The script automatically creates an `importlog` table to track all imports:

```sql
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
);
```

## SQL Scripts

SQL scripts are located in the `sql/` directory:

- `before-import.sql` - Executed before data import (e.g., truncating temporary tables)
- `after-import.sql` - Executed after data import (e.g., data transformations, statistics)

## Logging

The script creates log files in the `logs/` directory:
- `logs/import-YYYY-MM-DD-hhmm.log` - Standard logs
- `logs/import-YYYY-MM-DD-hhmm.err` - Error logs

Additionally, all logs are stored in the `importlog` database table for each import.

## Directory Structure

```
backend/
├── import-data.cjs      # Main import script
├── common/
│   └── img/
│       └── products/    # Product images copied from ZIP
├── logs/                # Import log files
│   ├── import-*.log
│   └── import-*.err
└── sql/
    ├── before-import.sql
    └── after-import.sql
```

## Features

- ZIP archive extraction
- Recursive directory traversal
- Processing of product and price JSON files
- Automatic product image copying (`product_*.jpg`)
- Support for older and newer file formats
- Automatic date extraction from filenames
- Batch INSERT operations for fast import
- INSERT IGNORE to prevent duplicates
- Pre-import and post-import SQL execution
- Import logging to database table
- Detailed file logging
- Automatic cleanup of temporary files
- Comprehensive error handling
