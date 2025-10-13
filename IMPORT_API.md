# Harvest Schedule Import API

Dokumentace pro import dat z harvesteru do databáze.

## Endpoint

```
POST /api/v1/harvest-schedule/import/:id
```

## Autentifikace

✅ Vyžaduje JWT token v hlavičce

## Parametry

### URL parametr
- `id` (integer) - ID harvest schedule jobu

### Query/Body parametry (volitelné)

#### Date Range Filtering
- `from` (string) - ISO 8601 datetime, např. `2025-10-01T00:00:00Z`
  - Filtruje data podle modification time
  - Zahrnuje JSON soubory, screenshoty a obrázky
  
- `to` (string) - ISO 8601 datetime, např. `2025-10-31T23:59:59Z`
  - Filtruje data podle modification time
  - Zahrnuje JSON soubory, screenshoty a obrázky

#### Content Type Filtering
- `screenshots` (boolean) - Zahrnout price screenshoty
  - Filtruje soubory: `*prices*.png`, `*prices*.jpg`
  - Default: `false`
  
- `images` (boolean) - Zahrnout product obrázky
  - Filtruje soubory: `product*.jpg`, `product*.png`
  - Default: `false`

## Request Examples

### cURL - všechna data
```bash
curl -X POST http://localhost:3000/api/v1/harvest-schedule/import/123 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### cURL - s date range
```bash
curl -X POST "http://localhost:3000/api/v1/harvest-schedule/import/123?from=2025-10-01T00:00:00Z&to=2025-10-31T23:59:59Z" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### cURL - s obrázky a screenshoty
```bash
curl -X POST "http://localhost:3000/api/v1/harvest-schedule/import/123?images=true&screenshots=true" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### cURL - komplexní příklad
```bash
curl -X POST "http://localhost:3000/api/v1/harvest-schedule/import/123?from=2025-10-01T00:00:00Z&to=2025-10-31T23:59:59Z&images=true&screenshots=true" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### JavaScript fetch
```javascript
const response = await fetch(
  'http://localhost:3000/api/v1/harvest-schedule/import/123?from=2025-10-01T00:00:00Z&to=2025-10-31T23:59:59Z&images=true',
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  }
);

const data = await response.json();
console.log(data);
```

### Axios
```javascript
const response = await axios.post(
  '/api/v1/harvest-schedule/import/123',
  {},
  {
    params: {
      from: '2025-10-01T00:00:00Z',
      to: '2025-10-31T23:59:59Z',
      images: true,
      screenshots: true
    },
    headers: {
      'Authorization': `Bearer ${token}`
    }
  }
);
```

## Response

### Success (200 OK)
```json
{
  "message": "Import started",
  "scheduleId": 123,
  "status": "downloading"
}
```

**Poznámka:** Import běží asynchronně na pozadí. Response je okamžitá.

### Error Responses

#### 400 Bad Request - Invalid ID
```json
{
  "error": "Invalid id"
}
```

#### 400 Bad Request - Invalid date format
```json
{
  "error": "Invalid from date format. Use ISO 8601 format."
}
```

#### 404 Not Found - Schedule not found
```json
{
  "error": "Schedule not found"
}
```

#### 400 Bad Request - Missing harvester
```json
{
  "error": "Harvester host not configured for this schedule"
}
```

## Import Workflow

```
1. Client → Backend: POST /import/123?params
   ↓
2. Backend → DB: Získá harvester host pro schedule
   ↓
3. Backend → Harvester: GET /export/123?params
   ↓ (stahuje ZIP)
4. Backend → Disk: Uloží ZIP do ./temp/harvest_123_timestamp.zip
   ↓
5. Backend → Client: Response { status: "downloading" }
   ↓ (async pokračuje)
6. Backend → Script: node scripts/import-data.js zipFile
   ↓
7. Script: Rozbalí ZIP, zpracuje data, importuje do DB
   ↓
8. Backend: Smaže dočasný ZIP soubor
   ↓
9. ✓ Import dokončen (logováno do konzole)
```

## Harvester Export API

Backend volá harvester export endpoint:
```
GET {harvester_host}/export/{harvestingJobId}?from=...&to=...&images=...&screenshots=...
```

**Očekávaná response:**
- Content-Type: `application/zip`
- Binary ZIP soubor obsahující:
  - JSON soubory s daty
  - Product obrázky (pokud `images=true`)
  - Price screenshoty (pokud `screenshots=true`)

## Import Script

Backend spouští: `node scripts/import-data.js <zipFilePath>`

**Script odpovědnosti:**
1. Rozbalit ZIP soubor
2. Načíst a parsovat JSON data
3. Zpracovat obrázky (uložit, optimalizovat)
4. Importovat data do databáze
5. Vrátit exit code 0 při úspěchu

**Logging:**
- stdout - průběh importu
- stderr - chyby
- Exit code 0 = úspěch, jinak = chyba

## Monitoring

Backend loguje do konzole:
```
Starting import for schedule 123 from harvester Main Harvester
Export endpoint: /export/123?from=2025-10-01T00:00:00Z&to=2025-10-31T23:59:59Z
Downloading ZIP from: http://harvester.com/export/123?...
ZIP file downloaded: ./temp/harvest_123_1697123456789.zip (15234567 bytes)
Running import script: ./scripts/import-data.js with file: ...
Import script output: ...
Import completed successfully for schedule 123
Deleted temporary ZIP file: ./temp/harvest_123_1697123456789.zip
```

## Error Handling

Import je asynchronní, takže chyby se logují do konzole:

```javascript
// Chyby při stahování
console.error('Failed to download ZIP: HTTP 500 Internal Server Error');

// Chyby při importu
console.error('Import failed for schedule 123: Import script exited with code 1');

// Dočasný ZIP se vždy pokusí smazat i při chybě
```

## Best Practices

### 1. Date Range
```javascript
// Poslední měsíc
const from = new Date();
from.setMonth(from.getMonth() - 1);
const to = new Date();

const params = {
  from: from.toISOString(),
  to: to.toISOString()
};
```

### 2. Polling Status
```javascript
// Import je async, můžeš pollovat DB nebo implementovat webhook
async function checkImportStatus(scheduleId) {
  // Implementuj endpoint pro kontrolu statusu
  // GET /api/v1/harvest-schedule/import-status/:id
}
```

### 3. Large Files
```javascript
// Pro velké soubory zvětši timeout
// Backend má timeout 5 minut (300000ms)
// Zvětši na frontendové straně taky
```

## Production Considerations

1. **Rate Limiting** - Implementuj rate limiting pro import endpoint
2. **Queue System** - Pro více souběžných importů použij frontu (Bull, Bee-Queue)
3. **Status Tracking** - Ulož import status do DB pro monitoring
4. **Webhooks** - Implementuj webhooks pro notifikace po dokončení
5. **Disk Space** - Monitoruj volné místo v ./temp/
6. **Cleanup** - Pravidelně mazej staré temp soubory
7. **Logging** - Loguj do souboru nebo external service (Winston, Sentry)

## Troubleshooting

### ZIP se nestáhne
- Zkontroluj harvester host v DB
- Ověř že harvester běží
- Zkontroluj network connectivity

### Import script failuje
- Zkontroluj permissions na scripts/import-data.js
- Ověř že Node.js je nainstalovaný
- Zkontroluj logy: `stderr` obsahuje error message

### Temp soubory se hromadí
```bash
# Ručně vyčisti temp složku
rm -rf ./temp/harvest_*.zip

# Implementuj cleanup job
node scripts/cleanup-temp.js
```
