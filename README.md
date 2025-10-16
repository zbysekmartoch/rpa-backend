
# Backend for Retail prices analyzer (RPA) project 

RPA is advanced scalable tool used by Czech Competition Authority for price analysis and detection of anticompetitive behavior.

## RPA Backend API

REST API for managing products, baskets, analyses, harvesters, and harvest scheduling with JWT authentication.

## Features

- 🔐 JWT Authentication
- 📦 Product Management with price statistics
- 🛒 Basket Management
- 📊 Analysis with Workflow Scripts
- 📁 ZIP Export of Results
- 🤖 Harvester Management with API forwarding
- 🕐 Harvest Scheduling with automatic synchronization
- 📡 Data Sources Management
- 🔄 Workflow Templates
- 🔒 Security Middleware (helmet, cors, rate limiting)

## Technologies

- **Backend**: Node.js, Express, MySQL
- **Authentication**: JWT, bcrypt
- **Security**: Helmet, CORS, Rate limiting
- **Database**: MySQL/MariaDB
- **Python**: Analysis scripts with scikit-learn, matplotlib, numpy

## Installation

### Quick Setup (Recommended)

```bash
# Clone repository
git clone https://github.com/zbysekmartoch/rpa-backend.git
cd rpa-backend

# Run automated setup
./setup.sh

# Configure environment
cp .env.example .env
# Edit .env with your configuration

# Setup database (see below)
```

### Manual Setup

### 1. Clone Repository
```bash
git clone https://github.com/zbysekmartoch/rpa-backend.git
cd rpa-backend
```

### 2. Install Node.js Dependencies
```bash
npm install
```

### 3. Setup Python Environment
```bash
cd scripts/analyzy
./setup-python-env.sh
cd ../..
```

See [PYTHON_SETUP.md](PYTHON_SETUP.md) for detailed Python setup instructions.

### 4. Setup Reporter Dependencies
```bash
cd scripts/reports
npm install
cd ../..
```

Reporter používá vlastní `package.json` pro generování Word dokumentů. Více v [scripts/reports/REPORTER.md](scripts/reports/REPORTER.md).

### 5. Configure Environment
```bash
# Set up environment variables
cp .env.example .env
# Edit .env with your configuration
```

### 6. Setup Database
```bash
# Create database tables
mysql -u root -p your_database < harvester.sql
mysql -u root -p your_database < schedule.sql
```

### 7. Start Server
```bash
npm start
```

## ⚙️ Configuration

The application uses `config.json` for settings:

```json
{
  "paths": {
    "scripts": "scripts",
    "results": "results"
  },
  "scriptCommands": {
    ".py": {
      "command": "python3",
      "description": "Python scripts"
    },
    ".js": {
      "command": "node", 
      "description": "Node.js scripts"
    },
    ".r": {
      "command": "Rscript",
      "description": "R scripts"
    }
  },
  "logging": {
    "logFileName": "analysis.log",
    "errorFileName": "analysis.err",
    "separatorChar": "=",
    "separatorLength": 80
  }
}
```

### Adding New Script Types

To add support for a new language (e.g., Julia):

```json
{
  "scriptCommands": {
    ".jl": {
      "command": "julia",
      "description": "Julia scripts"
    }
  }
}
```

### Email Configuration for Password Reset

Configure email settings in `.env`:

```bash
# Gmail example
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-specific-password
EMAIL_FROM=noreply@rpa-backend.com
FRONTEND_URL=http://localhost:5173
```

**For Gmail:**
1. Enable 2-Factor Authentication
2. Generate App-Specific Password at: https://myaccount.google.com/apppasswords
3. Use the generated password as `EMAIL_PASSWORD`

**For other SMTP providers:**
- Update `EMAIL_HOST` and `EMAIL_PORT` accordingly
- Set `EMAIL_SECURE=true` for SSL/TLS (usually port 465)
- Set `EMAIL_SECURE=false` for STARTTLS (usually port 587)

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

### 🔐 Authentication
- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/register` - User registration  
- `GET /api/v1/auth/me` - Get current user info
- `POST /api/v1/auth/reset-password` - Password reset

### 📦 Products
- `GET /api/v1/products` - List products with seller/price counts
  - Query params: `category[]`, `mode`, `limit`, `offset`

### 🛒 Baskets
- `GET /api/v1/baskets` - List baskets
- `POST /api/v1/baskets` - Create basket
- `PUT /api/v1/baskets/:id` - Update basket
- `DELETE /api/v1/baskets/:id` - Delete basket
- `GET /api/v1/baskets/:id/products` - Get products in basket
- `POST /api/v1/baskets/:id/products` - Add products to basket
- `DELETE /api/v1/baskets/:id/products/:productId` - Remove product from basket

### 📊 Analyses
- `GET /api/v1/analyses` - List analyses
- `POST /api/v1/analyses` - Create analysis
- `GET /api/v1/analyses/:id` - Get analysis details
- `PUT /api/v1/analyses/:id` - Update analysis
- `DELETE /api/v1/analyses/:id` - Delete analysis
- `POST /api/v1/analyses/:id/run` - Run analysis

### 📁 Results
- `GET /api/v1/results` - List analysis results
  - Query params: `analysis_id`
- `GET /api/v1/results/:id` - Get result details
- `GET /api/v1/results/:id/download` - Download ZIP with results

### 🤖 Harvesters
- `GET /api/v1/harvesters` - List harvesters with live status
- `POST /api/v1/harvesters` - Create harvester
- `GET /api/v1/harvesters/:id` - Get harvester details
- `PUT /api/v1/harvesters/:id` - Update/create harvester (upsert by name)
- `DELETE /api/v1/harvesters/:id` - Delete harvester
- `GET /api/v1/harvesters/:id/status` - Get live status from harvester API
- `POST /api/v1/harvesters/:id/schedule` - Forward schedule request to harvester
- `DELETE /api/v1/harvesters/:id/schedule/:jobId` - Forward unschedule request
- `POST /api/v1/harvesters/:id/harvest` - Forward immediate harvest request

### 📡 Data Sources
- `GET /api/v1/data-sources` - List data sources
- `POST /api/v1/data-sources` - Create data source
- `GET /api/v1/data-sources/:id` - Get data source details
- `PUT /api/v1/data-sources/:id` - Update data source
- `DELETE /api/v1/data-sources/:id` - Delete data source

### 🕐 Harvest Schedule
- `GET /api/v1/harvest-schedule` - List scheduled harvest jobs
  - Query params: `harvester_id`, `datasource_id`
- `POST /api/v1/harvest-schedule` - Create scheduled harvest job
- `GET /api/v1/harvest-schedule/:id` - Get schedule details
- `PUT /api/v1/harvest-schedule/:id` - Update schedule
- `DELETE /api/v1/harvest-schedule/:id` - Delete schedule

### 🔄 Workflows
- `GET /api/v1/workflows` - List available workflows
- `GET /api/v1/workflows/:name` - Get workflow content

### 🌳 Categories
- `GET /api/v1/categories` - Get category tree structure

### 🔧 System
- `GET /api/health` - Health check

## Project Structure

```
├── src/
│   ├── routes/          # API routes
│   ├── middleware/      # Express middleware
│   ├── config.js        # Configuration
│   ├── db.js           # Database connection
│   └── index.js        # Main server file
├── scripts/            # Analysis scripts and workflows
├── results/            # Analysis results (gitignored)
├── common/             # Common resources (gitignored)
└── package.json
```

## Database Schema

### Core Tables

```sql
-- Users
CREATE TABLE usr (
  id INT AUTO_INCREMENT PRIMARY KEY,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Products
CREATE TABLE product (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  brand VARCHAR(255),
  category VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Baskets
CREATE TABLE basket (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Basket Products (Many-to-Many)
CREATE TABLE bp (
  basket_id INT,
  product_id INT,
  PRIMARY KEY (basket_id, product_id),
  FOREIGN KEY (basket_id) REFERENCES basket(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES product(id) ON DELETE CASCADE
);

-- Analyses
CREATE TABLE analysis (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  settings TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Analysis Results
CREATE TABLE result (
  id INT AUTO_INCREMENT PRIMARY KEY,
  analysis_id INT,
  status ENUM('pending', 'completed', 'failed') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (analysis_id) REFERENCES analysis(id) ON DELETE CASCADE
);

-- Harvesters
CREATE TABLE harvester (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  host VARCHAR(255) NOT NULL,
  upload DECIMAL(10,2) NULL,
  download DECIMAL(10,2) NULL,
  ping DECIMAL(10,2) NULL,
  last_update TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Data Sources
CREATE TABLE ds (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  urls TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Harvest Schedule
CREATE TABLE schedule (
  id INT AUTO_INCREMENT PRIMARY KEY,
  harvester_id INT NOT NULL,
  datasource_id INT NOT NULL,
  cron_expression VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (harvester_id) REFERENCES harvester(id) ON DELETE CASCADE,
  FOREIGN KEY (datasource_id) REFERENCES ds(id) ON DELETE CASCADE
);
```

## Key Features

### 🤖 Harvester Integration
- Real-time status from harvester APIs
- Automatic synchronization of scheduled jobs
- Forward harvest requests to individual harvesters
- Upsert harvesters by name for easy registration

### 📊 Analysis Workflow
- Workflow templates stored as `.workflow` files
- Automatic script execution in sequence
- Support for Python and Node.js scripts
- Results exported as ZIP archives

### 🔐 Authentication & Security
- JWT-based authentication
- All API endpoints (except auth and health) require authentication
- CORS and security headers
- Input validation and SQL injection protection

### 🕐 Harvest Scheduling
- Automatic harvester API synchronization
- Foreign key constraints for data integrity
- Cron expression validation
- Support for multiple harvesters and data sources

## Development

```bash
# Start in development mode
npm run dev

# Run linting
npm run lint

# Run tests
npm test
```

## API Response Format

### Success Response
```json
{
  "items": [...],     // For list endpoints
  "id": 123,          // For single item endpoints
  "message": "..."    // For operation confirmations
}
```

### Error Response
```json
{
  "error": "Error description",
  "details": "Additional details if available"
}
```

## Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `404` - Not Found
- `503` - Service Unavailable (harvester API down)
- `500` - Internal Server Error

## License

MIT

## Author

Zbyšek Martoch - [GitHub](https://github.com/zbysekmartoch)
