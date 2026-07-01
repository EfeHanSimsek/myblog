import { fail } from '../utils/apiResponse.js';

export function notFound(req, res) {
  return fail(res, 404, 'Endpoint bulunamadı');
}

export function errorHandler(err, req, res, next) {
  console.error(err);
  return fail(res, 500, 'Beklenmeyen sunucu hatası', process.env.NODE_ENV === 'production' ? null : err.message);
}
