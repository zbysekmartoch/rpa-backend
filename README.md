
# Backend for Retail prices analyzer (RPA) project 

RPA is advanced scalable tool used by Czech Competition Authority for price analysis and detection of anticompetitive behavior.

## RPA Backend API

Impelements REST API for managing products, baskets, and analyses with JWT authentication.

## Features

- 🔐 JWT Authentication
- 📦 Product Management
- 🛒 Basket Management
- 📊 Analysis with Workflow Scripts
- 📁 ZIP Export of Results
- 🔒 Security Middleware (helmet, cors, rate limiting)

## Technologies

- **Backend**: Node.js, Express, MySQL
- **Authentication**: JWT, bcrypt
- **Security**: Helmet, CORS, Rate limiting
- **Database**: MySQL/MariaDB

## Installation

```bash
# Clone repository
git clone https://github.com/zbysekmartoch/rpa-backend.git
cd rpa-backend

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Start server
npm start
```

## Environment Variables

```bash
NODE_ENV=development
PORT=3000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=rpa_db
JWT_SECRET=your-super-secret-jwt-key
CORS_ORIGINS=http://localhost:3000
```

## API Endpoints

### Authentication
- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/register` - User registration  
- `GET /api/v1/auth/me` - Get current user info

### Products
- `GET /api/v1/products` - List products
- `POST /api/v1/products` - Create product
- `PUT /api/v1/products/:id` - Update product
- `DELETE /api/v1/products/:id` - Delete product

### Baskets
- `GET /api/v1/baskets` - List baskets
- `POST /api/v1/baskets` - Create basket
- `GET /api/v1/baskets/:id/products` - Get products in basket
- `POST /api/v1/baskets/:id/products` - Add products to basket

### Analyses
- `GET /api/v1/analyses` - List analyses
- `POST /api/v1/analyses` - Create analysis
- `PUT /api/v1/analyses/:id` - Update analysis
- `POST /api/v1/analyses/:id/run` - Run analysis

### Results
- `GET /api/v1/results` - List results
- `GET /api/v1/results/:id` - Get result details
- `GET /api/v1/results/:id/download` - Download ZIP with results

## Project Structure

```
├── src/
│   ├── routes/          # API routes
│   ├── middleware/      # Express middleware
│   ├── config.js        # Configuration
│   ├── db.js           # Database connection
│   └── index.js        # Main server file
├── scripts/            # Analysis scripts
├── results/            # Analysis results (gitignored)
└── package.json
```

## Database Schema

Required tables:

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

## Development

```bash
# Start in development mode
npm run dev

# Run linting
npm run lint

# Run tests
npm test
```

## License

MIT
