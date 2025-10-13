# Data Importer

Node.js script pro import dat z ZIP archivů do MySQL databáze.

## Instalace

```bash
npm install
```

## Konfigurace

Nastavte připojovací údaje k MySQL databázi v souboru `.env`:

```
DB_HOST=localhost
DB_PORT=3306
DB_USER=your_username
DB_PASSWORD=your_password
DB_NAME=your_database
```

## Použití

```bash
node import-data.js <cesta-k-zip-souboru>
```

Příklad:
```bash
node import-data.js /path/to/data.zip
```

## Struktura dat

### Produktové soubory

Soubory s názvy ve tvaru:
- `YYYY-MM-DD-hhmm-products.json` (novější verze)
- `YYYY-MM-DD-products.json` (starší verze)

Struktura JSON:
```json
[
  {
    "id": "657762069",
    "name": "Bambu Lab P1S Combo",
    "url": "https://example.com/product",
    "priceText": "699,00 – 1 267,92 €",
    "seller": "v 10 obchodoch",
    "brand": "Bambu Lab",
    "category": "Heureka.sk|Elektronika|...",
    "date": "2025-10-05",
    "harvested_at": "2025-10-05 18:50:10"
  }
]
```

### Cenové soubory

Soubory s názvy ve tvaru:
- `YYYY-MM-DD-hhmm-prices.json` (novější verze)
- `YYYY-MM-DD-prices.json` (starší verze)

Struktura JSON:
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

## Databázové tabulky

### imp_product

```sql
CREATE TABLE imp_product (
  id VARCHAR(255),
  name VARCHAR(255),
  url VARCHAR(500),
  priceText VARCHAR(255),
  seller VARCHAR(255),
  brand VARCHAR(255),
  category VARCHAR(500),
  date VARCHAR(20),
  PRIMARY KEY (id, date)
);
```

### imp_price

```sql
CREATE TABLE imp_price (
  price VARCHAR(255),
  seller VARCHAR(255),
  productId VARCHAR(255),
  date VARCHAR(20),
  PRIMARY KEY (productId, seller, date)
);
```

## Post-import SQL

Po importu dat se automaticky spustí SQL dotazy ze souboru `after-import.sql` (pokud existuje).

## Logování

Script vytváří dva soubory s logy:
- `import-YYYY-MM-DD-hhmm.log` - běžné logy
- `import-YYYY-MM-DD-hhmm.err` - chybové logy

## Funkce

- Rozbalení ZIP archivů
- Rekurzivní procházení složek
- Zpracování produktových i cenových JSON souborů
- Podpora starších i novějších formátů souborů
- Automatická extrakce datumu z názvů souborů
- Batch INSERT operace pro rychlý import
- INSERT IGNORE pro prevenci duplikátů
- Post-import SQL dotazy
- Podrobné logování
- Automatické úklid dočasných souborů
- Kompletní error handling
