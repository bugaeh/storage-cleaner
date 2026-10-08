# ⚡ Storage Audit & De-duplication Engine

Utilitas audit penyimpanan berbasis runtime bawaan **Node.js** (zero-dependency / tanpa perlu `npm install`) yang dirancang untuk memindai, menganalisis, mengelompokkan duplikat berbasis hash SHA-256, mendeteksi file raksasa (> 2 MB), dan membersihkan ruang disk secara aman.

---

## 🛠️ Fitur Utama

1. **Pemindaian Rekursif Mendalam**:
   - Memindai seluruh folder target (`Downloads_Lab`) dan subdirektori secara rekursif.
   - Mengumpulkan metadata file: nama, ukuran (bytes), path relatif, dan waktu modifikasi.
2. **Identifikasi Duplikat Berbasis Kriptografi SHA-256**:
   - Menghitung hash SHA-256 unik setiap file secara efisien menggunakan stream I/O (aman untuk file besar).
   - Mengelompokkan file dengan konten identik meskipun nama dan foldernya berbeda (misal: `modul.pdf`, `modul_BACKUP.pdf`, `modul_copy_final.pdf`).
3. **Deteksi File Raksasa**:
   - Menandai file dengan ukuran melebihi ambang batas **2 MB (2.048 KB)** sebagai **File Raksasa**.
   - Menyajikan daftar file raksasa terurut dari yang terbesar.
4. **Deteksi Sampah Sementara (.tmp)**:
   - Melacak file sampah berakhiran `.tmp` yang tidak terpakai.
5. **UI Terminal Modern & Rapi**:
   - Layout rapi dengan styling warna ANSI, kartu statistik, dan tabel terformat.
   - Menampilkan total file, subdirektori, kapasitas folder, estimasi hemat ruang, dan persentase penghematan.
6. **Pembersihan Interaktif Aman**:
   - Konfirmasi prompt interaktif: `Apakah kamu ingin menghapus file duplikat yang tidak terpakai? (Yes/No)`.
   - Menghapus salinan duplikat dan file `.tmp`, **serta selalu mempertahankan 1 file asli per grup**.

---

## 🚀 Cara Menjalankan

### 1. Jalankan Utilitas Node.js (Utama)
```bash
node storage_audit.js
```
*Atau tentukan path folder target secara manual:*
```bash
node storage_audit.js <path_folder_kustom>
```

### 2. Generate Ulang Folder Uji Coba (`Downloads_Lab`)
Jika ingin menguji coba kembali dengan data tiruan (file duplikat, file raksasa, dan file `.tmp`):
```bash
node create_sample_lab.js
```

### 3. Utilitas Alternatif Python (`storage_audit.py`)
Tersedia versi Python yang dapat dijalankan langsung dengan modul standar Python (`os`, `hashlib`, `sys`) jika lingkungan Python tersedia:
```bash
python storage_audit.py
```
