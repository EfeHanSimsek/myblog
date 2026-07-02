import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DashboardOverview } from '../components/DashboardOverview';
import { api } from '../lib/api';

const emptyForm = {
  id: null,
  title: '',
  slug: '',
  summary: '',
  seoTitle: '',
  seoDescription: '',
  content: '',
  coverImage: '',
  altCoverImage: '',
  category: 'Genel',
  tags: '',
  status: 'draft',
  publishedAt: ''
};

const emptyMediaForm = {
  id: null,
  title: '',
  url: '',
  altText: '',
  caption: '',
  credit: '',
  type: 'image',
  tags: '',
  width: '',
  height: '',
  sizeLabel: ''
};

function createSlug(value) {
  return value
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function toDatetimeLocal(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('tr-TR', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
}

function getPlanningWarning(form) {
  if (!form.publishedAt) {
    if (form.status === 'published') {
      return {
        type: 'notice',
        title: 'Anında yayın',
        text: 'Yayın tarihi boş bırakılırsa kayıt sırasında sunucu bu yazıyı hemen yayına alır.'
      };
    }

    return {
      type: 'muted',
      title: 'Taslak kuyruğu',
      text: 'Yayın tarihi olmayan taslaklar takvimde plansız içerik olarak kalır.'
    };
  }

  const selectedDate = new Date(form.publishedAt);
  if (Number.isNaN(selectedDate.getTime())) {
    return {
      type: 'critical',
      title: 'Geçersiz tarih',
      text: 'Yayın tarihi okunamıyor. Kaydetmeden önce tarih alanını temizle veya yeniden seç.'
    };
  }

  const isFuture = selectedDate.getTime() > Date.now();
  const readableDate = formatDateTime(selectedDate);

  if (form.status === 'published' && isFuture) {
    return {
      type: 'warning',
      title: 'Zamanlanmış yayın',
      text: `Bu yazı ${readableDate} için planlanmış yayın olarak kaydedilecek.`
    };
  }

  if (form.status === 'published') {
    return {
      type: 'notice',
      title: 'Yayında görünecek',
      text: `Bu yazı ${readableDate} tarihiyle yayında görünecek.`
    };
  }

  if (isFuture) {
    return {
      type: 'warning',
      title: 'Tarihli taslak',
      text: `Bu içerik taslak kalacak, ama takvimde ${readableDate} tarihli plan olarak görünecek.`
    };
  }

  return {
    type: 'muted',
    title: 'Geçmiş tarihli taslak',
    text: `Taslak geçmiş bir tarih taşıyor: ${readableDate}. Yayına almadan önce tarihi kontrol et.`
  };
}

function getEditorSeoChecklist(form) {
  const titleLength = form.title.trim().length;
  const slugLength = form.slug.trim().length;
  const summaryLength = form.summary.trim().length;
  const seoTitleLength = form.seoTitle.trim().length;
  const seoDescriptionLength = form.seoDescription.trim().length;
  const wordCount = form.content.trim().split(/\s+/).filter(Boolean).length;
  const tagCount = form.tags.split(',').map((tag) => tag.trim()).filter(Boolean).length;

  return [
    {
      key: 'title',
      field: 'title',
      ok: titleLength >= 20 && titleLength <= 80,
      label: 'Başlık uzunluğu',
      detail: `${titleLength} karakter — ideal aralık 20-80.`
    },
    {
      key: 'slug',
      field: 'slug',
      ok: slugLength > 0 && slugLength <= 80,
      label: 'SEO slug',
      detail: slugLength ? `${slugLength} karakterlik slug hazır.` : 'Slug boşsa başlıktan otomatik üretilecek.'
    },
    {
      key: 'summary',
      field: 'summary',
      ok: summaryLength >= 60,
      label: 'Yazı özeti',
      detail: `${summaryLength} karakter — listeleme ve paylaşım için en az 60 önerilir.`
    },
    {
      key: 'seo-title',
      field: 'seoTitle',
      ok: seoTitleLength >= 30 && seoTitleLength <= 70,
      label: 'SEO başlığı',
      detail: `${seoTitleLength}/70 karakter — ideal aralık 30-70.`
    },
    {
      key: 'seo-description',
      field: 'seoDescription',
      ok: seoDescriptionLength >= 90 && seoDescriptionLength <= 160,
      label: 'SEO açıklaması',
      detail: `${seoDescriptionLength}/160 karakter — ideal aralık 90-160.`
    },
    {
      key: 'cover-alt',
      field: 'altCoverImage',
      ok: !form.coverImage || form.altCoverImage.trim().length >= 8,
      label: 'Kapak alt metni',
      detail: form.coverImage ? 'Kapak görseli varsa açıklayıcı alt metin gerekli.' : 'Kapak görseli eklenirse alt metin de doldur.'
    },
    {
      key: 'tags',
      field: 'tags',
      ok: tagCount >= 2,
      label: 'Etiket sayısı',
      detail: `${tagCount} etiket — keşif için en az 2 etiket önerilir.`
    },
    {
      key: 'content',
      field: 'content',
      ok: wordCount >= 300,
      label: 'İçerik uzunluğu',
      detail: `${wordCount} kelime — kalıcı blog yazıları için en az 300 önerilir.`
    }
  ];
}

function downloadJson(filename, value) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function Dashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [posts, setPosts] = useState([]);
  const [stats, setStats] = useState(null);
  const [comments, setComments] = useState([]);
  const [media, setMedia] = useState([]);
  const [mediaTypes, setMediaTypes] = useState(['image', 'video', 'document', 'audio', 'other']);
  const [commentFilter, setCommentFilter] = useState('pending');
  const [form, setForm] = useState(emptyForm);
  const [mediaForm, setMediaForm] = useState(emptyMediaForm);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [mediaQuery, setMediaQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [mediaTypeFilter, setMediaTypeFilter] = useState('all');
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingMedia, setIsSavingMedia] = useState(false);
  const [isExportingBackup, setIsExportingBackup] = useState(false);
  const [seoRepairMode, setSeoRepairMode] = useState(false);

  async function load() {
    const [postData, statData, commentData, mediaData] = await Promise.all([
      api('/posts?includeDrafts=true'),
      api('/posts/stats/summary'),
      api('/posts/comments/moderation'),
      api('/media')
    ]);
    setPosts(postData.posts);
    setStats(statData);
    setComments(commentData.comments || []);
    setMedia(mediaData.media || []);
    setMediaTypes(mediaData.types || mediaTypes);
  }

  useEffect(() => { load().catch((err) => setError(err.message)); }, []);

  useEffect(() => {
    const editId = searchParams.get('edit');
    if (!editId || !posts.length) return;

    const focusMode = searchParams.get('focus');
    const targetPost = posts.find((post) => String(post.id) === editId);
    if (!targetPost) {
      setError('Seçilen yazı bulunamadı.');
      setSearchParams({}, { replace: true });
      return;
    }

    edit(targetPost);
    setSeoRepairMode(focusMode === 'seo');
    setMessage(focusMode === 'seo' ? 'SEO Onarım panelinden seçilen yazı editöre yüklendi. Eksik kontroller aşağıda vurgulandı.' : 'Takvimden seçilen yazı editöre yüklendi.');
    setSearchParams({}, { replace: true });
  }, [posts, searchParams, setSearchParams]);

  const categories = useMemo(() => {
    return [...new Set(posts.map((post) => post.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'tr'));
  }, [posts]);

  const filteredPosts = useMemo(() => {
    const searchValue = query.trim().toLocaleLowerCase('tr-TR');

    return posts.filter((post) => {
      const matchesStatus = statusFilter === 'all' || post.status === statusFilter;
      const matchesCategory = categoryFilter === 'all' || post.category === categoryFilter;
      const haystack = [post.title, post.summary, post.seoTitle, post.seoDescription, post.category, ...(post.tags || [])].join(' ').toLocaleLowerCase('tr-TR');
      const matchesQuery = !searchValue || haystack.includes(searchValue);
      return matchesStatus && matchesCategory && matchesQuery;
    });
  }, [posts, query, statusFilter, categoryFilter]);

  const filteredComments = useMemo(() => {
    return comments.filter((comment) => commentFilter === 'all' || comment.status === commentFilter);
  }, [comments, commentFilter]);

  const filteredMedia = useMemo(() => {
    const searchValue = mediaQuery.trim().toLocaleLowerCase('tr-TR');
    return media.filter((item) => {
      const matchesType = mediaTypeFilter === 'all' || item.type === mediaTypeFilter;
      const haystack = [item.title, item.altText, item.caption, item.credit, ...(item.tags || [])].join(' ').toLocaleLowerCase('tr-TR');
      return matchesType && (!searchValue || haystack.includes(searchValue));
    });
  }, [media, mediaQuery, mediaTypeFilter]);

  const planningWarning = useMemo(() => getPlanningWarning(form), [form]);
  const editorSeoChecklist = useMemo(() => getEditorSeoChecklist(form), [form]);
  const editorSeoReadyCount = editorSeoChecklist.filter((item) => item.ok).length;
  const editorSeoMissing = editorSeoChecklist.filter((item) => !item.ok);

  function setField(name, value) {
    setForm((current) => {
      if (name === 'title') {
        const next = { ...current, title: value };
        if (!current.slug || current.slug === createSlug(current.title)) next.slug = createSlug(value);
        if (!current.seoTitle || current.seoTitle === current.title.slice(0, 70)) next.seoTitle = value.slice(0, 70);
        if (!current.altCoverImage || current.altCoverImage === current.title) next.altCoverImage = value;
        return next;
      }
      if (name === 'summary' && (!current.seoDescription || current.seoDescription === current.summary.slice(0, 160))) {
        return { ...current, summary: value, seoDescription: value.slice(0, 160) };
      }
      return { ...current, [name]: value };
    });
  }

  function setMediaField(name, value) {
    setMediaForm((current) => {
      if (name === 'title' && (!current.altText || current.altText === current.title)) return { ...current, title: value, altText: value };
      return { ...current, [name]: value };
    });
  }

  function focusSeoField(field) {
    const target = document.querySelector(`[data-seo-field="${field}"]`);
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    target.focus({ preventScroll: true });
  }

  function useMediaAsCover(item) {
    if (item.type !== 'image') return;
    setForm((current) => ({ ...current, coverImage: item.url, altCoverImage: item.altText || item.title || current.altCoverImage }));
    setMessage('Medya kapak görseli olarak seçildi.');
  }

  function edit(post) {
    setForm({
      ...emptyForm,
      ...post,
      seoTitle: post.seoTitle || '',
      seoDescription: post.seoDescription || '',
      altCoverImage: post.altCoverImage || '',
      publishedAt: toDatetimeLocal(post.publishedAt),
      tags: post.tags?.join(', ') || ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function editMedia(item) {
    setMediaForm({ ...emptyMediaForm, ...item, tags: item.tags?.join(', ') || '' });
  }

  async function exportBackup() {
    setError('');
    setMessage('');
    setIsExportingBackup(true);

    try {
      const data = await api('/backup/export');
      const backup = data.backup || data;
      const exportedDate = backup.exportedAt ? backup.exportedAt.slice(0, 10) : new Date().toISOString().slice(0, 10);
      downloadJson(`novablog-backup-${exportedDate}.json`, backup);
      setMessage('Yedek dosyası indirildi.');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsExportingBackup(false);
    }
  }

  async function submit(event) {
    event.preventDefault();
    setError('');
    setMessage('');

    if (form.publishedAt && Number.isNaN(new Date(form.publishedAt).getTime())) {
      setError('Yayın tarihi geçersiz. Lütfen tarihi temizle veya yeniden seç.');
      return;
    }

    setIsSaving(true);

    const payload = {
      ...form,
      slug: form.slug || createSlug(form.title),
      publishedAt: form.publishedAt ? new Date(form.publishedAt).toISOString() : '',
      tags: form.tags.split(',').map((tag) => tag.trim()).filter(Boolean)
    };

    try {
      if (form.id) {
        await api(`/posts/${form.id}`, { method: 'PUT', body: JSON.stringify(payload) });
        setMessage('Yazı güncellendi.');
      } else {
        await api('/posts', { method: 'POST', body: JSON.stringify(payload) });
        setMessage('Yazı oluşturuldu.');
      }
      setForm(emptyForm);
      setSeoRepairMode(false);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  }

  async function submitMedia(event) {
    event.preventDefault();
    setError('');
    setMessage('');
    setIsSavingMedia(true);
    const payload = { ...mediaForm, tags: mediaForm.tags.split(',').map((tag) => tag.trim()).filter(Boolean) };

    try {
      if (mediaForm.id) {
        await api(`/media/${mediaForm.id}`, { method: 'PUT', body: JSON.stringify(payload) });
        setMessage('Medya kaydı güncellendi.');
      } else {
        await api('/media', { method: 'POST', body: JSON.stringify(payload) });
        setMessage('Medya kaydı oluşturuldu.');
      }
      setMediaForm(emptyMediaForm);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSavingMedia(false);
    }
  }

  async function remove(id) {
    if (!confirm('Bu yazı silinsin mi?')) return;
    try {
      await api(`/posts/${id}`, { method: 'DELETE' });
      setMessage('Yazı silindi.');
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function removeMedia(id) {
    if (!confirm('Bu medya kaydı silinsin mi? Dosyanın kendisi silinmez, sadece kütüphane kaydı kaldırılır.')) return;
    try {
      await api(`/media/${id}`, { method: 'DELETE' });
      setMessage('Medya kaydı silindi.');
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function updateCommentStatus(id, status) {
    try {
      await api(`/posts/comments/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
      setMessage('Yorum durumu güncellendi.');
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function deleteComment(id) {
    if (!confirm('Bu yorum silinsin mi?')) return;
    try {
      await api(`/posts/comments/${id}`, { method: 'DELETE' });
      setMessage('Yorum silindi.');
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="page dashboard stack">
      <div>
        <p className="eyebrow">Yayımcı Paneli</p>
        <h1>İçerik Yönetimi</h1>
      </div>

      {stats && (
        <div className="stats">
          <div><strong>{stats.totalPosts}</strong><span>Toplam yazı</span></div>
          <div><strong>{stats.publishedPosts}</strong><span>Yayında</span></div>
          <div><strong>{stats.draftPosts}</strong><span>Taslak</span></div>
          <div><strong>{stats.scheduledPosts || 0}</strong><span>Zamanlandı</span></div>
          <div><strong>{stats.totalViews}</strong><span>Görüntülenme</span></div>
          <div><strong>{stats.totalComments || 0}</strong><span>Yorum</span></div>
          <div><strong>{stats.pendingComments || 0}</strong><span>Bekleyen yorum</span></div>
          <div><strong>{stats.approvedComments || 0}</strong><span>Onaylı yorum</span></div>
        </div>
      )}

      <DashboardOverview posts={posts} />

      <div className="panel backup-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Yedekleme</p>
            <h2>Veri Yedeği</h2>
          </div>
          <button type="button" onClick={exportBackup} disabled={isExportingBackup}>
            {isExportingBackup ? 'Hazırlanıyor...' : 'JSON Yedeği İndir'}
          </button>
        </div>
        <p className="notice">Yazılar, kullanıcılar, yorumlar, medya kayıtları ve ayarlar tek bir JSON dosyası olarak dışa aktarılır.</p>
      </div>

      <form className={`panel editor ${seoRepairMode ? 'seo-repair-editor' : ''}`} onSubmit={submit}>
        <div className="section-heading">
          <div>
            <p className="eyebrow">Editör</p>
            <h2>{form.id ? 'Yazıyı Düzenle' : 'Yeni Yazı'}</h2>
          </div>
          {form.slug && <span className="slug-preview">/{form.slug}</span>}
        </div>
        {seoRepairMode && (
          <div className="seo-repair-callout">
            <strong>SEO onarım modu açık</strong>
            <span>{editorSeoMissing.length ? `${editorSeoMissing.length} eksik kontrol var. Eksik kartlardaki “Alana git” butonu ilgili inputu açar.` : 'Bu yazı temel SEO kontrollerini tamamladı.'}</span>
          </div>
        )}
        <div className="form-grid">
          <label>Başlık<input data-seo-field="title" value={form.title} onChange={(e) => setField('title', e.target.value)} required /></label>
          <label>Slug<input data-seo-field="slug" value={form.slug} onChange={(e) => setField('slug', createSlug(e.target.value))} placeholder="Boşsa otomatik üretilir" /></label>
          <label>Kategori<input value={form.category} onChange={(e) => setField('category', e.target.value)} /></label>
          <label>Durum<select value={form.status} onChange={(e) => setField('status', e.target.value)}><option value="draft">Taslak</option><option value="published">Yayında</option></select></label>
        </div>
        <label>SEO Başlığı<input data-seo-field="seoTitle" value={form.seoTitle} onChange={(e) => setField('seoTitle', e.target.value.slice(0, 70))} maxLength="70" placeholder="Arama motorlarında görünecek başlık" /><span className="field-hint">{form.seoTitle.length}/70 karakter</span></label>
        <label>SEO Açıklaması<textarea data-seo-field="seoDescription" value={form.seoDescription} onChange={(e) => setField('seoDescription', e.target.value.slice(0, 160))} rows="2" maxLength="160" placeholder="Arama motorlarında görünecek açıklama" /><span className="field-hint">{form.seoDescription.length}/160 karakter</span></label>
        <label>Yayın Tarihi<input type="datetime-local" value={form.publishedAt} onChange={(e) => setField('publishedAt', e.target.value)} /><span className="field-hint">Boş bırakılırsa yayın sırasında otomatik atanır.</span></label>
        {planningWarning && <div className={`planning-hint planning-${planningWarning.type}`}><strong>{planningWarning.title}</strong><span>{planningWarning.text}</span></div>}
        <div className="seo-checklist">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Canlı SEO Checklist</p>
              <h3>{editorSeoReadyCount} / {editorSeoChecklist.length} kontrol hazır</h3>
            </div>
            <span className="quality-score">{Math.round((editorSeoReadyCount / editorSeoChecklist.length) * 100)}%</span>
          </div>
          <div className="seo-checklist-grid">
            {editorSeoChecklist.map((item) => (
              <div className={`seo-check-item ${item.ok ? 'seo-check-ok' : 'seo-check-missing'}`} key={item.key}>
                <strong>{item.ok ? 'Hazır' : 'Eksik'} · {item.label}</strong>
                <span>{item.detail}</span>
                {!item.ok && <button className="mini-action" type="button" onClick={() => focusSeoField(item.field)}>Alana git</button>}
              </div>
            ))}
          </div>
        </div>
        <label>Özet<textarea data-seo-field="summary" value={form.summary} onChange={(e) => setField('summary', e.target.value)} rows="2" /></label>
        <label>Kapak görseli URL<input value={form.coverImage} onChange={(e) => setField('coverImage', e.target.value)} /></label>
        <label>Kapak görseli alt metni<input data-seo-field="altCoverImage" value={form.altCoverImage} onChange={(e) => setField('altCoverImage', e.target.value)} placeholder="Görsel erişilebilirlik açıklaması" /></label>
        {media.some((item) => item.type === 'image') && <div className="media-picker"><strong>Medya kütüphanesinden kapak seç</strong><div className="media-strip">{media.filter((item) => item.type === 'image').slice(0, 8).map((item) => <button type="button" className="media-thumb" key={item.id} onClick={() => useMediaAsCover(item)}><img src={item.url} alt={item.altText || item.title} /><span>{item.title}</span></button>)}</div></div>}
        <label>Etiketler<input data-seo-field="tags" value={form.tags} onChange={(e) => setField('tags', e.target.value)} placeholder="react, blog, cms" /></label>
        <label>İçerik<textarea data-seo-field="content" value={form.content} onChange={(e) => setField('content', e.target.value)} rows="10" required /></label>
        {message && <p className="success">{message}</p>}
        {error && <p className="error">{error}</p>}
        <div className="actions"><button disabled={isSaving}>{isSaving ? 'Kaydediliyor...' : form.id ? 'Güncelle' : 'Oluştur'}</button><button type="button" onClick={() => { setForm(emptyForm); setSeoRepairMode(false); }}>Temizle</button></div>
      </form>

      <div className="panel media-library">
        <div className="section-heading"><div><p className="eyebrow">Medya Kütüphanesi</p><h2>Medya URL ve Metadata</h2></div><span className="result-count">{filteredMedia.length} / {media.length} medya</span></div>
        <form className="media-form" onSubmit={submitMedia}>
          <div className="form-grid"><label>Başlık<input value={mediaForm.title} onChange={(e) => setMediaField('title', e.target.value)} required /></label><label>Tip<select value={mediaForm.type} onChange={(e) => setMediaField('type', e.target.value)}>{mediaTypes.map((type) => <option key={type} value={type}>{type}</option>)}</select></label></div>
          <label>Medya URL<input value={mediaForm.url} onChange={(e) => setMediaField('url', e.target.value)} placeholder="https://..." required /></label>
          <div className="form-grid"><label>Alt metin<input value={mediaForm.altText} onChange={(e) => setMediaField('altText', e.target.value)} /></label><label>Kredi/Kaynak<input value={mediaForm.credit} onChange={(e) => setMediaField('credit', e.target.value)} /></label></div>
          <label>Açıklama<textarea value={mediaForm.caption} onChange={(e) => setMediaField('caption', e.target.value)} rows="2" /></label>
          <div className="form-grid"><label>Etiketler<input value={mediaForm.tags} onChange={(e) => setMediaField('tags', e.target.value)} placeholder="kapak, ürün, ekip" /></label><label>Boyut etiketi<input value={mediaForm.sizeLabel} onChange={(e) => setMediaField('sizeLabel', e.target.value)} placeholder="1200×800, 450 KB" /></label></div>
          <div className="actions"><button disabled={isSavingMedia}>{isSavingMedia ? 'Kaydediliyor...' : mediaForm.id ? 'Medyayı Güncelle' : 'Medya Ekle'}</button><button type="button" onClick={() => setMediaForm(emptyMediaForm)}>Temizle</button></div>
        </form>
        <div className="toolbar"><label>Medya arama<input value={mediaQuery} onChange={(e) => setMediaQuery(e.target.value)} placeholder="Başlık, alt metin, kaynak, etiket ara" /></label><label>Tip<select value={mediaTypeFilter} onChange={(e) => setMediaTypeFilter(e.target.value)}><option value="all">Tüm tipler</option>{mediaTypes.map((type) => <option key={type} value={type}>{type}</option>)}</select></label></div>
        <div className="media-grid">{filteredMedia.map((item) => <article className="media-card" key={item.id}>{item.type === 'image' ? <img src={item.url} alt={item.altText || item.title} /> : <div className="media-file">{item.type}</div>}<div><strong>{item.title}</strong><span>{item.type} · {item.credit || 'kaynak yok'}{item.sizeLabel ? ` · ${item.sizeLabel}` : ''}</span><p>{item.caption || item.altText || item.url}</p><div className="tag-row">{item.tags?.map((tag) => <span key={tag}>#{tag}</span>)}</div></div><div className="actions"><button type="button" onClick={() => useMediaAsCover(item)} disabled={item.type !== 'image'}>Kapak Yap</button><button type="button" onClick={() => editMedia(item)}>Düzenle</button><button type="button" onClick={() => removeMedia(item.id)}>Sil</button></div></article>)}{!filteredMedia.length && <p className="notice">Bu filtrelerle eşleşen medya yok.</p>}</div>
      </div>

      <div className="panel">
        <div className="section-heading">
          <div><p className="eyebrow">Arşiv</p><h2>Yazılar</h2></div>
          <span className="result-count">{filteredPosts.length} / {posts.length} sonuç</span>
        </div>
        <div className="toolbar">
          <label>Arama<input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Başlık, özet, etiket ara" /></label>
          <label>Durum<select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="all">Tümü</option><option value="published">Yayında</option><option value="draft">Taslak</option></select></label>
          <label>Kategori<select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}><option value="all">Tüm kategoriler</option>{categories.map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
        </div>
        <div className="table-list">{filteredPosts.map((post) => <div className="table-row" key={post.id}><div><strong>{post.title}</strong><span>{post.category} · {post.status} · {post.readingTime} dk · {post.views || 0} görüntülenme</span></div><div className="actions"><button onClick={() => edit(post)}>Düzenle</button><button onClick={() => remove(post.id)}>Sil</button></div></div>)}{!filteredPosts.length && <p className="notice">Bu filtrelerle eşleşen yazı bulunamadı.</p>}</div>
      </div>

      <div className="panel">
        <div className="section-heading">
          <div><p className="eyebrow">Moderasyon</p><h2>Yorumlar</h2></div>
          <select className="compact-filter" value={commentFilter} onChange={(e) => setCommentFilter(e.target.value)}><option value="pending">Bekleyen</option><option value="approved">Onaylı</option><option value="rejected">Reddedilen</option><option value="all">Tümü</option></select>
        </div>
        <div className="comment-list moderation-list">{filteredComments.map((comment) => <article className="comment-card" key={comment.id}><div><strong>{comment.name}</strong><span>{comment.postTitle} · {comment.status} · {new Date(comment.createdAt).toLocaleDateString('tr-TR')}</span></div><p>{comment.content}</p><div className="actions"><button onClick={() => updateCommentStatus(comment.id, 'approved')}>Onayla</button><button onClick={() => updateCommentStatus(comment.id, 'pending')}>Beklet</button><button onClick={() => updateCommentStatus(comment.id, 'rejected')}>Reddet</button><button onClick={() => deleteComment(comment.id)}>Sil</button></div></article>)}{!filteredComments.length && <p className="notice">Bu durumda yorum yok.</p>}</div>
      </div>
    </section>
  );
}
