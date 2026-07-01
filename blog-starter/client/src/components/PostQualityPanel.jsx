import React from 'react';

function getScoreLabel(score) {
  if (score >= 90) return 'Yayına hazır';
  if (score >= 70) return 'Küçük düzeltme gerekli';
  if (score >= 45) return 'Eksikleri tamamla';
  return 'Taslak kalmalı';
}

function getSeverityClass(severity) {
  return `quality-item quality-${severity}`;
}

export function analyzePostQuality(post) {
  const title = post.title?.trim() || '';
  const slug = post.slug?.trim() || '';
  const summary = post.summary?.trim() || '';
  const seoTitle = post.seoTitle?.trim() || '';
  const seoDescription = post.seoDescription?.trim() || '';
  const content = post.content?.trim() || '';
  const coverImage = post.coverImage?.trim() || '';
  const altCoverImage = post.altCoverImage?.trim() || '';
  const category = post.category?.trim() || '';
  const tags = typeof post.tags === 'string'
    ? post.tags.split(',').map((tag) => tag.trim()).filter(Boolean)
    : post.tags || [];
  const wordCount = content.split(/\s+/).filter(Boolean).length;
  const issues = [];

  function addIssue(condition, severity, label, help) {
    if (condition) issues.push({ severity, label, help });
  }

  addIssue(!title, 'critical', 'Başlık yok', 'Yazının listelerde ve SEO alanlarında net görünmesi için başlık zorunlu.');
  addIssue(title && (title.length < 20 || title.length > 75), 'warning', 'Başlık uzunluğu zayıf', 'Başlığı 20-75 karakter aralığında tutmak tıklanabilirliği artırır.');
  addIssue(!slug, 'critical', 'Slug yok', 'Kalıcı bağlantı boş kalırsa yayın URL’si sorun çıkarabilir.');
  addIssue(!category, 'warning', 'Kategori yok', 'Kategori arşivleri ve filtreleme için kategori girilmeli.');
  addIssue(!summary || summary.length < 70, 'warning', 'Özet kısa veya boş', 'Kartlarda görünecek özet en az 70 karakter olmalı.');
  addIssue(!seoTitle, 'warning', 'SEO başlığı yok', 'Arama sonuçları için özel başlık girilmeli.');
  addIssue(seoTitle && (seoTitle.length < 30 || seoTitle.length > 60), 'notice', 'SEO başlığı ideal aralıkta değil', 'SEO başlığını 30-60 karakter aralığında tut.');
  addIssue(!seoDescription, 'warning', 'SEO açıklaması yok', 'Arama sonuçlarında görünecek açıklama boş kalmamalı.');
  addIssue(seoDescription && (seoDescription.length < 110 || seoDescription.length > 160), 'notice', 'SEO açıklaması ideal aralıkta değil', 'Açıklamayı 110-160 karakter aralığında tut.');
  addIssue(!coverImage, 'warning', 'Kapak görseli yok', 'Paylaşım kartları ve arşiv görünümü için kapak görseli önerilir.');
  addIssue(coverImage && !altCoverImage, 'critical', 'Kapak alt metni yok', 'Erişilebilirlik ve görsel SEO için alt metin eklenmeli.');
  addIssue(tags.length < 2, 'notice', 'Etiket sayısı az', 'En az 2-4 alakalı etiket önerilir.');
  addIssue(wordCount < 250, 'warning', 'İçerik kısa', 'Blog yazısı için en az 250 kelime hedefle.');

  const penalty = issues.reduce((total, issue) => {
    if (issue.severity === 'critical') return total + 22;
    if (issue.severity === 'warning') return total + 12;
    return total + 6;
  }, 0);
  const score = Math.max(0, Math.min(100, 100 - penalty));

  return {
    score,
    label: getScoreLabel(score),
    wordCount,
    issueCount: issues.length,
    criticalCount: issues.filter((issue) => issue.severity === 'critical').length,
    issues
  };
}

export function PostQualityPanel({ currentPost, posts }) {
  const currentQuality = analyzePostQuality(currentPost);
  const publishedWithIssues = posts
    .filter((post) => post.status === 'published')
    .map((post) => ({ post, quality: analyzePostQuality(post) }))
    .filter(({ quality }) => quality.criticalCount > 0 || quality.score < 70)
    .slice(0, 5);

  return (
    <div className="panel quality-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Kalite Kontrol</p>
          <h2>Yayına Hazır mı?</h2>
        </div>
        <span className="quality-score">{currentQuality.score}/100 · {currentQuality.label}</span>
      </div>

      <div className="quality-summary">
        <div><strong>{currentQuality.wordCount}</strong><span>Kelime</span></div>
        <div><strong>{currentQuality.issueCount}</strong><span>Uyarı</span></div>
        <div><strong>{currentQuality.criticalCount}</strong><span>Kritik</span></div>
      </div>

      {currentQuality.issues.length ? (
        <div className="quality-list">
          {currentQuality.issues.map((issue) => (
            <article className={getSeverityClass(issue.severity)} key={`${issue.severity}-${issue.label}`}>
              <strong>{issue.label}</strong>
              <p>{issue.help}</p>
            </article>
          ))}
        </div>
      ) : (
        <p className="success">Bu yazı temel yayın kalite kontrollerinden geçti.</p>
      )}

      {publishedWithIssues.length > 0 && (
        <div className="quality-audit">
          <h3>Yayındaki riskli yazılar</h3>
          <div className="table-list">
            {publishedWithIssues.map(({ post, quality }) => (
              <div className="table-row compact-row" key={post.id}>
                <div>
                  <strong>{post.title}</strong>
                  <span>{quality.score}/100 · {quality.issueCount} uyarı · {quality.criticalCount} kritik</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
