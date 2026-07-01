export function ok(res, data = null, message = 'İşlem başarılı') {
  return res.json({ success: true, message, data });
}

export function fail(res, status, message, error = null) {
  return res.status(status).json({ success: false, message, error });
}
