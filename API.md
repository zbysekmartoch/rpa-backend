# RPA Backend API Documentation

Kompletní přehled všech API endpointů pro RPA Backend.

## 🔐 Autentifikace
**Base URL:** `/api/v1/auth`

| Endpoint | Method | Popis | Auth | Request Body | Response |
|----------|--------|-------|------|--------------|----------|
| `/login` | POST | Přihlášení uživatele | ❌ | `{email, password}` | `{token, user}` |
| `/register` | POST | Registrace nového uživatele | ❌ | `{firstName, lastName, email, password}` | `{message}` |
| `/me` | GET | Informace o aktuálním uživateli | ✅ | - | `{id, firstName, lastName, email}` |
| `/reset-password` | POST | Žádost o reset hesla (odešle e-mail) | ❌ | `{email}` | `{message}` |
| `/reset-password/confirm` | POST | Potvrzení nového hesla s tokenem | ❌ | `{token, newPassword}` | `{message}` |

**Reset hesla workflow:**

1. **Žádost o reset:**
   ```json
   POST /api/v1/auth/reset-password
   {
     "email": "user@example.com"
   }
   ```
   - Backend vygeneruje JWT token s 1h expirací
   - Odešle e-mail s odkazem na frontend
   - Vždy vrátí success (bezpečnostní opatření)

2. **Potvrzení nového hesla:**
   ```json
   POST /api/v1/auth/reset-password/confirm
   {
     "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
     "newPassword": "NewSecurePassword123"
   }
   ```
   - Backend ověří token
   - Změní heslo v databázi
   - Uživatel se může přihlásit s novým heslem

**Email konfigurace:**

Pro Gmail:
- Použij App-Specific Password (vygeneruj v Google Account Security)
- EMAIL_HOST=smtp.gmail.com
- EMAIL_PORT=587
- EMAIL_SECURE=false

Pro jiné SMTP servery:
- Nastav EMAIL_HOST, EMAIL_PORT podle poskytovatele
- EMAIL_SECURE=true pro SSL/TLS (port 465)

## 📦 Produkty
**Base URL:** `/api/v1/products`

| Endpoint | Method | Popis | Auth | Query Params | Response |
|----------|--------|-------|------|--------------|----------|
| `/` | GET | Seznam produktů s počtem prodejců/cen | ✅ | `category[]`, `mode`, `limit`, `offset` | `{items}` |

**Query parametry:**
- `category[]` - filtr kategorií (lze více hodnot)
- `mode` - 'subtree' nebo 'exact' (výchozí: 'subtree')
- `limit` - max 20000 (výchozí: 20000)
- `offset` - pro stránkování (výchozí: 0)

## 🛒 Košíky
**Base URL:** `/api/v1/baskets`

| Endpoint | Method | Popis | Auth | Request Body | Response |
|----------|--------|-------|------|--------------|----------|
| `/` | GET | Seznam košíků | ✅ | - | `{items}` |
| `/` | POST | Vytvoření košíku | ✅ | `{name}` | Nový košík |
| `/:id` | PUT | Aktualizace košíku | ✅ | `{name}` | Aktualizovaný košík |
| `/:id` | DELETE | Smazání košíku | ✅ | - | `{success, id}` |
| `/:id/products` | GET | Produkty v košíku | ✅ | - | `{items}` |
| `/:id/products` | POST | Přidání produktů do košíku | ✅ | `{productIds: []}` | `{message}` |
| `/:id/products/:productId` | DELETE | Odebrání produktu z košíku | ✅ | - | `{success}` |

## 📊 Analýzy
**Base URL:** `/api/v1/analyses`

| Endpoint | Method | Popis | Auth | Request Body | Response |
|----------|--------|-------|------|--------------|----------|
| `/config` | GET | Konfigurace analýz a podporované typy | ✅ | - | `{supportedScriptTypes, paths, logging}` |
| `/` | GET | Seznam analýz | ✅ | - | `{items}` |
| `/` | POST | Vytvoření analýzy | ✅ | `{name, settings}` | Nová analýza |
| `/:id` | GET | Detail analýzy | ✅ | - | Analýza |
| `/:id` | PUT | Aktualizace analýzy | ✅ | `{name, settings}` | Aktualizovaná analýza |
| `/:id` | DELETE | Smazání analýzy | ✅ | - | `{success, id}` |
| `/:id/run` | POST | Spuštění analýzy | ✅ | - | `{message, resultId}` |

**Settings formát:**
```json
{
  "workflow": "script1.py\nscript2.js\nanalysis.R",
  "parameters": {...}
}
```

**Konfigurace (config.json):**
- Příkazy pro jednotlivé typy skriptů lze konfigurovat
- Cesty k složkám scripts a results
- Nastavení loggingu (názvy souborů, separátory, atd.)
- Výchozí timeouty a limity

**Podporované jazyky skriptů:**
Konfigurováno v `config.json`, výchozí:
- `.py` - Python skripty
- `.js` - Node.js skripty  
- `.r`, `.R` - R skripty

**Logging:**
- Výsledky analýz obsahují detailní logy: `analysis.log` a `analysis.err`
- Každý krok workflow je zalogován s timestampem
- Konfigurovatelné separátory a formáty
- Automatické zachycení stdout a stderr jednotlivých skriptů

## 📁 Výsledky
**Base URL:** `/api/v1/results`

| Endpoint | Method | Popis | Auth | Query Params | Response |
|----------|--------|-------|------|--------------|----------|
| `/` | GET | Seznam výsledků analýz | ✅ | `analysis_id` | `{items}` |
| `/:id` | GET | Detail výsledku | ✅ | - | Výsledek |
| `/:id/download` | GET | Stažení ZIP s výsledky | ✅ | - | ZIP soubor |

## 🤖 Harvestery
**Base URL:** `/api/v1/harvesters`

| Endpoint | Method | Popis | Auth | Request Body | Response |
|----------|--------|-------|------|--------------|----------|
| `/` | GET | Seznam harvesterů s live statusem | ✅ | - | `{items}` |
| `/` | POST | Vytvoření harvesteru | ✅ | `{name, host, upload?, download?, ping?}` | Nový harvester |
| `/:id` | GET | Detail harvesteru | ✅ | - | Harvester |
| `/:id` | PUT | Aktualizace/vytvoření harvesteru | ✅ | `{name?, host?, upload?, download?, ping?}` | Harvester |
| `/:id` | DELETE | Smazání harvesteru | ✅ | - | `{success, id}` |
| `/:id/status` | GET | Live status z harvester API | ✅ | - | Status JSON |
| `/:id/schedule` | POST | Forward schedule na harvester | ✅ | `{harvestingJobId, urls, cronExpression}` | Response z harvesteru |
| `/:id/schedule/:jobId` | DELETE | Forward unschedule na harvester | ✅ | - | Response z harvesteru |
| `/:id/harvest` | POST | Forward okamžitý harvest na harvester | ✅ | `{harvestingJobId}` | Response z harvesteru |

**Poznámky:**
- `:id` může být číselné ID nebo název harvesteru
- PUT s názvem vytvoří nový harvester, pokud neexistuje (upsert)
- Status se získává vždy live z harvester API, ne z databáze

## 📡 Datové zdroje
**Base URL:** `/api/v1/data-sources`

| Endpoint | Method | Popis | Auth | Request Body | Response |
|----------|--------|-------|------|--------------|----------|
| `/` | GET | Seznam datových zdrojů | ✅ | - | `{items}` |
| `/` | POST | Vytvoření datového zdroje | ✅ | `{name, urls}` | Nový datový zdroj |
| `/:id` | GET | Detail datového zdroje | ✅ | - | Datový zdroj |
| `/:id` | PUT | Aktualizace datového zdroje | ✅ | `{name?, urls?}` | Aktualizovaný datový zdroj |
| `/:id` | DELETE | Smazání datového zdroje | ✅ | - | `{success, id}` |

**URLs formát:**
- Jako array: `["url1", "url2"]`
- Jako string: `"url1\nurl2"`

## 🕐 Harvest Schedule
**Base URL:** `/api/v1/harvest-schedule`

| Endpoint | Method | Popis | Auth | Request Body | Response |
|----------|--------|-------|------|--------------|----------|
| `/` | GET | Seznam naplánovaných harvest jobů | ✅ | - | `{items}` |
| `/` | POST | Vytvoření harvest jobu | ✅ | `{harvester_id, datasource_id, cron_expression}` | Nový schedule |
| `/:id` | GET | Detail harvest jobu | ✅ | - | Schedule |
| `/:id` | PUT | Aktualizace harvest jobu | ✅ | `{harvester_id?, datasource_id?, cron_expression?}` | Aktualizovaný schedule |
| `/:id` | DELETE | Smazání harvest jobu | ✅ | - | `{success, id}` |
| `/import/:id` | POST | Import dat z harvesteru do DB | ✅ | Query/Body params | `{message, scheduleId, status}` |

**Query parametry (GET):**
- `harvester_id` - filtr podle harvesteru
- `datasource_id` - filtr podle datového zdroje

**Import parametry (POST /import/:id):**
- `from` - ISO 8601 datetime (např. `2025-10-01T00:00:00Z`) - filtr od data
- `to` - ISO 8601 datetime (např. `2025-10-31T23:59:59Z`) - filtr do data
- `screenshots` - boolean - zahrnout price screenshots (`*prices*.png|jpg`)
- `images` - boolean - zahrnout product images (`product*.jpg|png`)

**Příklad importu:**
```bash
POST /api/v1/harvest-schedule/import/123?from=2025-10-01T00:00:00Z&to=2025-10-31T23:59:59Z&images=true&screenshots=true
```

**Import workflow:**
1. Backend stáhne ZIP z harvesteru: `GET {harvester_host}/export/{scheduleId}?params`
2. ZIP se uloží do `./temp/harvest_{id}_{timestamp}.zip`
3. Spustí se import script: `node scripts/import-data.js {zipFile}`
4. Po dokončení se ZIP soubor smaže
5. Import běží asynchronně - okamžitá response s `status: 'downloading'`

**Automatická synchronizace:**
- POST/PUT automaticky volá harvester API pro vytvoření/aktualizaci jobu
- DELETE automaticky volá harvester API pro zrušení jobu
- Import volá harvester export endpoint a zpracuje data

## � Harvest (Manual Import)
**Base URL:** `/api/v1/harvest`

| Endpoint | Method | Popis | Auth | Request Body | Response |
|----------|--------|-------|------|--------------|----------|
| `/manual-import` | POST | Manuální import dat ze ZIP souboru | ✅ | multipart/form-data | `{message, filename, filesize, status}` |

**Request:**
- Content-Type: `multipart/form-data`
- Body: FormData s polem `file` obsahujícím ZIP soubor
- Max velikost: 500 MB

**Příklad použití:**
```bash
# cURL
curl -X POST http://localhost:3000/api/v1/harvest/manual-import \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "file=@/path/to/data.zip"

# JavaScript fetch
const formData = new FormData();
formData.append('file', zipFile);

const response = await fetch('/api/v1/harvest/manual-import', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  },
  body: formData
});
```

**Response:**
```json
{
  "message": "Import started",
  "filename": "manual_1697123456789_data.zip",
  "filesize": 15234567,
  "status": "processing"
}
```

**Import workflow:**
1. ZIP soubor se nahraje do `./temp/manual_{timestamp}_{filename}.zip`
2. Spustí se import script: `node scripts/import-data.js {zipFile}`
3. Import běží asynchronně - okamžitá response s `status: 'processing'`
4. Po dokončení se ZIP soubor smaže
5. Výsledky se logují do konzole

## �🔄 Workflows
**Base URL:** `/api/v1/workflows`

| Endpoint | Method | Popis | Auth | Response |
|----------|--------|-------|------|----------|
| `/` | GET | Seznam dostupných workflows | ✅ | `{items: ["name1", "name2"]}` |
| `/:name` | GET | Obsah konkrétního workflow | ✅ | `{name, content}` |

**Workflow soubory:**
- Uložené v `scripts/` jako `.workflow` soubory
- Obsahují seznam skriptů, jeden na řádek

## 🌳 Kategorie
**Base URL:** `/api/v1/categories`

| Endpoint | Method | Popis | Auth | Response |
|----------|--------|-------|------|----------|
| `/` | GET | Stromová struktura kategorií | ✅ | Strom kategorií |

## 🔧 Systémové
**Base URL:** `/api`

| Endpoint | Method | Popis | Auth | Response |
|----------|--------|-------|------|----------|
| `/health` | GET | Health check s detaily systému | ❌ | Detailní informace |

**Health Check Response:**
```json
{
  "ok": true,
  "service": "rpa-backend",
  "version": "1.0.0",
  "build": "1.0.0",
  "server": {
    "host": "msi",
    "port": 3000,
    "nodeVersion": "v20.11.0",
    "platform": "linux",
    "uptime": 1234.56
  },
  "database": {
    "host": "81.2.236.167",
    "port": 3306,
    "name": "pricedb",
    "user": "oheroot"
  },
  "timestamp": "2025-10-14T12:34:56.789Z"
}
```

**Použití:**
- Monitoring dostupnosti služby
- Diagnostika systému
- CI/CD health checks
- Zobrazení verzí a konfigurace

---

## 🔒 Autentifikace

Všechny endpointy označené ✅ vyžadují JWT token v hlavičce:
```
Authorization: Bearer <jwt_token>
```

## 📄 Formáty odpovědí

### Úspěšná odpověď
```json
{
  "items": [...],     // Pro seznam
  "id": 123,          // Pro jednotlivé záznamy
  "message": "..."    // Pro potvrzení operací
}
```

### Chybová odpověď
```json
{
  "error": "Popis chyby",
  "details": "Dodatečné detaily"
}
```

## 🚫 HTTP Status kódy

- `200` - Úspěch
- `201` - Vytvořeno
- `400` - Špatný request
- `401` - Neautorizováno
- `404` - Nenalezeno
- `503` - Služba nedostupná (harvester API)
- `500` - Serverová chyba

## 🔄 Integrační flow

### Registrace harvesteru
1. Harvester se spustí
2. Zavolá `PUT /api/v1/harvesters/{name}` s host a network metrics
3. Backend uloží/aktualizuje záznam

### Harvest scheduling
1. Frontend vytvoří schedule: `POST /api/v1/harvest-schedule`
2. Backend uloží do DB a automaticky zavolá harvester API
3. Harvester obdrží job a naplánuje si ho
4. Při změnách se harvester automaticky synchronizuje

### Analysis workflow
1. Frontend vytvoří analýzu s workflow
2. Frontend spustí analýzu: `POST /api/v1/analyses/{id}/run`
3. Backend postupně spouští skripty z workflow
4. Výsledky se ukládají do `results/{resultId}/`
5. Frontend může stáhnout ZIP s výsledky