# Testování Reset Hesla přes E-mail

## Příprava

### 1. Konfigurace Gmail (doporučeno pro testování)

1. **Zapni 2-Factor Authentication**
   - Jdi na https://myaccount.google.com/security
   - Zapni "2-Step Verification"

2. **Vygeneruj App Password**
   - Jdi na https://myaccount.google.com/apppasswords
   - Vytvoř nový App Password pro "Mail"
   - Zkopíruj vygenerované heslo (16 znaků)

3. **Nastav .env**
   ```bash
   EMAIL_HOST=smtp.gmail.com
   EMAIL_PORT=587
   EMAIL_SECURE=false
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASSWORD=your-16-char-app-password
   EMAIL_FROM=your-email@gmail.com
   FRONTEND_URL=http://localhost:5173
   ```

### 2. Alternativní SMTP servery

#### Mailtrap (pro development)
```bash
EMAIL_HOST=smtp.mailtrap.io
EMAIL_PORT=2525
EMAIL_USER=your-mailtrap-username
EMAIL_PASSWORD=your-mailtrap-password
```

#### SendGrid
```bash
EMAIL_HOST=smtp.sendgrid.net
EMAIL_PORT=587
EMAIL_USER=apikey
EMAIL_PASSWORD=your-sendgrid-api-key
```

#### Outlook/Hotmail
```bash
EMAIL_HOST=smtp-mail.outlook.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your-email@outlook.com
EMAIL_PASSWORD=your-password
```

## Testování API

### 1. Registrace uživatele (pokud ještě nemáš)

```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Test",
    "lastName": "User",
    "email": "test@example.com",
    "password": "password123"
  }'
```

### 2. Žádost o reset hesla

```bash
curl -X POST http://localhost:3000/api/v1/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com"
  }'
```

**Očekávaná odpověď:**
```json
{
  "message": "Pokud e-mail existuje v systému, byly na něj odeslány pokyny pro obnovení hesla"
}
```

**Co se stane:**
- Backend vygeneruje JWT token s 1h expirací
- Odešle e-mail s reset linkem
- E-mail obsahuje odkaz typu: `http://localhost:5173/reset-password?token=eyJhbG...`

### 3. Zkontroluj e-mail

Otevři e-mail a zkopíruj token z URL (část za `?token=`)

### 4. Potvrzení nového hesla

```bash
curl -X POST http://localhost:3000/api/v1/auth/reset-password/confirm \
  -H "Content-Type: application/json" \
  -d '{
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "newPassword": "NewSecurePassword123"
  }'
```

**Očekávaná odpověď:**
```json
{
  "message": "Heslo bylo úspěšně změněno. Nyní se můžete přihlásit s novým heslem."
}
```

### 5. Ověř nové heslo

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "NewSecurePassword123"
  }'
```

## Testování bez e-mailové konfigurace

Pokud nemáš nakonfigurovaný SMTP server, backend bude fungovat, ale:
- Reset token se vypíše do konzole serveru
- E-mail se neodešle
- Můžeš ručně zkopírovat token z konzole pro testování

**Hledej v konzoli:**
```
Reset email odeslán: <messageId>
```
nebo
```
Email transport není nakonfigurován. Reset token: eyJhbG...
```

## Možné chyby a řešení

### "Email transport není nakonfigurován"
- Zkontroluj EMAIL_USER a EMAIL_PASSWORD v .env
- Restartuj server po změně .env

### "Invalid login: 535 Authentication failed"
- Pro Gmail: použij App Password místo normálního hesla
- Zkontroluj, že máš zapnuté 2FA

### "Token expired"
- Token má platnost 1 hodinu
- Požádej o nový reset hesla

### E-mail nepřichází
- Zkontroluj spam složku
- Ověř EMAIL_FROM adresu
- Zkus jiný SMTP server (např. Mailtrap pro testování)

## Frontend implementace

Vytvoř stránku `/reset-password` ve frontendu:

```javascript
// ResetPassword.jsx
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';

function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const response = await fetch('http://localhost:3000/api/v1/auth/reset-password/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword })
      });
      
      const data = await response.json();
      setMessage(data.message || data.error);
      
      if (response.ok) {
        // Redirect to login after 2 seconds
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
      }
    } catch (error) {
      setMessage('Chyba při resetování hesla');
    }
  };

  return (
    <div>
      <h1>Reset hesla</h1>
      <form onSubmit={handleSubmit}>
        <input
          type="password"
          placeholder="Nové heslo"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
          minLength="8"
        />
        <button type="submit">Změnit heslo</button>
      </form>
      {message && <p>{message}</p>}
    </div>
  );
}
```

## Monitoring

Pro produkci zvažte:
- Logování všech reset pokusů
- Rate limiting pro reset endpointy
- Monitoring doručování e-mailů
- Alerting při selhání SMTP
