import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { readDb } from '../utils/storage.js';
import { ok, fail } from '../utils/apiResponse.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return fail(res, 400, 'E-posta ve şifre zorunlu');

  const db = await readDb();
  const user = db.users.find((item) => item.email.toLowerCase() === String(email).toLowerCase());
  if (!user) return fail(res, 401, 'E-posta veya şifre hatalı');

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return fail(res, 401, 'E-posta veya şifre hatalı');

  const token = jwt.sign(
    { id: user.id, email: user.email, name: user.name, role: user.role },
    process.env.JWT_SECRET || 'dev-secret',
    { expiresIn: '7d' }
  );

  return ok(res, {
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role }
  }, 'Giriş başarılı');
});

router.get('/me', requireAuth, async (req, res) => {
  return ok(res, { user: req.user });
});

export default router;
