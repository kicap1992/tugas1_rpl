# Aplikasi Data Penelitian Dosen

Aplikasi ini adalah tugas kelompok untuk mata kuliah Rekayasa Perangkat Lunak (RPL). Aplikasi ini berfungsi untuk mendata penelitian dosen, mengunggah hasil publikasi (PDF), serta dilengkapi dengan fitur pencarian dan cetak laporan.

## 🛠️ Teknologi yang Digunakan (Stack)

Proyek ini menggunakan arsitektur *microservices* yang dijalankan menggunakan Docker:

*   **Database:** MariaDB (MySQL) 11.4
*   **Backend / API:** Node.js (Express.js) dengan library `mysql2` dan `multer` untuk unggah file.
*   **Frontend:** HTML, CSS, dan JavaScript murni (menggunakan template **Ninja Admin**).
*   **Web Server / Reverse Proxy:** Nginx (Alpine).
*   **Database Management:** phpMyAdmin.

---

## 📋 Prasyarat (Prerequisites)

Sebelum menjalankan aplikasi ini, kamu **wajib** menginstal Docker Engine di komputermu. 

*   **Pengguna Windows dan macOS:** Sangat disarankan untuk menginstal **Docker Desktop**.
*   **Pengguna Linux:** Ikuti panduan instalasi spesifik untuk distribusi Linux yang kamu gunakan.

Silakan kunjungi situs resmi Docker untuk panduan instalasi lengkap:
👉 **[https://docs.docker.com/engine/install/](https://docs.docker.com/engine/install/)**

Setelah selesai menginstal, verifikasi instalasi dengan menjalankan perintah berikut di terminal:

```bash
docker --version
docker compose version


# 🚀 Cara Menjalankan Aplikasi (How to Run)

Ikuti langkah-langkah berikut untuk menjalankan proyek ini di komputer lokal:

## 1. Persiapan Proyek

1. **Clone atau unduh** repositori ini ke komputer lokal.
2. Buka terminal (Command Prompt, PowerShell, atau Bash).
3. Masuk ke direktori utama proyek, yaitu direktori yang berisi file `docker-compose.yml`.

## 2. Download Docker Images

Tarik semua Docker image yang dibutuhkan dari internet dengan menjalankan perintah berikut:

```bash
docker compose pull
```

## 3. Build dan Jalankan Aplikasi

Jalankan perintah berikut untuk melakukan build dan menjalankan seluruh container untuk pertama kalinya:

```bash
docker compose up -d --build
```

Perintah ini akan menjalankan seluruh service yang telah dikonfigurasi di dalam `docker-compose.yml`.

Proses ini juga akan memulai inisialisasi database, pembuatan tabel, dan menjalankan aplikasi secara otomatis.

> **Catatan:** Tunggu beberapa saat hingga proses build dan inisialisasi database selesai sebelum mengakses aplikasi.

---

# 🌐 Akses Aplikasi

Setelah seluruh container berhasil berjalan dengan status `Up`, aplikasi dapat diakses melalui browser.

## 1. Aplikasi Utama (Web)

**URL:**

```text
http://<IP_ADDRESS>:8084
```

Jika aplikasi dijalankan di komputer lokal, gunakan:

```text
http://localhost:8084
```

### Halaman Utama

Halaman utama menampilkan daftar penelitian yang dapat diakses dan dilihat oleh publik (Tamu).

Fitur pencarian juga tersedia pada tabel untuk memudahkan pengguna menemukan data penelitian.

### Login Admin

Gunakan kredensial berikut untuk masuk sebagai administrator:

| Keterangan | Nilai |
|---|---|
| Username | `admin` |
| Password | `admin` |

Admin memiliki hak akses untuk mengelola data dosen, termasuk menambahkan data dosen baru melalui halaman administrasi.

### Login Dosen

Dosen dapat masuk menggunakan ID Dosen yang telah didaftarkan oleh Admin.

| Keterangan | Nilai |
|---|---|
| Username | Dosen ID (contoh: `DSN001`) |
| Password | `1234567` |

> **Catatan:** Password default dibuat secara otomatis oleh sistem ketika Admin menambahkan data dosen.

## 2. phpMyAdmin (Manajemen Database)

phpMyAdmin digunakan untuk mengelola dan memantau database melalui antarmuka web.

**URL:**

```text
http://<IP_ADDRESS>:8083
```

Jika dijalankan di komputer lokal:

```text
http://localhost:8083
```

### Kredensial Database

| Keterangan | Nilai |
|---|---|
| Username | `karan` |
| Password | `karan456` |

---

# ⚙️ Konfigurasi (Configuration)

Jika ingin mengubah konfigurasi aplikasi, seperti password database, nama database, atau port yang digunakan, lakukan perubahan melalui file `docker-compose.yml`.

## 1. Mengubah Port Aplikasi

Secara default, aplikasi utama menggunakan port `8084`.

Cari konfigurasi berikut pada service `web`:

```yaml
ports:
  - "8084:80"
```

Jika ingin menggunakan port lain, misalnya port `80`, ubah menjadi:

```yaml
ports:
  - "80:80"
```

## 2. Mengubah Port phpMyAdmin

Secara default, phpMyAdmin menggunakan port `8083`.

Cari konfigurasi berikut pada service `phpmyadmin`:

```yaml
ports:
  - "8083:80"
```

Ubah port sesuai kebutuhan. Contohnya:

```yaml
ports:
  - "8080:80"
```

## 3. Mengubah Kredensial Database

Konfigurasi database dapat diubah melalui environment variables pada service `db` di dalam file `docker-compose.yml`.

Variabel yang perlu diperhatikan:

| Environment Variable | Fungsi |
|---|---|
| `MARIADB_ROOT_PASSWORD` | Password root database |
| `MARIADB_DATABASE` | Nama database |
| `MARIADB_USER` | Username database |
| `MARIADB_PASSWORD` | Password user database |

**Penting:** Jika kredensial database diubah, pastikan juga untuk menyesuaikan environment variables pada service `api` agar koneksi antara aplikasi dan database tetap berjalan dengan baik.

---

# 🛠️ Perintah Docker Tambahan

Berikut beberapa perintah Docker yang berguna untuk mengelola aplikasi:

### Melihat Status Container

```bash
docker compose ps
```

### Melihat Log Seluruh Container

```bash
docker compose logs -f
```

### Melihat Log Service Tertentu

```bash
docker compose logs -f api
```

### Menghentikan Seluruh Container

```bash
docker compose down
```

### Menjalankan Kembali Container

```bash
docker compose up -d
```

### Build Ulang Aplikasi

```bash
docker compose up -d --build
```

---

# 📝 Catatan

- Pastikan Docker Engine dan Docker Compose sudah terinstal sebelum menjalankan aplikasi.
- Pastikan port `8083` dan `8084` belum digunakan oleh aplikasi lain.
- Pastikan seluruh container berjalan dengan status `Up` sebelum mengakses aplikasi.
- Jangan membagikan kredensial database atau akun administrator kepada pihak yang tidak berwenang.
- Untuk lingkungan produksi, disarankan mengganti password default dengan password yang lebih aman.
