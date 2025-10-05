# RPA Backend API Documentation

Kompletní přehled všech API endpointů pro RPA Backend.

## 🔐 Autentifikace
**Base URL:** `/api/v1/auth`

| Endpoint | Method | Popis | Auth | Request Body | Response |
|----------|--------|-------|------|--------------|----------|
| `/login` | POST | Přihlášení uživatele | ❌ | `{email, password}` | `{token, user}` |
| `/register` | POST | Registrace nového uživatele | ❌ | `{firstName, lastName, email, password}` | `{message}` |
| `/me` | GET | Informace o aktuálním uživateli | ✅ | - | `{id, firstName, lastName, email}` |
| `/reset-password` | POST | Reset hesla | ❌ | `{email}` | `{message}` |

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
| `/` | GET | Seznam analýz | ✅ | - | `{items}` |
| `/` | POST | Vytvoření analýzy | ✅ | `{name, settings}` | Nová analýza |
| `/:id` | GET | Detail analýzy | ✅ | - | Analýza |
| `/:id` | PUT | Aktualizace analýzy | ✅ | `{name, settings}` | Aktualizovaná analýza |
| `/:id` | DELETE | Smazání analýzy | ✅ | - | `{success, id}` |
| `/:id/run` | POST | Spuštění analýzy | ✅ | - | `{message, resultId}` |

**Settings formát:**
```json
{
  "workflow": "script1.py\nscript2.py",
  "parameters": {...}
}
```

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

**Query parametry:**
- `harvester_id` - filtr podle harvesteru
- `datasource_id` - filtr podle datového zdroje

**Automatická synchronizace:**
- POST/PUT automaticky volá harvester API pro vytvoření/aktualizaci jobu
- DELETE automaticky volá harvester API pro zrušení jobu

## 🔄 Workflows
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
| `/health` | GET | Health check | ❌ | `{ok: true}` |

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