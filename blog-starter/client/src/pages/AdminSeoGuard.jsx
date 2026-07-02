import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import './AdminSeoGuard.css';

function countWords(value) {
  return String(value || '').trim().split(/\s+/).filter(Boolean).length;
}

function getSeoChecks(post) {
  const titleLength = String(post.title || '').trim().length;
  const slugLength = String(post.slug || '').trim().length;
  const summaryLength = String(post.summary || '').trim().length;
  const seoTitleLength = String(post.seoTitle || '').trim().length;
  const seoDescriptionLength = String(post.seoDescription || '').trim().length;
  const tagCount = Array.isArray(post.tags) ? post.tags.length : 0;
  const wordCount = countWords(post.content);

  return [
    {
      key: 'title',
      level: titleLength ? 'warning' : 'critical',
      ok: titleLength >= 20 && titleLength <= 80,
      label: 'Başlık',
      detail: titleLength ? `${titleLength} karakter. İdeal aralık 20-80.` : 'Başlık boş bırakılamaz.',
      fix: titleLength < 20 ? 'Başlığı daha açıklayıcı hale getir.' : titleLength > 80 ? 'Başlığı 80 karakterin altına indir.' : 'Hazır.'
    },
    {
      key: 'slug',
      level: 'critical',
      ok: slugLength > 0 && slugLength <= 80,
      label: 'Slug',
      detail: slugLength ? `${slugLength} karakterlik slug var.` : 'Slug eksik.',
      fix: 'Editörde başlıktan otomatik slug üret veya kısa, okunabilir bir slug yaz.'
    },
    {
      key: 'summary',
      level: 'warning',
      ok: summaryLength >= 60,
      label: 'Özet',
      detail: `${summaryLength} karakter. Listeleme ve paylaşım için en az 60 önerilir.`,
      fix: 'Yazının ana fikrini 1-2 özgün cümleyle özetle.'
    },
    {
      key: 'seoTitle',
      level: 'critical',
      ok: seoTitleLength >= 30 && seoTitleLength <= 70,
      label: 'SEO başlığı',
      detail: `${seoTitleLength}/70 karakter. İdeal aralık 30-70.`,
      fix: 'Ana anahtar kelimeyi içeren, tıklanabilir ama abartısız bir SEO başlığı yaz.'
    },
    {
      key: 'seoDescription',
      level: 'critical',
      ok: seoDescriptionLength >= 90 && seoDescriptionLength <= 160,
      label: 'SEO açıklaması',
      detail: `${seoDescriptionLength}/160 karakter. İdeal aralık 90-160.`,
      fix: 'Yazının faydasını ve konusunu anlatan 90-160 karakterlik özgün açıklama ekle.'
    },
    {
      key: 'coverAlt',
      level: 'warning',
      ok: !post.coverImage || String(post.altCoverImage || '').trim().length >= 8,
      label: 'Kapak alt metni',
      detail: post.coverImage ? 'Kapak görseli var; erişilebilirlik açıklaması gerekli.' : 'Kapak görseli yok.',
      fix: 'Görselde ne olduğunu tarif eden kısa ve doğal bir alt metin yaz.'
    },
    {
      key: 'tags',
      level: 'warning',
      ok: tagCount >= 2,
      label: 'Etiket',
      detail: `${tagCount} etiket. Keşif için en az 2 önerilir.`,
      fix: 'Konuyu ve alt temayı temsil eden 2-5 etiket ekle.'
    },
    {
      key: 'content',
      level: 'warning',
      ok: wordCount >= 300,
      label: 'İçerik uzunluğu',
      detail: `${wordCount} kelime. Kalıcı blog yazıları için en az 300 önerilir.`,
      fix: 'Giriş, bağlam, ana detaylar ve sonuç bölümüyle içeriği genişlet.'
    }
  ];
}

function getPostGuard(post) {
  const checks = getSeoChecks(post);
  const missing = checks.filter((check) => !check.ok);
  const critical = missing.filter((check) => check.level === 'critical');
  const score = Math.round(((checks.length - missing.length) / checks.length) * 100);

  return {
    post,
    checks,
    missing,
    critical,
    score,
    status: critical.length ? 'critical' : missing.length ? 'warning' : 'ready'
  };
}

export function AdminSeoGuard() {
  const [posts, setPosts] = useState([]);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('needs-work');

  useEffect(() => {
    api('/posts?includeDrafts=true')
      .then((data) => setPosts(data.posts || []))
      .catch((err) => setError(err.message));
  }, []);

  const guards = useMemo(() => {
    return posts
      .map(getPostGuard)
      .sort((a, b) => b.critical.length - a.critical.length || b.missing.length - a.missing.length || a.score - b.score);
  }, [posts]);

  const filteredGuards = useMemo(() => {
    if (statusFilter === 'critical') return guards.filter((item) => item.critical.length);
    if (statusFilter === 'ready') return guards.filter((item) => item.status === 'ready');
    if (statusFilter === 'published') return guards.filter((item) => item.post.status === 'published');
    if (statusFilter === 'draft') return guards.filter((item) => item.post.status === 'draft');
    return guards.filter((item) => item.status !== 'ready');
  }, [guards, statusFilter]);

  const criticalCount = guards.filter((item) => item.critical.length).length;
  const warningCount = guards.filter((item) => item.status === 'warning').length;
  const readyCount = guards.filter((item) => item.status === 'ready').length;

  return (
    <section className="page stack seo-guard-page">
      <div className="section-heading">
        <div>
          <p className="eyebrow">SEO Onarım</p>
          <h1>Kayıt öncesi kritik kontrol</h1>
        </div>
        <Link className="row-action" to="/dashboard/quality">Kalite paneli</Link>
      </div>

      <div className="stats">
        <div><strong>{criticalCount}</strong><span>Kritik yazı</span></div>
        <div><strong>{warningCount}</strong><span>Uyarı alan</span></div>
        <div><strong>{readyCount}</strong><span>Hazır</span></div>
        <div><strong>{posts.length}</strong><span>Toplam yazı</span></div>
      </div>

      <div className="panel seo-guard-intro">
        <div>
          <p className="eyebrow">Yayın güvenliği</p>
          <h2>Önce kritik alanları kapat</h2>
        </div>
        <p>
          Bu panel yazıları kaydetmeden veya yayına almadan önce kritik SEO eksiklerini görünür yapar. Dış servis, ödeme, CDN veya mail hesabı gerektirmez; mevcut custom backend verisini okur.
        </p>
      </div>

      <div className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Filtre</p>
            <h2>Onarım kuyruğu</h2>
          </div>
          <select className="compact-filter" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="needs-work">Eksik olanlar</option>
            <option value="critical">Sadece kritik</option>
            <option value="published">Yayındaki yazılar</option>
            <option value="draft">Taslaklar</option>
            <option value="ready">Hazır olanlar</option>
          </select>
        </div>

        {error && <p className="error">{error}</p>}

        <div className="seo-guard-list">
          {filteredGuards.map((item) => (
            <article className={`seo-guard-card seo-guard-${item.status}`} key={item.post.id}>
              <div className="seo-guard-card-head">
                <div>
                  <strong>{item.post.title || 'Başlıksız yazı'}</strong>
                  <span>{item.post.status} · {item.post.category || 'kategori yok'} · %{item.score} hazır</span>
                </div>
                <Link className="row-action" to={`/dashboard?edit=${item.post.id}&focus=seo`}>SEO eksiklerini düzelt</Link>
              </div>

              {item.status === 'ready' ? (
                <p className="success">Bu yazı temel SEO kayıt kontrollerinden geçiyor.</p>
              ) : (
                <div className="seo-repair-grid">
                  {item.missing.map((check) => (
                    <div className={`seo-repair-item seo-repair-${check.level}`} key={check.key}>
                      <strong>{check.level === 'critical' ? 'Kritik' : 'Uyarı'} · {check.label}</strong>
                      <span>{check.detail}</span>
                      <em>{check.fix}</em>
                    </div>
                  ))}
                </div>
              )}
            </article>
          ))}

          {!filteredGuards.length && <p className="success">Bu filtrede onarım gerektiren yazı yok.</p>}
        </div>
      </div>
    </section>
  );
}
