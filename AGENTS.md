# Catatan kerja untuk agent

## Tujuan aplikasi

Trycode Postmaker adalah aplikasi desktop lokal untuk membantu Trycode Studio membuat aset konten Instagram. Antarmuka berbahasa Indonesia. Aplikasi harus terasa sederhana untuk dipakai dan tidak menggunakan AI, akun online, server, atau layanan backend.

Jaga keputusan produk yang sudah disepakati:

- Pengguna menyusun satu project carousel dari post-post yang terlihat sebagai preview di halaman project.
- Jangan mengembalikan logo ke desain post. Pengguna sebelumnya tidak menyukai penempatan logo dan meminta logo dihilangkan.
- Gunakan tema konten yang sesuai untuk edukasi, promosi, portofolio, atau cerita studio. Tema menentukan palet dan komposisi; jenis post menentukan struktur layout.
- Semua teks yang muncul di dalam desain harus dapat diedit melalui form post.
- Pertahankan alur ekspor PNG per post maupun ZIP seluruh post.

## Cara menjalankan

- `npm start` menjalankan aplikasi Electron dalam mode development.
- `npm run dist` membuat installer Windows.
- Jangan menambahkan atau menjalankan test kecuali diminta pengguna.

## Struktur dan arsitektur

- `main.cjs`: proses utama Electron, membuat jendela aplikasi dan custom protocol `trycode://`. Node integration mati; context isolation dan sandbox aktif. Navigasi eksternal hanya membuka situs Trycode Studio yang diizinkan.
- `index.html`: struktur UI, dialog editor post, dan dialog ekspor.
- `style.css`: tampilan responsif, komponen project, form, dialog, dan kartu preview.
- `app.js`: state aplikasi, penyimpanan lokal, canvas renderer, editor, preview, dan ekspor PNG/ZIP.
- `README.md`: petunjuk penggunaan dan build installer.

Render desain dilakukan lewat `drawPageLayout()` dan `drawPageImage()` di `app.js`. Renderer yang sama dipakai untuk kartu preview, pratinjau ekspor, PNG satuan, dan ZIP. Jika layout diubah, pertahankan hasil yang sama pada semua jalur tersebut.

## Alur aplikasi saat ini

1. Di halaman awal, pengguna memilih tujuan/tema project: **Edukasi & tips**, **Promosi & layanan**, **Portofolio & karya**, atau **Cerita studio**.
2. Pengguna memilih ukuran awal: Feed 1:1, Portrait 4:5, atau Story 9:16.
3. Project dibuka dalam keadaan kosong. Pengguna menambahkan post melalui tombol pada project.
4. Dialog post mengatur jenis post (**Judul**, **Isi**, atau **Penutup / CTA**), label, username sosial, judul, penjelasan, CTA, ukuran teks, dan gambar tambahan.
5. Post yang disimpan muncul sebagai preview di halaman project. Post dapat diedit, diurutkan, dan dihapus.
6. Dropdown ukuran di bagian atas project dapat mengganti ukuran semua post kapan saja.
7. **Ekspor** membuka preview ukuran penuh. Pengguna dapat mengunduh PNG untuk post aktif atau ZIP semua post.

Aplikasi menyimpan satu project terakhir secara lokal. Membuat project baru meminta konfirmasi karena akan menggantikan project yang sedang tersimpan.

## Tema dan layout

Definisi tema ada di `projectThemes` pada `app.js`:

- `education`: permukaan terang, aksen ungu dan teal, layout terstruktur.
- `promotion`: latar gelap, kontras tinggi, aksen ungu dan teal.
- `portfolio`: palet hangat dan komposisi editorial yang memberi ruang untuk karya.
- `studio`: palet terang dan layout fleksibel.

Layout merespons jenis post dan tema. Pertahankan perbedaan hierarki antara halaman judul, isi, dan penutup. Gambar tambahan per post bersifat opsional; posisi, cara crop, dan titik fokusnya dapat diatur.

## Data dan penyimpanan

- Data project dan post disimpan di `localStorage` dengan key `trycode-postmaker`.
- Data gambar disimpan terpisah di IndexedDB `trycode-postmaker-assets`, object store `images`.
- Username sosial dan skala teks disimpan per post. Post baru memakai `trycode_studio` sebagai nilai awal; pengguna dapat mengubah atau mengosongkannya.
- Skala font per post saat ini mencakup label, judul, penjelasan, CTA, dan username sosial dengan rentang 70%–150%.
- Saat mengubah struktur data, pertahankan nilai project lama yang masih dapat dimigrasikan. Normalisasi data post lama dilakukan saat aplikasi memuat state.

## Panduan perubahan

- Hindari menambahkan dependency/library untuk perubahan UI sederhana; app saat ini memakai HTML, CSS, JavaScript, dan Electron.
- Jangan memindahkan username sosial kembali ke pengaturan project. Username sekarang diatur dalam form tiap post.
- Pertahankan ukuran canvas ekspor 1080 px pada sisi pendek: `square` 1080×1080, `portrait` 1080×1350, dan `story` 1080×1920.
- Pertahankan penyimpanan lokal dan dukungan pemuatan project lama.
- Jaga layout tetap terbaca saat teks diperbesar; canvas renderer membatasi baris teks, jadi evaluasi dampak ukuran font terhadap ruang dan CTA.
- Jangan mengubah alur project atau gaya visual secara besar tanpa mengikuti arahan terbaru pengguna.

