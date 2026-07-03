import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import authRoutes from './routes/auth.js';
import postRoutes from './routes/posts.js';
import seoRepairRoutes from './routes/seoRepair.js';
import mediaRoutes from './routes/media.js';
import backupRoutes from './routes/backup.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { readDb } from './utils/storage.js';
import { makeSlug, publicPost, isPublicPost } from './utils/postHelpers.js';

const app = express();
const port = Number(process.env.PORT || 4000);
const siteUrl = (process.env.SITE_URL || 'http://localhost:5173').replace(/\/$/, '');
const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173,http://localhost:5174,http://127.0.0.1:5173,http://127.0.0.1:5174')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

function escapeXml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function publishedPosts(db) {
  return db.posts
    .filter((post) => isPublicPost(post))
    .sort((a, b) => new Date(b.publishedAt || b.updatedAt || b.createdAt) - new Date(a.publishedAt || a.updatedAt || a.createdAt));
}

app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error(`CORS origin engellendi: ${origin}`));
  }
}));
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));

app.get('/api/health', async (req, res, next) => {
  try {
    const db = await readDb();
    res.json({
      success: true,
      message: 'API çalışıyor',
      data: {
        uptime: process.uptime(),
        checkedAt: new Date().toISOString(),
        database: {
          status: 'ok',
          posts: Array.isArray(db.posts) ? db.posts.length : 0,
          users: Array.isArray(db.users) ? db.users.length : 0,
          comments: Array.isArray(db.comments) ? db.comments.length : 0,
          media: Array.isArray(db.media) ? db.media.length : 0
        },
        environment: {
          node: process.version,
          port,
          siteUrl
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

app.get('/robots.txt', (req, res) => {
  res.type('text/plain').send(`User-agent: *\nAllow: /\nSitemap: ${siteUrl}/sitemap.xml\n`);
});

app.get('/sitemap.xml', async (req, res, next) => {
  try {
    const db = await readDb();
    const posts = publishedPosts(db);
    const categories = [...new Set(posts.map((post) => post.category).filter(Boolean))];
    const tags = [...new Set(posts.flatMap((post) => post.tags || []))];
    const urls = [
      { loc: `${siteUrl}/`, lastmod: new Date().toISOString() },
      ...posts.map((post) => ({ loc: `${siteUrl}/posts/${post.slug}`, lastmod: post.updatedAt || post.publishedAt || post.createdAt })),
      ...categories.map((category) => ({ loc: `${siteUrl}/kategori/${makeSlug(category)}`, lastmod: new Date().toISOString() })),
      ...tags.map((tag) => ({ loc: `${siteUrl}/etiket/${makeSlug(tag)}`, lastmod: new Date().toISOString() }))
    ];

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((url) => `  <url><loc>${escapeXml(url.loc)}</loc><lastmod>${escapeXml(url.lastmod)}</lastmod></url>`).join('\n')}\n</urlset>`;
    res.type('application/xml').send(xml);
  } catch (error) {
    next(error);
  }
});

app.get('/rss.xml', async (req, res, next) => {
  try {
    const db = await readDb();
    const posts = publishedPosts(db).slice(0, 30).map(publicPost);
    const items = posts.map((post) => `
      <item>
        <title>${escapeXml(post.seoTitle || post.title)}</title>
        <link>${escapeXml(`${siteUrl}/posts/${post.slug}`)}</link>
        <guid>${escapeXml(`${siteUrl}/posts/${post.slug}`)}</guid>
        <pubDate>${new Date(post.publishedAt || post.createdAt).toUTCString()}</pubDate>
        <description>${escapeXml(post.seoDescription || post.contentSummary || post.summary)}</description>
      </item>`).join('');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
    <rss version="2.0">
      <channel>
        <title>NovaBlog</title>
        <link>${escapeXml(siteUrl)}</link>
        <description>NovaBlog son yazılar RSS akışı</description>
        ${items}
      </channel>
    </rss>`;
    res.type('application/rss+xml').send(xml);
  } catch (error) {
    next(error);
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/posts/seo', seoRepairRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/seo-repair', seoRepairRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/backup', backupRoutes);
app.use(notFound);
app.use(errorHandler);

app.listen(port, () => {
  console.log(`Blog API http://localhost:${port} adresinde çalışıyor`);
});
