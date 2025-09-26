import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../db.js';
import { config } from '../config.js';

const router = Router();

/**
 * POST /api/v1/auth/login
 */
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body ?? {};
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email a heslo jsou povinné' });
    }

    // Najdeme uživatele podle emailu
    const rows = await query(
      'SELECT id, first_name, last_name, email, password_hash FROM usr WHERE email = ?',
      [email]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Neplatné přihlašovací údaje' });
    }

    const user = rows[0];
    
    // Ověříme heslo
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Neplatné přihlašovací údaje' });
    }

    // Vytvoříme JWT token
    const token = jwt.sign(
      { userId: user.id },
      config.jwtSecret,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email
      }
    });
  } catch (e) {
    next(e);
  }
});

/**
 * POST /api/v1/auth/register
 */
router.post('/register', async (req, res, next) => {
  try {
    const { firstName, lastName, email, password } = req.body ?? {};
    
    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ error: 'Všechna pole jsou povinná' });
    }

    if (password.length < 1) {
      return res.status(400).json({ error: 'Heslo musí mít alespoň 1 znak' });
    }

    // Zahashujeme heslo
    const passwordHash = await bcrypt.hash(password, 12);

    // Vytvoříme uživatele
    await query(
      'INSERT INTO usr (first_name, last_name, email, password_hash) VALUES (?, ?, ?, ?)',
      [firstName, lastName, email, passwordHash]
    );

    res.status(201).json({ message: 'Uživatel byl úspěšně zaregistrován' });
  } catch (e) {
    if (e?.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Uživatel s tímto e-mailem již existuje' });
    }
    next(e);
  }
});

/**
 * GET /api/v1/auth/me
 */
router.get('/me', async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Chybí autorizační token' });
    }

    const token = authHeader.slice(7);
    
    try {
      const decoded = jwt.verify(token, config.jwtSecret);
      const userId = decoded.userId;

      const rows = await query(
        'SELECT id, first_name, last_name, email FROM usr WHERE id = ?',
        [userId]
      );

      if (rows.length === 0) {
        return res.status(401).json({ error: 'Neplatný token' });
      }

      const user = rows[0];
      res.json({
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email
      });
    } catch (jwtError) {
      return res.status(401).json({ error: 'Neplatný nebo vypršelý token' });
    }
  } catch (e) {
    next(e);
  }
});

/**
 * POST /api/v1/auth/reset-password
 */
router.post('/reset-password', async (req, res, next) => {
  try {
    const { email } = req.body ?? {};
    
    if (!email) {
      return res.status(400).json({ error: 'Email je povinný' });
    }

    const rows = await query('SELECT id FROM usr WHERE email = ?', [email]);
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Uživatel s tímto e-mailem neexistuje' });
    }

    // Vygenerujeme reset token (pro jednoduchost použijeme JWT)
    const resetToken = jwt.sign(
      { userId: rows[0].id, type: 'reset' },
      config.jwtSecret,
      { expiresIn: '1h' }
    );

    // V reálné aplikaci by se token uložil do DB a poslal email
    // Pro demo účely jen vrátíme success
    console.log(`Reset token pro ${email}: ${resetToken}`);
    
    res.json({ message: 'Pokyny pro obnovení hesla byly odeslány na váš e-mail' });
  } catch (e) {
    next(e);
  }
});

export default router;