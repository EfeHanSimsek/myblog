# Blog Starter - Custom Backend

Supabase kullanmadan hazırlanmış başlangıç blog projesi.

## Özellikler

- Express.js custom backend
- JSON dosya tabanlı başlangıç veritabanı
- JWT tabanlı yayımcı/admin girişi
- Blog yazısı listeleme, detay, oluşturma, güncelleme, silme
- Taslak/yayında durumu
- Kategori, etiket, kapak görseli, özet, okuma süresi
- React + Vite frontend
- Blog ana sayfası, yazı detay sayfası, giriş ekranı, yayımcı paneli
- Basit SEO meta güncelleme

## Kurulum

```bash
npm run install:all
```

## Geliştirme

```bash
npm run dev
```

Frontend: http://localhost:5173  
Backend: http://localhost:4000

## Demo Giriş

E-posta: `admin@blog.local`  
Şifre: `Admin123!`

## Üretim Build

```bash
npm run build
npm run start
```

## Not

Bu ilk sürüm dosya tabanlı JSON storage kullanır. Sonraki geliştirme turlarında SQLite/PostgreSQL adaptörü, yorum sistemi, medya kütüphanesi, gelişmiş editor, analytics ve rol bazlı yetki sistemi eklenebilir.
