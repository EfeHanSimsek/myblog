import express from 'express';
import crypto from 'node:crypto';
import { readDb, writeDb } from '../utils/storage.js';
import { ok, fail } from '../utils/apiResponse.js';
import { requireAuth, requirePublisher } from '../middleware/auth.js';

const router = express.Router();
const ALLOWED_TYPES = ['image', 'video', 'document', 'audio', 'other'];

function normalizeDb(db) {
  if (!Array.isArray(db.media)) db.media = [];
  return db;
}

function validateMedia(payload) {
  if (!payload.url?.trim()) return 'Medya URL zorunlu';
  try {
    const parsed = new URL(payload.url.trim());
    if (!['http:', 'https:'].includes(parsed.protocol)) return 'Medya URL http veya https olmalı';
  } catch {
    return 'Geçerli bir medya URL gir';
  }
  if (payload.type && !ALLOWED_TYPES.includes(payload.type)) return 'Geçersiz medya tipi';
  return null;
}

function normalizeMedia(payload, fallback = {}) {
  const url = payload.url.trim();
  const nowName = url.split('/').pop()?.split('?')[0] || 'medya';
  return {
    title: payload.title?.trim() || fallback.title || nowName,
    url,
    altText: payload.altText?.trim() || payload.title?.trim() || fallback.altText || '',
    caption: payload.caption?.trim() || '',
    credit: payload.credit?.trim() || '',
    type: payload.type || fallback.type || 'image',
    tags: Array.isArray(payload.tags) ? payload.tags.map(String).map((tag) => tag.trim()).filter(Boolean) : [],
    width: payload.width ? Number(payload.width) : '',
    height: payload.height ? Number(payload.height) : '',
    sizeLabel: payload.sizeLabel?.trim() || ''
  };
}

router.get('/', requireAuth, requirePublisher, async (req, res) => {
  const db = normalizeDb(await readDb());
  const search = String(req.query.search || '').toLocaleLowerCase('tr-TR');
  const type = String(req.query.type || 'all');
  let media = db.media;

  if (type !== 'all') media = media.filter((item) => item.type === type);
  if (search) {
    media = media.filter((item) => [item.title, item.altText, item.caption, item.credit, ...(item.tags || [])]
      .join(' ')
      .toLocaleLowerCase('tr-TR')
      .includes(search));
  }

  return ok(res, {
    media: media.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt)),
    types: ALLOWED_TYPES
  });
});

router.post('/', requireAuth, requirePublisher, async (req, res) => {
  const error = validateMedia(req.body || {});
  if (error) return fail(res, 400, error);

  const db = normalizeDb(await readDb());
  const now = new Date().toISOString();
  const item = {
    id: `m_${crypto.randomUUID()}`,
    ...normalizeMedia(req.body),
    createdBy: req.user.id,
    createdAt: now,
    updatedAt: now
  };

  db.media.push(item);
  await writeDb(db);
  return ok(res, { media: item }, 'Medya kaydı oluşturuldu');
});

router.put('/:id', requireAuth, requirePublisher, async (req, res) => {
  const error = validateMedia(req.body || {});
  if (error) return fail(res, 400, error);

  const db = normalizeDb(await readDb());
  const index = db.media.findIndex((item) => item.id === req.params.id);
  if (index === -1) return fail(res, 404, 'Medya kaydı bulunamadı');

  db.media[index] = {
    ...db.media[index],
    ...normalizeMedia(req.body, db.media[index]),
    updatedAt: new Date().toISOString()
  };

  await writeDb(db);
  return ok(res, { media: db.media[index] }, 'Medya kaydı güncellendi');
});

router.delete('/:id', requireAuth, requirePublisher, async (req, res) => {
  const db = normalizeDb(await readDb());
  const before = db.media.length;
  db.media = db.media.filter((item) => item.id !== req.params.id);
  if (db.media.length === before) return fail(res, 404, 'Medya kaydı bulunamadı');

  await writeDb(db);
  return ok(res, null, 'Medya kaydı silindi');
});

export default router;
