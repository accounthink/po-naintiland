# Dashboard Pengajuan PO — Naintiland

Aplikasi web pengajuan Purchase Order dengan persetujuan bertingkat. Tiap orang masuk dengan akunnya sendiri (email + kata sandi), menyetujui PO sesuai jabatannya, dan hasilnya langsung terlihat oleh Purchasing. PO yang sudah disetujui bisa diunduh sebagai PDF di atas kop surat perusahaan.

Halaman disajikan lewat GitHub Pages. Login dan data bersama memakai Firebase (paket gratis "Spark" cukup untuk tim kecil).

## Isi folder

| File | Fungsi |
| --- | --- |
| `index.html` | Tampilan halaman |
| `app.js` | Logika aplikasi |
| `kop.js` | Gambar kop surat untuk latar PDF (sementara: kop sederhana; bisa diganti kop resmi) |
| `firebase-config.js` | **Anda isi** dengan konfigurasi proyek Firebase |
| `firestore.rules` | Aturan keamanan data, ditempel ke Firebase |

## Mencoba tanpa Firebase

Buka `index.html?demo`. Semua fitur jalan, tetapi data hanya tersimpan sementara di tab itu dan tidak ada login. Ganti jabatan Anda di menu Pengaturan untuk mencoba tiap peran.

## Pemasangan

### 1. Buat proyek Firebase
Buka https://console.firebase.google.com → **Add project** → beri nama (mis. `po-naintiland`). Google Analytics boleh dimatikan.

### 2. Aktifkan login email
Menu **Build → Authentication → Get started → Sign-in method → Email/Password → Enable → Save**.

### 3. Buat database
Menu **Build → Firestore Database → Create database** → pilih lokasi `asia-southeast2 (Jakarta)` → **Start in production mode**.

Lalu buka tab **Rules**, hapus isinya, tempel seluruh isi file `firestore.rules`, klik **Publish**.

### 4. Ambil konfigurasi web
**Project settings (ikon roda gigi) → General → Your apps → ikon `</>` (Web)** → beri nama → **Register app**. Salin nilai `firebaseConfig` yang muncul ke `firebase-config.js`, menggantikan semua `ISI_DI_SINI`.

Nilai ini bukan rahasia dan aman berada di repositori publik; yang menjaga data adalah `firestore.rules`.

### 5. Unggah ke GitHub dan aktifkan Pages
Buat repositori, unggah semua file di folder ini, lalu **Settings → Pages → Source: Deploy from a branch → Branch: `main` / `(root)` → Save**. Alamatnya menjadi `https://NAMA-ANDA.github.io/NAMA-REPO/`.

### 6. Izinkan domain GitHub di Firebase
**Authentication → Settings → Authorized domains → Add domain** → isi `NAMA-ANDA.github.io`.

### 7. Daftar sebagai admin
Buka alamat Pages, klik **Belum punya akun? Daftar**. **Orang pertama yang mendaftar otomatis menjadi admin**, jadi lakukan ini sebelum membagikan alamatnya. Setelah masuk, buka **Pengaturan** dan tetapkan jabatan Anda sendiri.

### 8. Undang tim
Bagikan alamatnya. Tiap orang mendaftar sendiri, lalu admin menetapkan jabatannya di **Pengaturan → Jabatan pengguna**. Sebelum jabatannya ditetapkan, pengguna hanya bisa melihat.

## Cara kerja

- **Purchasing** mengisi form pengajuan, bisa menyimpan draft, mengedit, dan menghapus selama PO belum disetujui penuh.
- **Aturan nominal** (menu Pengaturan) menentukan, untuk tiap rentang total PO, jabatan mana yang **Menyetujui**, mana yang hanya **Mengetahui**, dan mana yang tidak terlibat.
  - Jabatan Menyetujui menekan **Setujui** secara berurutan sesuai urutan jabatan. Setelah yang terakhir menyetujui, PO berstatus Disetujui dan tombol **Unduh PO** muncul.
  - Jabatan Mengetahui wajib menekan **Mengetahui** (boleh sebelum atau sesudah penyetuju); sampai itu dilakukan, PO berstatus "Menunggu diketahui …" dan belum bisa diunduh. Kolom Mengetahui dilewati bila orangnya sama dengan penyetuju.
  - Bawaan: sampai Rp 5.000.000 disetujui Accounting; di atas itu sampai Rp 15.000.000 SPV Proyek; sampai Rp 25.000.000 Branch Manager; sampai Rp 99.000.000 General Manager; di atasnya Direktur. Tiap PO cukup disetujui satu jabatan yang berwenang. Ubah sesuai kebutuhan.
- **Rekap Pembelian**: daftar barang dari PO yang sudah disetujui pada bulan yang dipilih, dipisah antara Material dan Inventaris (dipilih Purchasing di form lewat "Jenis pembelian"), lengkap dengan total dan unduhan Excel (.xlsx) yang sudah terformat.
- **Rekening supplier**: bank, nomor rekening, dan atas nama diisi Purchasing di form, tercetak otomatis di PDF PO, dan terisi sendiri saat supplier yang sama dipakai lagi.
- **Vendor**: kolom opsional di form, terpisah dari Supplier, tercetak di PDF PO; nama yang pernah dipakai muncul sebagai saran.
- **Ongkos kirim**: diisi di form di bawah PPN, ikut masuk ke TOTAL (dan karenanya ke rentang wewenang), tercetak di PDF dan rekap.
- **Profil** (klik nama di kanan atas): nama dan tanda tangan yang tercetak di PO.
- Perubahan pengaturan berlaku untuk PO yang diajukan setelahnya; PO yang sedang berjalan mengikuti alur saat diajukan.

## Batasan yang perlu diketahui

- Siapa pun yang tahu alamatnya bisa mendaftar akun, tetapi tanpa jabatan dari admin ia hanya bisa melihat daftar PO. Bila daftar PO pun tidak boleh terlihat orang luar, matikan pendaftaran mandiri di Firebase (Authentication → Settings → User actions) setelah semua anggota tim terdaftar.
- Admin hanya satu (awalnya pendaftar pertama). Admin bisa memindahkannya ke pengguna lain lewat tombol **Jadikan admin** di Pengaturan → Jabatan pengguna. Admin tetap bisa memegang jabatan, misalnya Accounting.
- Tidak ada notifikasi email; penyetuju melihat PO yang menunggu saat membuka halaman (angka merah di menu Persetujuan).
- Nomor PO dibuat dari nomor terakhir di bulan yang sama. Bila dua Purchasing mengajukan pada detik yang sama, nomornya bisa kembar.
