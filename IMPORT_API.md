# Harvest Schedule Import API

Documentation for importing data from harvester to database.

## Endpoint

```
POST /api/v1/harvest-schedule/import/:id
```

## Authentication

✅ Requires JWT token in header

## Parameters

### URL parameter
- `id` (integer) - Harvest schedule job ID

### Query/Body parameters (optional)

#### Date Range Filtering
- `from` (string) - ISO 8601 datetime, e.g., `2025-10-01T00:00:00Z`
  - Filters data by modification time
  - Includes JSON files, screenshots and images
  
- `to` (string) - ISO 8601 datetime, e.g., `2025-10-31T23:59:59Z`
  - Filters data by modification time
  - Includes JSON files, screenshots and images

#### Content Type Filtering
- `screenshots` (boolean) - Include price screenshots
  - Filters files: `*prices*.png`, `*prices*.jpg`
  - Default: `false`
  
- `images` (boolean) - Include product images
  - Filters files: `product*.jpg`, `product*.png`
  - Default: `false`

## Request Examples

### cURL - all data
```bash
curl -X POST http://localhost:3000/api/v1/harvest-schedule/import/123 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### cURL - with date range
```bash
curl -X POST "http://localhost:3000/api/v1/harvest-schedule/import/123?from=2025-10-01T00:00:00Z&to=2025-10-31T23:59:59Z" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### cURL - with images and screenshots
```bash
curl -X POST "http://localhost:3000/api/v1/harvest-schedule/import/123?images=true&screenshots=true" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### cURL - complex example
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

**Note:** Import runs asynchronously in background. Response is immediate.

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
2. Backend → DB: Get harvester host for schedule
   ↓
3. Backend → Harvester: GET /export/123?params
   ↓ (downloading ZIP)
4. Backend → Disk: Save ZIP to ./temp/harvest_123_timestamp.zip
   ↓
5. Backend → Client: Response { status: "downloading" }
   ↓ (async continues)
6. Backend → Script: node scripts/import-data.js zipFile
   ↓
7. Script: Extract ZIP, process data, import to DB
   ↓
8. Backend: Delete temporary ZIP file
   ↓
9. ✓ Import completed (logged to console)
```

## Harvester Export API

Backend calls harvester export endpoint:
```
GET {harvester_host}/export/{harvestingJobId}?from=...&to=...&images=...&screenshots=...
```

**Expected response:**
- Content-Type: `application/zip`
- Binary ZIP file containing:
  - JSON files with data
  - Product images (if `images=true`)
  - Price screenshots (if `screenshots=true`)

## Import Script

Backend runs: `node scripts/import-data.js <zipFilePath>`

**Script responsibilities:**
1. Extract ZIP file
2. Load and parse JSON data
3. Process images (save, optimize)
4. Import data to database
5. Return exit code 0 on success

**Logging:**
- stdout - import progress
- stderr - errors
- Exit code 0 = success, otherwise = error

## Monitoring

Backend logs to console:
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

Import is asynchronous, so errors are logged to console:

```javascript
// Download errors
console.error('Failed to download ZIP: HTTP 500 Internal Server Error');

// Import errors
console.error('Import failed for schedule 123: Import script exited with code 1');

// Temporary ZIP is always attempted to be deleted even on error
```

## Best Practices

### 1. Date Range
```javascript
// Last month
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
// Import is async, you can poll DB or implement webhook
async function checkImportStatus(scheduleId) {
  // Implement endpoint to check status
  // GET /api/v1/harvest-schedule/import-status/:id
}
```

### 3. Large Files
```javascript
// For large files increase timeout
// Backend has 5 minute timeout (300000ms)
// Increase on frontend side too
```

## Production Considerations

1. **Rate Limiting** - Implement rate limiting for import endpoint
2. **Queue System** - For multiple concurrent imports use queue (Bull, Bee-Queue)
3. **Status Tracking** - Store import status in DB for monitoring
4. **Webhooks** - Implement webhooks for completion notifications
5. **Disk Space** - Monitor free space in ./temp/
6. **Cleanup** - Regularly delete old temp files
7. **Logging** - Log to file or external service (Winston, Sentry)

## Troubleshooting

### ZIP doesn't download
- Check harvester host in DB
- Verify harvester is running
- Check network connectivity

### Import script fails
- Check permissions on scripts/import-data.js
- Verify Node.js is installed
- Check logs: `stderr` contains error message

### Temp files accumulating
```bash
# Manually clean temp folder
rm -rf ./temp/harvest_*.zip

# Implement cleanup job
node scripts/cleanup-temp.js
```
