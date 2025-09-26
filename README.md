# RPA Backend API

REST API pro správu produktů, košíků a analýz s autentifikací.

## Funkce

- 🔐 JWT autentifikace
- 📦 Správa produktů
- 🛒 Správa košíků
- 📊 Analýzy s workflow skripty
- 📁 Export výsledků do ZIP
- 🔒 Bezpečnostní middleware (helmet, cors, rate limiting)

## Technologie

- **Backend**: Node.js, Express, MySQL
- **Autentifikace**: JWT, bcrypt
- **Bezpečnost**: Helmet, CORS, Rate limiting
- **Databáze**: MySQL/MariaDB

## Instalace

```bash
# Klonuj repository
git clone https://github.com/zbysekmartoch/rpa-backend.git
cd rpa-backend

# Nainstaluj závislosti
npm install

# Nastav environment variables
cp .env.example .env
# Uprav .env podle svých potřeb

# Spusť server
npm start
```

## Environment Variables

```bash
NODE_ENV=development
PORT=3000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=rpa_db
JWT_SECRET=your-super-secret-jwt-key
CORS_ORIGINS=http://localhost:3000
```

## API Endpointy

### Autentifikace
- `POST /api/v1/auth/login` - Přihlášení
- `POST /api/v1/auth/register` - Registrace
- `GET /api/v1/auth/me` - Informace o uživateli

### Produkty
- `GET /api/v1/products` - Seznam produktů
- `POST /api/v1/products` - Vytvoření produktu
- `PUT /api/v1/products/:id` - Aktualizace produktu
- `DELETE /api/v1/products/:id` - Smazání produktu

### Košíky
- `GET /api/v1/baskets` - Seznam košíků
- `POST /api/v1/baskets` - Vytvoření košíku
- `GET /api/v1/baskets/:id/products` - Produkty v košíku

### Analýzy
- `GET /api/v1/analyses` - Seznam analýz
- `POST /api/v1/analyses` - Vytvoření analýzy
- `POST /api/v1/analyses/:id/run` - Spuštění analýzy

### Výsledky
- `GET /api/v1/results` - Seznam výsledků
- `GET /api/v1/results/:id/download` - Stažení ZIP

## Struktura projektu

```
├── src/
│   ├── routes/          # API routes
│   ├── middleware/      # Express middleware
│   ├── config.js        # Konfigurace
│   ├── db.js           # Databázové připojení
│   └── index.js        # Hlavní server
├── scripts/            # Skripty pro analýzy
├── results/            # Výsledky analýz (gitignored)
└── package.json
```

## Databáze

Potřebné tabulky:

```sql
CREATE TABLE usr (
  id INT AUTO_INCREMENT PRIMARY KEY,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE product (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  brand VARCHAR(255),
  category VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE basket (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE bp (
  basket_id INT,
  product_id INT,
  PRIMARY KEY (basket_id, product_id),
  FOREIGN KEY (basket_id) REFERENCES basket(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES product(id) ON DELETE CASCADE
);

CREATE TABLE analysis (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  settings TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE result (
  id INT AUTO_INCREMENT PRIMARY KEY,
  analysis_id INT,
  status ENUM('pending', 'completed', 'failed') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (analysis_id) REFERENCES analysis(id) ON DELETE CASCADE
);
```

## Licence

MIT
