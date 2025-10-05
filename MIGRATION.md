# Database Migration Guide

Tento dokument popisuje všechny databázové změny a migrace pro RPA Backend.

## Výchozí tabulky

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

## Nové tabulky (v pořadí vytvoření)

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

## Migrace krok za krokem

### Krok 1: Vytvoření základních tabulek
```bash
# Pokud nemáte základní tabulky, vytvořte je:
mysql -u root -p your_database_name < basic_tables.sql
```

### Krok 2: Přidání harvester tabulky
```bash
mysql -u root -p your_database_name < harvester.sql
```

### Krok 3: Přidání data sources
```sql
-- Spusťte v MySQL konzoli:
CREATE TABLE ds (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  urls TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### Krok 4: Přidání harvest schedule
```bash
mysql -u root -p your_database_name < schedule.sql
```

## Důležité poznámky

### Foreign Key Constraints
- `schedule.harvester_id` → `harvester.id` (CASCADE DELETE)
- `schedule.datasource_id` → `ds.id` (CASCADE DELETE)
- `bp.basket_id` → `basket.id` (CASCADE DELETE)
- `bp.product_id` → `product.id` (CASCADE DELETE)
- `result.analysis_id` → `analysis.id` (CASCADE DELETE)

### Indexy pro výkon
- `harvester`: name, host
- `schedule`: harvester_id, datasource_id, cron_expression
- `bp`: basket_id, product_id (composite primary key)

### Data Types
- `TEXT` pro URLs a settings (umožňuje dlouhé hodnoty)
- `DECIMAL(10,2)` pro network metrics (přesnost na 2 desetinná místa)
- `ENUM` pro status (omezené hodnoty)
- `JSON` typ se nepoužívá pro kompatibilitu s MySQL 5.6+

## Testovací data

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
('E-commerce kategorie', 'https://www.heureka.cz/kategorie/mobilni-telefony/\nhttps://www.heureka.cz/kategorie/notebooky/\nhttps://www.alza.cz/telefony/'),
('Cenové srovnávače', 'https://www.zbozi.cz/\nhttps://www.heureka.cz/\nhttps://www.mall.cz/'),
('Produktové katalogy', 'https://www.czc.cz/\nhttps://www.datart.cz/\nhttps://www.electroworld.cz/');
```

### Harvest Schedule
```sql
INSERT INTO schedule (harvester_id, datasource_id, cron_expression) VALUES
(1, 1, '0 2 * * *'),    -- Každý den ve 2:00
(1, 2, '0 */6 * * *'),  -- Každých 6 hodin
(2, 1, '0 9 * * 1-5');  -- Pracovní dny v 9:00
```

## Rollback postupy

### Odebrání schedule tabulky
```sql
DROP TABLE schedule;
```

### Odebrání ds tabulky
```sql
-- Nejdřív odebrat schedule (kvůli foreign key)
DROP TABLE schedule;
DROP TABLE ds;
```

### Odebrání harvester tabulky
```sql
-- Nejdřív odebrat schedule (kvůli foreign key)
DROP TABLE schedule;
DROP TABLE harvester;
```

## Backup doporučení

```bash
# Backup celé databáze před migrací
mysqldump -u root -p your_database_name > backup_before_migration.sql

# Backup pouze struktura
mysqldump -u root -p --no-data your_database_name > structure_backup.sql

# Backup pouze data
mysqldump -u root -p --no-create-info your_database_name > data_backup.sql
```

## Verifikace migrace

Po každé migraci ověřte:

```sql
-- Zkontrolujte seznam tabulek
SHOW TABLES;

-- Zkontrolujte strukturu nových tabulek
DESCRIBE harvester;
DESCRIBE ds;
DESCRIBE schedule;

-- Zkontrolujte foreign key constraints
SELECT * FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
WHERE REFERENCED_TABLE_SCHEMA = 'your_database_name';

-- Zkontrolujte indexy
SHOW INDEX FROM harvester;
SHOW INDEX FROM schedule;
```