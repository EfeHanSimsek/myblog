import jwt from 'jsonwebtoken';
import { fail } from '../utils/apiResponse.js';

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) return fail(res, 401, 'Giriş gerekli');

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
    return next();
  } catch {
    return fail(res, 401, 'Oturum geçersiz veya süresi dolmuş');
  }
}

export function requirePublisher(req, res, next) {
  if (!['admin', 'publisher'].includes(req.user?.role)) {
    return fail(res, 403, 'Bu işlem için yetkin yok');
  }
  return next();
}
