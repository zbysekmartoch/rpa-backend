# Health Check & Monitoring

Dokumentace health check endpointu pro monitoring a diagnostiku backendu.

## Endpoint

```
GET /api/health
```

## Autentifikace

❌ Nevyžaduje autentifikaci (veřejný endpoint)

## Response

### Success (200 OK)

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

### Parametry Response

#### Root level
- `ok` (boolean) - Status služby (true = běží)
- `service` (string) - Název aplikace z package.json
- `version` (string) - Verze z package.json
- `build` (string) - Build číslo (z ENV nebo verze)
- `timestamp` (string) - ISO 8601 timestamp

#### Server object
- `host` (string) - Hostname serveru (OS hostname)
- `port` (number) - Port na kterém běží aplikace
- `nodeVersion` (string) - Verze Node.js
- `platform` (string) - Platforma OS (linux, darwin, win32)
- `uptime` (number) - Uptime procesu v sekundách

#### Database object
- `host` (string) - Hostname databázového serveru
- `port` (number) - Port databáze
- `name` (string) - Název databáze
- `user` (string) - Uživatel pro připojení k DB

### Error (500 Internal Server Error)

```json
{
  "ok": false,
  "error": "Health check failed",
  "message": "Failed to read package.json: ENOENT"
}
```

## Použití

### 1. Základní check

```bash
curl http://localhost:3000/api/health
```

### 2. Monitoring script (bash)

```bash
#!/bin/bash
response=$(curl -s http://localhost:3000/api/health)
ok=$(echo $response | jq -r '.ok')

if [ "$ok" = "true" ]; then
  echo "✓ Service is healthy"
  exit 0
else
  echo "✗ Service is down"
  exit 1
fi
```

### 3. Docker healthcheck

```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1
```

### 4. Kubernetes liveness probe

```yaml
livenessProbe:
  httpGet:
    path: /api/health
    port: 3000
  initialDelaySeconds: 30
  periodSeconds: 10
  timeoutSeconds: 3
  failureThreshold: 3
```

### 5. Kubernetes readiness probe

```yaml
readinessProbe:
  httpGet:
    path: /api/health
    port: 3000
  initialDelaySeconds: 5
  periodSeconds: 5
  timeoutSeconds: 2
  failureThreshold: 2
```

### 6. Prometheus monitoring

```javascript
// Express middleware pro Prometheus metrics
import prometheus from 'prom-client';

const healthGauge = new prometheus.Gauge({
  name: 'app_health',
  help: 'Application health status'
});

// Update gauge periodically
setInterval(async () => {
  try {
    const response = await fetch('http://localhost:3000/api/health');
    const data = await response.json();
    healthGauge.set(data.ok ? 1 : 0);
  } catch (error) {
    healthGauge.set(0);
  }
}, 10000); // každých 10 sekund
```

### 7. Node.js monitoring client

```javascript
const axios = require('axios');

async function checkHealth() {
  try {
    const response = await axios.get('http://localhost:3000/api/health', {
      timeout: 5000
    });
    
    const health = response.data;
    
    console.log(`Service: ${health.service} v${health.version}`);
    console.log(`Status: ${health.ok ? '✓ Healthy' : '✗ Unhealthy'}`);
    console.log(`Server: ${health.server.host}:${health.server.port}`);
    console.log(`Uptime: ${Math.floor(health.server.uptime / 60)} minutes`);
    console.log(`Database: ${health.database.name}@${health.database.host}`);
    
    return health.ok;
  } catch (error) {
    console.error('Health check failed:', error.message);
    return false;
  }
}

// Periodický check
setInterval(async () => {
  const isHealthy = await checkHealth();
  if (!isHealthy) {
    // Alert/notification logic
    console.error('⚠️ Service is unhealthy!');
  }
}, 60000); // každou minutu
```

### 8. Python monitoring script

```python
import requests
import time
import json

def check_health(url='http://localhost:3000/api/health'):
    try:
        response = requests.get(url, timeout=5)
        health = response.json()
        
        if health.get('ok'):
            print(f"✓ {health['service']} v{health['version']} is healthy")
            print(f"  Uptime: {int(health['server']['uptime'] / 60)} minutes")
            print(f"  Database: {health['database']['name']}@{health['database']['host']}")
            return True
        else:
            print(f"✗ Service unhealthy: {health.get('error')}")
            return False
    except Exception as e:
        print(f"✗ Health check failed: {str(e)}")
        return False

# Monitoring loop
while True:
    is_healthy = check_health()
    if not is_healthy:
        # Send alert (email, Slack, etc.)
        pass
    time.sleep(60)  # Check every minute
```

### 9. Uptime monitoring s alertem

```javascript
const nodemailer = require('nodemailer');

let failureCount = 0;
const FAILURE_THRESHOLD = 3;

async function monitorHealth() {
  try {
    const response = await fetch('http://localhost:3000/api/health');
    const health = await response.json();
    
    if (health.ok) {
      failureCount = 0;
      console.log(`✓ Healthy - Uptime: ${Math.floor(health.server.uptime / 60)}m`);
    } else {
      failureCount++;
      console.error(`✗ Unhealthy (${failureCount}/${FAILURE_THRESHOLD})`);
      
      if (failureCount >= FAILURE_THRESHOLD) {
        await sendAlert(health);
      }
    }
  } catch (error) {
    failureCount++;
    console.error(`✗ Check failed (${failureCount}/${FAILURE_THRESHOLD}):`, error.message);
    
    if (failureCount >= FAILURE_THRESHOLD) {
      await sendAlert({ error: error.message });
    }
  }
}

async function sendAlert(health) {
  // Implementace alertu (email, Slack, SMS, etc.)
  console.error('🚨 ALERT: Service is down!');
  // Reset counter after alert
  failureCount = 0;
}

// Check každých 30 sekund
setInterval(monitorHealth, 30000);
```

### 10. Grafana Dashboard Query

```
# Prometheus query pro Grafana
app_health{job="rpa-backend"}

# PromQL pro uptime
process_uptime_seconds{job="rpa-backend"}

# Alert rule
ALERT ServiceDown
  IF app_health == 0
  FOR 2m
  LABELS { severity = "critical" }
  ANNOTATIONS {
    summary = "RPA Backend is down",
    description = "Service has been down for more than 2 minutes"
  }
```

## Build Number Configuration

Pro nastavení build čísla v CI/CD:

### GitHub Actions

```yaml
- name: Build and Deploy
  env:
    BUILD_NUMBER: ${{ github.run_number }}
  run: npm run build
```

### GitLab CI

```yaml
build:
  script:
    - export BUILD_NUMBER=$CI_PIPELINE_ID
    - npm run build
```

### Jenkins

```groovy
environment {
  BUILD_NUMBER = "${env.BUILD_NUMBER}"
}
```

## Environment Variables

```bash
# Optional: Custom build number
BUILD_NUMBER=12345

# Service port (falls back to config)
PORT=3000
```

## Troubleshooting

### Health check vrací 500

**Možné příčiny:**
1. Nečitelný package.json
2. Chybějící config.js
3. Nesprávná DB konfigurace

**Řešení:**
```bash
# Zkontroluj package.json
cat package.json | jq .version

# Zkontroluj config
node -e "import('./src/config.js').then(c => console.log(c.config))"

# Zkontroluj logy
tail -f logs/error.log
```

### Uptime je nízký po restartu

To je normální - `process.uptime()` se resetuje při restartu procesu.

### Database credentials ve výstupu

Health endpoint **nezobrazuje password**, pouze host, port, name a user.

## Security Considerations

1. **Password protection** - Heslo k DB není zahrnuto v response
2. **Rate limiting** - Zvažte rate limiting pro public endpoint
3. **DDoS protection** - Použijte reverse proxy (nginx, Cloudflare)
4. **Sensitive data** - Response neobsahuje citlivé informace

## Best Practices

1. ✅ Používejte pro liveness a readiness probes
2. ✅ Implementujte monitoring alerts
3. ✅ Logujte health check failures
4. ✅ Nastavte rozumné timeouty (3-5s)
5. ✅ Periodické kontroly (30-60s interval)
6. ⚠️ Nepoužívejte pro deep health checks (DB connectivity)
7. ⚠️ Nepoužívejte příliš často (DDoS risk)
