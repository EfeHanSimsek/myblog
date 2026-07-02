import React from 'react';

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('tr-TR', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
}

function getPostQualityIssues(post) {
  const issues = [];
  const wordCount = String(post.content || '').trim().split(/\s+/).filter(Boolean).length;
  const seoTitleLength = String(post.seoTitle || '').trim().length;
  const seoDescriptionLength = String(post.seoDescription || '').trim().length;

  if (!String(post.title || '').trim()) issues.push('Başlık eksik');
  if (!String(post.slug || '').trim()) issues.push('Slug eksik');
  if (!String(post.summary || '').trim()) issues.push('Özet eksik');
  if (!String(post.category || '').trim()) issues.push('Kategori eksik');
  if (!post.coverImage) issues.push('Kapak görseli eksik');
  if (post.coverImage && !post.altCoverImage) issues.push('Kapak alt metni eksik');
  if (!Array.isArray(post.tags) || !post.tags.length) issues.push('Etiket eksik');
  if (wordCount < 300) issues.push('İçerik kısa');
  if (seoTitleLength < 30 || seoTitleLength > 70) issues.push('SEO başlığı zayıf');
  if (seoDescriptionLength < 90 || seoDescriptionLength > 160) issues.push('SEO açıklaması zayıf');

  return issues;
}

function getOverview(posts) {
  const now = Date.now();
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  const scheduled = posts
    .filter((post) => post.status === 'published' && post.publishedAt && new Date(post.publishedAt).getTime() > now)
    .sort((a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime());
  const dueSoon = scheduled.filter((post) => new Date(post.publishedAt).getTime() - now <= sevenDays);
  const datedDrafts = posts.filter((post) => post.status === 'draft' && post.publishedAt);
  const riskyPosts = posts
    .map((post) => ({ post, issues: getPostQualityIssues(post) }))
    .filter((item) => item.issues.length)
    .sort((a, b) => b.issues.length - a.issues.length);

  return {
    scheduled,
    dueSoon,
    datedDrafts,
    riskyPosts,
    readyPosts: posts.filter((post) => getPostQualityIssues(post).length === 0).length,
    nextPost: scheduled[0] || null,
    topRisk: riskyPosts[0] || null
  };
}

const quickActions = [
  {
    href: '/dashboard#editor',
    label: 'Yeni yazı',
    detail: 'Editör formuna git'
  },
  {
    href: '/dashboard#media-library',
    label: 'Medya ekle',
    detail: 'Medya kütüphanesine git'
  },
  {
    href: '/dashboard#backup',
    label: 'Yedek indir',
    detail: 'JSON yedek alanına git'
  },
  {
    href: '/dashboard/quality',
    label: 'Kalite kontrol',
    detail: 'Yayın hazırlığını denetle'
  },
  {
    href: '/dashboard/calendar',
    label: 'Takvim',
    detail: 'Yayın planını gör'
  },
  {
    href: '/dashboard/system',
    label: 'Sistem',
    detail: 'Sağlık ve import alanı'
  }
];

export function DashboardOverview({ posts }) {
  const overview = getOverview(posts || []);

  return (
    <div className="overview-grid">
      <article className="panel overview-card">
        <div className="section-heading">
          <div><p className="eyebrow">Kalite Özeti</p><h2>Yayına hazırlık</h2></div>
          <a className="row-action" href="/dashboard/quality">Kalite paneli</a>
        </div>
        <div className="quality-summary">
          <div><strong>{overview.readyPosts}</strong><span>Sorunsuz yazı</span></div>
          <div><strong>{overview.riskyPosts.length}</strong><span>Kontrol isteyen yazı</span></div>
          <div><strong>{overview.topRisk?.issues.length || 0}</strong><span>En yüksek risk</span></div>
        </div>
        {overview.topRisk ? (
          <p className="notice">Öncelik: <strong>{overview.topRisk.post.title}</strong> — {overview.topRisk.issues.slice(0, 3).join(', ')}</p>
        ) : (
          <p className="success">Tüm yazılar temel kalite kontrollerinden geçiyor.</p>
        )}
      </article>

      <article className="panel overview-card">
        <div className="section-heading">
          <div><p className="eyebrow">Takvim Özeti</p><h2>Yayın planı</h2></div>
          <a className="row-action" href="/dashboard/calendar">Takvime git</a>
        </div>
        <div className="quality-summary">
          <div><strong>{overview.scheduled.length}</strong><span>Zamanlanmış</span></div>
          <div><strong>{overview.dueSoon.length}</strong><span>7 gün içinde</span></div>
          <div><strong>{overview.datedDrafts.length}</strong><span>Tarihli taslak</span></div>
        </div>
        {overview.nextPost ? (
          <p className="notice">Sıradaki yayın: <strong>{overview.nextPost.title}</strong> — {formatDateTime(overview.nextPost.publishedAt)}</p>
        ) : (
          <p className="notice">Henüz zamanlanmış yayın yok.</p>
        )}
      </article>

      <article className="panel overview-card quick-actions-card">
        <div className="section-heading">
          <div><p className="eyebrow">Hızlı Aksiyonlar</p><h2>Admin kısayolları</h2></div>
          <a className="row-action" href="/dashboard/system">Sistem</a>
        </div>
        <div className="quick-actions-grid">
          {quickActions.map((action) => (
            <a className="button-link quick-action-link" href={action.href} key={action.href}>
              <strong>{action.label}</strong>
              <span>{action.detail}</span>
            </a>
          ))}
        </div>
        <p className="notice">Kısayollar artık doğrudan ilgili admin alanına yönlenir; yerel testte form state'ini değiştirmeden güvenli anchor geçişi sağlar.</p>
      </article>
    </div>
  );
}
