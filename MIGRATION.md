# Database Migration Guide

This document describes all database changes and migrations for RPA Backend.

## Base Tables

### 1. Users (usr)
```sql
CREATE TABLE usr (
  id INT AUTO_INCREMENT PRIMARY KEY,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### 2. Products (product)
```sql
CREATE TABLE product (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  brand VARCHAR(255),
  category VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 3. Baskets (basket)
```sql
CREATE TABLE basket (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### 4. Basket Products (bp)
```sql
CREATE TABLE bp (
  basket_id INT,
  product_id INT,
  PRIMARY KEY (basket_id, product_id),
  FOREIGN KEY (basket_id) REFERENCES basket(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES product(id) ON DELETE CASCADE
);
```

### 5. Analyses (analysis)
```sql
CREATE TABLE analysis (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  settings TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### 6. Results (result)
```sql
CREATE TABLE result (
  id INT AUTO_INCREMENT PRIMARY KEY,
  analysis_id INT,
  status ENUM('pending', 'completed', 'failed') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (analysis_id) REFERENCES analysis(id) ON DELETE CASCADE
);
```

## New Tables (in order of creation)

### 7. Harvesters (harvester)
```sql
CREATE TABLE harvester (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  host VARCHAR(255) NOT NULL,
  upload DECIMAL(10,2) NULL COMMENT 'Upload speed in Mbps',
  download DECIMAL(10,2) NULL COMMENT 'Download speed in Mbps', 
  ping DECIMAL(10,2) NULL COMMENT 'Ping in ms',
  last_update TIMESTAMP NULL COMMENT 'Last status update timestamp',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_name (name),
  INDEX idx_host (host)
);
```

### 8. Data Sources (ds)
```sql
CREATE TABLE ds (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  urls TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### 9. Harvest Schedule (schedule)
```sql
CREATE TABLE schedule (
  id INT AUTO_INCREMENT PRIMARY KEY,
  harvester_id INT NOT NULL,
  datasource_id INT NOT NULL,
  cron_expression VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (harvester_id) REFERENCES harvester(id) ON DELETE CASCADE,
  FOREIGN KEY (datasource_id) REFERENCES ds(id) ON DELETE CASCADE,
  
  INDEX idx_harvester (harvester_id),
  INDEX idx_datasource (datasource_id),
  INDEX idx_cron (cron_expression)
);
```

## Step-by-Step Migration

### Step 1: Create Base Tables
```bash
# If you don't have base tables, create them:
mysql -u root -p your_database_name < basic_tables.sql
```

### Step 2: Add Harvester Table
```bash
mysql -u root -p your_database_name < harvester.sql
```

### Step 3: Add Data Sources
```sql
-- Run in MySQL console:
CREATE TABLE ds (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  urls TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### Step 4: Add Harvest Schedule
```bash
mysql -u root -p your_database_name < schedule.sql
```

## Important Notes

### Foreign Key Constraints
- `schedule.harvester_id` → `harvester.id` (CASCADE DELETE)
- `schedule.datasource_id` → `ds.id` (CASCADE DELETE)
- `bp.basket_id` → `basket.id` (CASCADE DELETE)
- `bp.product_id` → `product.id` (CASCADE DELETE)
- `result.analysis_id` → `analysis.id` (CASCADE DELETE)

### Performance Indexes
- `harvester`: name, host
- `schedule`: harvester_id, datasource_id, cron_expression
- `bp`: basket_id, product_id (composite primary key)

### Data Types
- `TEXT` for URLs and settings (allows long values)
- `DECIMAL(10,2)` for network metrics (precision to 2 decimal places)
- `ENUM` for status (limited values)
- `JSON` type not used for MySQL 5.6+ compatibility

## Test Data

### Harvesters
```sql
INSERT INTO harvester (name, host, upload, download, ping) VALUES
('Main Harvester', 'http://192.168.1.100:3001', 50.25, 100.50, 12.5),
('Backup Harvester', 'http://192.168.1.101:3001', 25.10, 75.80, 18.2),
('Cloud Harvester', 'http://harvester.example.com:3001', 100.00, 200.00, 5.1);
```

### Data Sources
```sql
INSERT INTO ds (name, urls) VALUES
('E-commerce categories', 'https://www.heureka.cz/kategorie/mobilni-telefony/\nhttps://www.heureka.cz/kategorie/notebooky/\nhttps://www.alza.cz/telefony/'),
('Price comparators', 'https://www.zbozi.cz/\nhttps://www.heureka.cz/\nhttps://www.mall.cz/'),
('Product catalogs', 'https://www.czc.cz/\nhttps://www.datart.cz/\nhttps://www.electroworld.cz/');
```

### Harvest Schedule
```sql
INSERT INTO schedule (harvester_id, datasource_id, cron_expression) VALUES
(1, 1, '0 2 * * *'),    -- Every day at 2:00
(1, 2, '0 */6 * * *'),  -- Every 6 hours
(2, 1, '0 9 * * 1-5');  -- Weekdays at 9:00
```

## Rollback Procedures

### Remove Schedule Table
```sql
DROP TABLE schedule;
```

### Remove ds Table
```sql
-- First remove schedule (due to foreign key)
DROP TABLE schedule;
DROP TABLE ds;
```

### Remove Harvester Table
```sql
-- First remove schedule (due to foreign key)
DROP TABLE schedule;
DROP TABLE harvester;
```

## Backup Recommendations

```bash
# Backup entire database before migration
mysqldump -u root -p your_database_name > backup_before_migration.sql

# Backup structure only
mysqldump -u root -p --no-data your_database_name > structure_backup.sql

# Backup data only
mysqldump -u root -p --no-create-info your_database_name > data_backup.sql
```

## Migration Verification

After each migration verify:

```sql
-- Check table list
SHOW TABLES;

-- Check new table structure
DESCRIBE harvester;
DESCRIBE ds;
DESCRIBE schedule;

-- Check foreign key constraints
SELECT * FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
WHERE REFERENCED_TABLE_SCHEMA = 'your_database_name';

-- Check indexes
SHOW INDEX FROM harvester;
SHOW INDEX FROM schedule;
```
