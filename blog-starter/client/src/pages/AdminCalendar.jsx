import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import './AdminCalendar.css';

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toLocalDateKey(value) {
  const date = value instanceof Date ? value : parseDate(value);
  if (!date) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDate(value, options = {}) {
  const date = value instanceof Date ? value : parseDate(value);
  if (!date) return 'Tarih yok';
  return date.toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric', ...options });
}

function formatTime(value) {
  const date = parseDate(value);
  if (!date) return 'Saat yok';
  return date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

function getPublishState(post, today = startOfToday()) {
  const publishDate = parseDate(post.publishedAt);

  if (post.status === 'draft') return { key: 'draft', label: 'Taslak', tone: 'muted' };
  if (!publishDate) return { key: 'published', label: 'Yayında', tone: 'success' };
  if (publishDate > new Date()) return { key: 'scheduled', label: 'Zamanlandı', tone: 'notice' };
  if (publishDate >= today) return { key: 'today', label: 'Bugün yayında', tone: 'success' };
  return { key: 'published', label: 'Yayında', tone: 'success' };
}

function getPostDate(post) {
  return parseDate(post.publishedAt || post.updatedAt || post.createdAt);
}

function buildWeeks(anchorDate) {
  const start = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1);
  const offset = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - offset);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start.getTime() + index * DAY_MS);
    return {
      date,
      key: toLocalDateKey(date),
      inMonth: date.getMonth() === anchorDate.getMonth()
    };
  });
}

function getEditorLink(post) {
  return `/dashboard?edit=${encodeURIComponent(post.id)}`;
}

function getPlanningWarnings(posts) {
  const now = new Date();
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const nextWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7);
  const scheduled = posts.filter((post) => post.status === 'published' && parseDate(post.publishedAt) > now);
  const drafts = posts.filter((post) => post.status === 'draft');
  const urgentDrafts = drafts.filter((post) => {
    const date = parseDate(post.publishedAt);
    return date && date < nextWeek;
  });
  const soonPosts = scheduled.filter((post) => parseDate(post.publishedAt) < tomorrow);

  const warnings = [];

  if (soonPosts.length) {
    warnings.push({
      level: 'critical',
      title: '24 saat içinde yayınlanacak içerik var',
      text: `${soonPosts.length} yazı çok yakın tarihli. Kapak görseli, özet ve SEO alanlarını son kez kontrol edin.`
    });
  }

  if (urgentDrafts.length) {
    warnings.push({
      level: 'warning',
      title: 'Yakın tarihli taslaklar var',
      text: `${urgentDrafts.length} taslak gelecek 7 gün içinde planlanmış görünüyor. Yayına alınmayacaksa tarihini temizleyin veya ileri taşıyın.`
    });
  }

  if (!scheduled.length) {
    warnings.push({
      level: 'notice',
      title: 'Zamanlanmış yayın kuyruğu boş',
      text: 'Düzenli yayın akışı için en az 2-3 ileri tarihli içerik planlanması önerilir.'
    });
  }

  return warnings;
}

export function AdminCalendar() {
  const [posts, setPosts] = useState([]);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [anchor, setAnchor] = useState(() => startOfToday());

  useEffect(() => {
    async function loadPosts() {
      try {
        const data = await api('/posts?includeDrafts=true');
        setPosts(data.posts || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    }

    loadPosts();
  }, []);

  const today = useMemo(() => startOfToday(), []);
  const todayKey = useMemo(() => toLocalDateKey(today), [today]);
  const calendarDays = useMemo(() => buildWeeks(anchor), [anchor]);
  const planningWarnings = useMemo(() => getPlanningWarnings(posts), [posts]);

  const postsByDate = useMemo(() => {
    return posts.reduce((acc, post) => {
      const date = getPostDate(post);
      if (!date) return acc;
      const key = toLocalDateKey(date);
      if (!acc[key]) acc[key] = [];
      acc[key].push(post);
      return acc;
    }, {});
  }, [posts]);

  const scheduledPosts = useMemo(() => {
    return posts
      .filter((post) => post.status === 'published' && parseDate(post.publishedAt) && parseDate(post.publishedAt) > new Date())
      .sort((a, b) => parseDate(a.publishedAt) - parseDate(b.publishedAt));
  }, [posts]);

  const draftPosts = useMemo(() => {
    return posts
      .filter((post) => post.status === 'draft')
      .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));
  }, [posts]);

  const monthLabel = anchor.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });

  function shiftMonth(amount) {
    setAnchor((current) => new Date(current.getFullYear(), current.getMonth() + amount, 1));
  }

  if (isLoading) return <section className="page stack"><p className="notice">İçerik takvimi hazırlanıyor...</p></section>;

  return (
    <section className="page stack">
      <div>
        <p className="eyebrow">Yayımcı Paneli</p>
        <h1>İçerik Takvimi</h1>
        <p className="notice">Yayınlanmış yazıları, ileri tarihli yayınları ve taslakları tek ekranda izleyin. İleri tarihli yayınlar mevcut backend yapısında “Yayında” durumu + gelecek yayın tarihiyle planlanır.</p>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="stats calendar-stats">
        <div><strong>{posts.length}</strong><span>Toplam içerik</span></div>
        <div><strong>{scheduledPosts.length}</strong><span>Zamanlandı</span></div>
        <div><strong>{draftPosts.length}</strong><span>Taslak</span></div>
        <div><strong>{posts.filter((post) => getPublishState(post, today).key === 'today').length}</strong><span>Bugün yayında</span></div>
      </div>

      <div className="panel planning-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Yayın Planlama</p>
            <h2>Planlama uyarıları</h2>
          </div>
          <Link className="button-link" to="/dashboard/quality">Kalite kontrolüne git</Link>
        </div>
        <div className="planning-warnings">
          {planningWarnings.map((warning) => (
            <article className={`planning-warning planning-${warning.level}`} key={warning.title}>
              <strong>{warning.title}</strong>
              <p>{warning.text}</p>
            </article>
          ))}
          {!planningWarnings.length && <p className="success">Yayın takvimi dengeli görünüyor.</p>}
        </div>
      </div>

      <div className="panel calendar-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Takvim</p>
            <h2>{monthLabel}</h2>
          </div>
          <div className="actions">
            <button type="button" onClick={() => shiftMonth(-1)}>Önceki</button>
            <button type="button" onClick={() => setAnchor(startOfToday())}>Bugün</button>
            <button type="button" onClick={() => shiftMonth(1)}>Sonraki</button>
          </div>
        </div>

        <div className="calendar-weekdays" aria-hidden="true">
          {['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'].map((day) => <span key={day}>{day}</span>)}
        </div>

        <div className="calendar-grid">
          {calendarDays.map((day) => {
            const dayPosts = postsByDate[day.key] || [];
            const isToday = day.key === todayKey;
            return (
              <article className={`calendar-day${day.inMonth ? '' : ' is-outside'}${isToday ? ' is-today' : ''}`} key={day.key}>
                <div className="calendar-day-head">
                  <strong>{day.date.getDate()}</strong>
                  {isToday && <span>Bugün</span>}
                </div>
                <div className="calendar-items">
                  {dayPosts.slice(0, 3).map((post) => {
                    const state = getPublishState(post, today);
                    return (
                      <Link className={`calendar-item tone-${state.tone}`} key={post.id} title={`${post.title} yazısını düzenle`} to={getEditorLink(post)}>
                        <span>{state.label}</span>
                        <strong>{post.title}</strong>
                      </Link>
                    );
                  })}
                  {dayPosts.length > 3 && <span className="calendar-more">+{dayPosts.length - 3} içerik</span>}
                </div>
              </article>
            );
          })}
        </div>
      </div>

      <div className="calendar-columns">
        <div className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Sıradaki Yayınlar</p>
              <h2>Zamanlanmış yazılar</h2>
            </div>
            <Link className="button-link" to="/dashboard">Yeni yazı planla</Link>
          </div>
          <div className="table-list">
            {scheduledPosts.slice(0, 12).map((post) => (
              <Link className="table-row" key={post.id} to={getEditorLink(post)}>
                <div>
                  <strong>{post.title}</strong>
                  <span>{formatDate(post.publishedAt)} · {formatTime(post.publishedAt)} · {post.category || 'Genel'}</span>
                </div>
              </Link>
            ))}
            {!scheduledPosts.length && <p className="notice">Henüz ileri tarihli yayın yok. Panelde durum “Yayında” seçilip gelecek bir yayın tarihi girildiğinde burada görünür.</p>}
          </div>
        </div>

        <div className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Hazırlık Kuyruğu</p>
              <h2>Taslaklar</h2>
            </div>
            <span className="result-count">{draftPosts.length} taslak</span>
          </div>
          <div className="table-list">
            {draftPosts.slice(0, 12).map((post) => (
              <Link className="table-row" key={post.id} to={getEditorLink(post)}>
                <div>
                  <strong>{post.title}</strong>
                  <span>Son güncelleme: {formatDate(post.updatedAt || post.createdAt)} · {post.category || 'Genel'}</span>
                </div>
              </Link>
            ))}
            {!draftPosts.length && <p className="notice">Taslak kuyruğu boş.</p>}
          </div>
        </div>
      </div>
    </section>
  );
}
