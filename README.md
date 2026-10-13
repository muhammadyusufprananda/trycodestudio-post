# Trycode Postmaker

Aplikasi desktop lokal untuk menyiapkan konten Instagram Trycode Studio. UI memakai HTML/CSS/JS yang dibungkus dalam satu jendela Electron; tidak ada server, akun, database server, atau AI.

## Menjalankan mode development

1. Pasang Node.js LTS.
2. Di folder ini, jalankan `npm install` sekali.
3. Jalankan `npm start` untuk membuka app desktop.

## Alur membuat konten

1. Pilih tema project (Edukasi & tips, Promosi & layanan, Portofolio & karya, atau Cerita studio) dan ukuran Feed 1:1, Portrait 4:5, atau Story 9:16.
2. Di canvas project yang kosong, klik **Tambah post**.
3. Pilih peran post (Judul, Isi, atau Penutup / CTA), lalu edit label, judul, isi, dan CTA. Semua teks yang tampil pada desain berasal dari field yang bisa diedit; gambar tambahan bersifat opsional.
4. Simpan. Preview visual langsung tampil sebagai kartu di project; post bisa diedit, diurutkan, atau dihapus.
5. Buka **Ekspor** untuk melihat hasil ukuran penuh dan mengunduh PNG satuan atau ZIP seluruh post.

Project dan gambar disimpan di perangkat. Saat app dibuka lagi, project terakhir bisa dilanjutkan.

## Membuat installer Windows

Jalankan `npm run dist`. Installer NSIS akan dibuat di folder `dist`.
