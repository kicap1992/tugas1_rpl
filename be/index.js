const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

// Ensure upload directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// Multer Config for PDF Uploads (Max 1MB per file)
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '_'));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 1024 * 1024 }, // 1 MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Hanya file PDF yang diizinkan!'), false);
        }
    }
});

// Below is for dosen image upload
const imageDir = path.join(__dirname, 'images/dosen');
if (!fs.existsSync(imageDir)) {
    fs.mkdirSync(imageDir, { recursive: true });
}

// Multer Config for Image Uploads (Max 1MB, Only Images)
const imageStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, imageDir),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        const uniqueName = `${Date.now()}-${req.body.dosen_id}${ext}`;
        cb(null, uniqueName);
    }
});

const uploadImage = multer({
    storage: imageStorage,
    limits: { fileSize: 1024 * 1024 }, // 1 MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Hanya file gambar yang diizinkan!'), false);
        }
    }
});
// end of dosen image upload

// Database Config
const db = mysql.createPool({
    host: process.env.DB_HOST || 'db',
    user: process.env.DB_USER || 'karan',
    password: process.env.DB_PASSWORD || 'karan456',
    database: process.env.DB_NAME || 'db_penelitian',
    port: process.env.DB_PORT || 3306,
    timezone: '+08:00',
});

// Initialize Database
const initDB = () => {
    // 1. Create tb_dosen
    const queryDosen = `
        CREATE TABLE IF NOT EXISTS tb_dosen (
            dosen_id VARCHAR(50) PRIMARY KEY,
            dosen_name VARCHAR(255) NOT NULL,
            dosen_password VARCHAR(255) NOT NULL DEFAULT '1234567',
            dosen_image VARCHAR(255) DEFAULT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
    `;

    // 2. Create tb_penelitian
    const queryPenelitian = `
        CREATE TABLE IF NOT EXISTS tb_penelitian (
            id INT AUTO_INCREMENT PRIMARY KEY,
            dosen_id VARCHAR(50) NOT NULL,
            judul_penelitian TEXT NOT NULL,
            tahun_penelitian YEAR NOT NULL,
            status_penelitian ENUM('Berjalan', 'Selesai') NOT NULL,
            keterangan TEXT DEFAULT NULL,
            hasil_publikasi JSON, 
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (dosen_id) REFERENCES tb_dosen(dosen_id) ON DELETE CASCADE ON UPDATE CASCADE
        )
    `;

    // 3. Create tb_laporan (History/Audit Trail)
    const queryLaporan = `
        CREATE TABLE IF NOT EXISTS tb_laporan (
            id INT AUTO_INCREMENT PRIMARY KEY,
            penelitian_id INT NOT NULL,
            dosen_id VARCHAR(50) NOT NULL,
            judul_penelitian TEXT NOT NULL,
            tahun_penelitian YEAR NOT NULL,
            status_penelitian ENUM('Berjalan', 'Selesai') NOT NULL,
            keterangan TEXT DEFAULT NULL,
            hasil_publikasi JSON,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (penelitian_id) REFERENCES tb_penelitian(id) ON DELETE CASCADE
        )
    `;

    // 4. Create tb_mahasiswa
    const queryMahasiswa = `
        CREATE TABLE IF NOT EXISTS tb_mahasiswa (
            id_mahasiswa VARCHAR(50) PRIMARY KEY,
            nama_mahasiswa VARCHAR(255) NOT NULL,
            password VARCHAR(255) NOT NULL DEFAULT '1234567',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
    `;

    // Chain the creation process safely
    db.query(queryDosen, (err) => {
        if (err) return console.error("Gagal buat tabel dosen:", err);
        console.log("Tabel tb_dosen siap.");

        db.query(queryPenelitian, (err) => {
            if (err) return console.error("Gagal buat tabel penelitian:", err);
            console.log("Tabel tb_penelitian siap.");

            // Add new columns to existing tb_penelitian if they don't exist yet
            const alterPenelitian = [
                "ALTER TABLE tb_penelitian ADD COLUMN keterangan TEXT DEFAULT NULL",
                "ALTER TABLE tb_penelitian ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP",
                "ALTER TABLE tb_penelitian ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"
            ];

            alterPenelitian.forEach(q => {
                db.query(q, (err) => {
                    if (err && err.code !== 'ER_DUP_FIELDNAME') console.error("Alter error:", err.message);
                });
            });

            db.query(queryLaporan, (err) => {
                if (err) console.error("Gagal buat tabel laporan:", err);
                else console.log("Tabel tb_laporan siap.");

                db.query(queryMahasiswa, (err) => {
                    if (err) console.error("Gagal buat tabel mahasiswa:", err);
                    else console.log("Tabel tb_mahasiswa siap.");
                    
                    // Call the trigger function
                    createTimezoneTriggers();
                });
            });
        });
    });
};

// Function to create the +8 hour triggers
const createTimezoneTriggers = () => {
    const triggers = [
        // tb_dosen
        `DROP TRIGGER IF EXISTS trg_dosen_insert;`,
        `CREATE TRIGGER trg_dosen_insert BEFORE INSERT ON tb_dosen FOR EACH ROW 
         BEGIN 
            SET NEW.created_at = DATE_ADD(NOW(), INTERVAL 8 HOUR);
            SET NEW.updated_at = DATE_ADD(NOW(), INTERVAL 8 HOUR);
         END;`,
        `DROP TRIGGER IF EXISTS trg_dosen_update;`,
        `CREATE TRIGGER trg_dosen_update BEFORE UPDATE ON tb_dosen FOR EACH ROW 
         BEGIN 
            SET NEW.updated_at = DATE_ADD(NOW(), INTERVAL 8 HOUR);
         END;`,

        // tb_penelitian
        `DROP TRIGGER IF EXISTS trg_penelitian_insert;`,
        `CREATE TRIGGER trg_penelitian_insert BEFORE INSERT ON tb_penelitian FOR EACH ROW 
         BEGIN 
            SET NEW.created_at = DATE_ADD(NOW(), INTERVAL 8 HOUR);
            SET NEW.updated_at = DATE_ADD(NOW(), INTERVAL 8 HOUR);
         END;`,
        `DROP TRIGGER IF EXISTS trg_penelitian_update;`,
        `CREATE TRIGGER trg_penelitian_update BEFORE UPDATE ON tb_penelitian FOR EACH ROW 
         BEGIN 
            SET NEW.updated_at = DATE_ADD(NOW(), INTERVAL 8 HOUR);
         END;`,

        // tb_laporan
        `DROP TRIGGER IF EXISTS trg_laporan_insert;`,
        `CREATE TRIGGER trg_laporan_insert BEFORE INSERT ON tb_laporan FOR EACH ROW 
         BEGIN 
            SET NEW.created_at = DATE_ADD(NOW(), INTERVAL 8 HOUR);
         END;`,

        // tb_mahasiswa
        `DROP TRIGGER IF EXISTS trg_mahasiswa_insert;`,
        `CREATE TRIGGER trg_mahasiswa_insert BEFORE INSERT ON tb_mahasiswa FOR EACH ROW 
         BEGIN 
            SET NEW.created_at = DATE_ADD(NOW(), INTERVAL 8 HOUR);
            SET NEW.updated_at = DATE_ADD(NOW(), INTERVAL 8 HOUR);
         END;`,
        `DROP TRIGGER IF EXISTS trg_mahasiswa_update;`,
        `CREATE TRIGGER trg_mahasiswa_update BEFORE UPDATE ON tb_mahasiswa FOR EACH ROW 
         BEGIN 
            SET NEW.updated_at = DATE_ADD(NOW(), INTERVAL 8 HOUR);
         END;`
    ];

    triggers.forEach(q => {
        db.query(q, (err) => {
            if (err) console.error("Trigger Error:", err.message);
        });
    });
    console.log("Timezone Triggers (+8 Hours) siap.");
};
setTimeout(initDB, 5000);

app.get('/', (req, res) => {
    res.send('API Penelitian Dosen berjalan!');
});

// ================= AUTH ENDPOINTS =================
app.post('/login', (req, res) => {
    const { username, password } = req.body;

    if (username === 'admin' && password === 'admin') {
        return res.json({ success: true, role: 'admin', message: 'Login Admin berhasil' });
    }

    // 1. Check Dosen
    const queryDosen = "SELECT dosen_id, dosen_name FROM tb_dosen WHERE dosen_id = ? AND dosen_password = ?";
    db.query(queryDosen, [username, password], (err, resultsDosen) => {
        if (err) return res.status(500).json({ error: err.message });
        
        if (resultsDosen.length > 0) {
            return res.json({ 
                success: true, 
                role: 'dosen', 
                dosen_id: resultsDosen[0].dosen_id, 
                dosen_name: resultsDosen[0].dosen_name,
                message: 'Login Dosen berhasil' 
            });
        }

        // 2. If not Dosen, check Mahasiswa
        const queryMhs = "SELECT id_mahasiswa, nama_mahasiswa FROM tb_mahasiswa WHERE id_mahasiswa = ? AND password = ?";
        db.query(queryMhs, [username, password], (err, resultsMhs) => {
            if (err) return res.status(500).json({ error: err.message });

            if (resultsMhs.length > 0) {
                return res.json({ 
                    success: true, 
                    role: 'mahasiswa', 
                    id_mahasiswa: resultsMhs[0].id_mahasiswa, 
                    nama_mahasiswa: resultsMhs[0].nama_mahasiswa,
                    message: 'Login Mahasiswa berhasil' 
                });
            }

            // If neither, fail
            return res.status(401).json({ success: false, message: 'Username atau password salah!' });
        });
    });
});

// ================= DOSEN ENDPOINTS =================

app.get('/dosen', (req, res) => {
    const query = `
        SELECT d.dosen_id, d.dosen_name, d.dosen_image, COUNT(p.id) AS jumlah_penelitian
        FROM tb_dosen d
        LEFT JOIN tb_penelitian p ON d.dosen_id = p.dosen_id
        GROUP BY d.dosen_id
        ORDER BY d.created_at DESC
    `;
    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

app.get('/dosen/verify', (req, res) => {
    const { dosen_id, dosen_name } = req.query;
    if (!dosen_id || !dosen_name) return res.status(400).json({ valid: false, message: "Missing parameters" });

    const query = "SELECT dosen_id, dosen_name FROM tb_dosen WHERE dosen_id = ? AND dosen_name = ?";
    db.query(query, [dosen_id, dosen_name], (err, results) => {
        if (err) return res.status(500).json({ valid: false, error: err.message });

        if (results.length > 0) return res.json({ valid: true, message: "Session valid" });
        return res.status(401).json({ valid: false, message: "Invalid session" });
    });
});

app.post('/dosen', (req, res) => {
    const { dosen_id, dosen_name } = req.body;
    if (!dosen_id || !dosen_name) return res.status(400).json({ error: "dosen_id dan dosen_name wajib diisi!" });

    const query = "INSERT INTO tb_dosen (dosen_id, dosen_name, dosen_password, dosen_image) VALUES (?, ?, '1234567', NULL)";

    db.query(query, [dosen_id, dosen_name], (err, result) => {
        if (err) {
            if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: "Dosen ID sudah terdaftar!" });
            return res.status(500).json({ error: err.message });
        }
        res.json({ message: "Dosen berhasil ditambahkan!", id: dosen_id });
    });
});

app.put('/dosen/change-password', (req, res) => {
    const { dosen_id, current_password, new_password } = req.body;

    if (!dosen_id || !current_password || !new_password) {
        return res.status(400).json({ error: "Semua field wajib diisi!" });
    }

    const verifyQuery = "SELECT dosen_id FROM tb_dosen WHERE dosen_id = ? AND dosen_password = ?";
    db.query(verifyQuery, [dosen_id, current_password], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });

        if (results.length === 0) {
            return res.status(401).json({ error: "Password saat ini salah!" });
        }

        const updateQuery = "UPDATE tb_dosen SET dosen_password = ? WHERE dosen_id = ?";
        db.query(updateQuery, [new_password, dosen_id], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: "Password berhasil diubah!" });
        });
    });
});

app.put('/dosen/upload-image', uploadImage.single('image'), (req, res) => {
    const { dosen_id } = req.body;

    if (!req.file) {
        return res.status(400).json({ error: "File gambar tidak ditemukan." });
    }

    const newImageName = req.file.filename;

    const getOldImageQuery = "SELECT dosen_image FROM tb_dosen WHERE dosen_id = ?";
    db.query(getOldImageQuery, [dosen_id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });

        const oldImageName = results.length > 0 ? results[0].dosen_image : null;

        if (oldImageName) {
            const oldFilePath = path.join(imageDir, oldImageName);
            if (fs.existsSync(oldFilePath)) {
                fs.unlink(oldFilePath, (unlinkErr) => {
                    if (unlinkErr) console.error("Gagal menghapus gambar lama:", unlinkErr);
                    else console.log("Gambar lama dihapus:", oldImageName);
                });
            }
        }

        const updateQuery = "UPDATE tb_dosen SET dosen_image = ? WHERE dosen_id = ?";
        db.query(updateQuery, [newImageName, dosen_id], (errUpdate) => {
            if (errUpdate) return res.status(500).json({ error: errUpdate.message });
            res.json({ message: "Foto profil berhasil diperbarui!", image: newImageName });
        });
    });
});

app.use('/images/dosen', express.static(imageDir));

// Get Dosen Detail (For the "Detail" modal)
app.get('/dosen/:dosen_id/detail', (req, res) => {
    const dosenId = req.params.dosen_id;
    
    // 1. Get Dosen Info & Research Count
    const queryInfo = `
        SELECT d.dosen_id, d.dosen_name, d.dosen_image, COUNT(p.id) as jumlah_penelitian
        FROM tb_dosen d
        LEFT JOIN tb_penelitian p ON d.dosen_id = p.dosen_id
        WHERE d.dosen_id = ?
        GROUP BY d.dosen_id
    `;
    
    db.query(queryInfo, [dosenId], (err, infoResults) => {
        if (err) return res.status(500).json({ error: err.message });
        if (infoResults.length === 0) return res.status(404).json({ error: "Dosen tidak ditemukan" });

        // 2. Get Latest Research
        const queryLatest = `
            SELECT judul_penelitian, status_penelitian, keterangan, updated_at 
            FROM tb_penelitian 
            WHERE dosen_id = ? 
            ORDER BY updated_at DESC 
            LIMIT 1
        `;
        
        db.query(queryLatest, [dosenId], (err, latestResults) => {
            if (err) return res.status(500).json({ error: err.message });
            
            res.json({
                dosen: infoResults[0],
                latest_penelitian: latestResults.length > 0 ? latestResults[0] : null
            });
        });
    });
});

// Reset Dosen Password
app.put('/dosen/reset-password/:dosen_id', (req, res) => {
    const dosenId = req.params.dosen_id;
    const query = "UPDATE tb_dosen SET dosen_password = '1234567' WHERE dosen_id = ?";
    
    db.query(query, [dosenId], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        if (result.affectedRows === 0) return res.status(404).json({ error: "Dosen tidak ditemukan" });
        res.json({ message: "Password berhasil direset menjadi 1234567!" });
    });
});

// ================= MAHASISWA ENDPOINTS =================
app.get('/mahasiswa', (req, res) => {
    db.query("SELECT id_mahasiswa, nama_mahasiswa, created_at FROM tb_mahasiswa", (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

app.post('/mahasiswa', (req, res) => {
    const { id_mahasiswa, nama_mahasiswa } = req.body;
    if (!id_mahasiswa || !nama_mahasiswa) return res.status(400).json({ error: "ID dan Nama wajib diisi!" });

    const query = "INSERT INTO tb_mahasiswa (id_mahasiswa, nama_mahasiswa, password) VALUES (?, ?, '1234567')";
    db.query(query, [id_mahasiswa, nama_mahasiswa], (err) => {
        if (err) {
            if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: "ID Mahasiswa sudah terdaftar!" });
            return res.status(500).json({ error: err.message });
        }
        res.json({ message: "Mahasiswa berhasil ditambahkan!" });
    });
});

// ================= PENELITIAN ENDPOINTS =================

app.get('/penelitian', (req, res) => {
    const { nama, tahun } = req.query;
    let query = `
        SELECT p.*, d.dosen_name 
        FROM tb_penelitian p
        JOIN tb_dosen d ON p.dosen_id = d.dosen_id
        WHERE 1=1
    `;
    let params = [];

    if (nama) { query += " AND d.dosen_name LIKE ?"; params.push(`%${nama}%`); }
    if (tahun) { query += " AND p.tahun_penelitian = ?"; params.push(tahun); }

    query += " ORDER BY p.updated_at DESC";

    db.query(query, params, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

app.get('/penelitian/dosen/:dosen_id', (req, res) => {
    const query = "SELECT * FROM tb_penelitian WHERE dosen_id = ? ORDER BY tahun_penelitian DESC";
    db.query(query, [req.params.dosen_id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

app.post('/penelitian', upload.array('files', 3), (req, res) => {
    const { dosen_id, judul_penelitian, tahun_penelitian, status_penelitian, keterangan } = req.body;

    let hasilPublikasiJson = null;
    if (req.files && req.files.length > 0) {
        hasilPublikasiJson = JSON.stringify(req.files.map(f => f.filename));
    }

    const insertPenelitian = `
        INSERT INTO tb_penelitian (dosen_id, judul_penelitian, tahun_penelitian, status_penelitian, keterangan, hasil_publikasi) 
        VALUES (?, ?, ?, ?, ?, ?)
    `;

    db.query(insertPenelitian, [dosen_id, judul_penelitian, tahun_penelitian, status_penelitian, keterangan, hasilPublikasiJson], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });

        const newId = result.insertId;

        const insertLaporan = `
            INSERT INTO tb_laporan (penelitian_id, dosen_id, judul_penelitian, tahun_penelitian, status_penelitian, keterangan, hasil_publikasi) 
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        db.query(insertLaporan, [newId, dosen_id, judul_penelitian, tahun_penelitian, status_penelitian, keterangan, hasilPublikasiJson], (err) => {
            if (err) console.error("Gagal insert history laporan:", err);
            res.json({ message: "Data berhasil disimpan!", id: newId });
        });
    });
});

app.put('/penelitian/:id', upload.array('files', 3), (req, res) => {
    const { id } = req.params;
    const { status_penelitian, keterangan, existing_files } = req.body;

    db.query("SELECT dosen_id, judul_penelitian, tahun_penelitian, hasil_publikasi FROM tb_penelitian WHERE id = ?", [id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (results.length === 0) return res.status(404).json({ error: "Data tidak ditemukan" });

        const dosen_id = results[0].dosen_id;
        const judul_penelitian = results[0].judul_penelitian;
        const tahun_penelitian = results[0].tahun_penelitian;

        let keptFiles = existing_files ? JSON.parse(existing_files) : [];
        let newFiles = req.files ? req.files.map(f => f.filename) : [];
        let finalFiles = [...keptFiles, ...newFiles];

        if (finalFiles.length > 3) return res.status(400).json({ error: "Maksimal 3 file publikasi!" });
        let hasilPublikasiJson = finalFiles.length > 0 ? JSON.stringify(finalFiles) : null;

        const updateQuery = `
            UPDATE tb_penelitian 
            SET status_penelitian = ?, keterangan = ?, hasil_publikasi = ? 
            WHERE id = ?
        `;
        db.query(updateQuery, [status_penelitian, keterangan, hasilPublikasiJson, id], (err) => {
            if (err) return res.status(500).json({ error: err.message });

            const logQuery = `
                INSERT INTO tb_laporan (penelitian_id, dosen_id, judul_penelitian, tahun_penelitian, status_penelitian, keterangan, hasil_publikasi)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `;
            db.query(logQuery, [id, dosen_id, judul_penelitian, tahun_penelitian, status_penelitian, keterangan, hasilPublikasiJson], (errLog) => {
                if (errLog) return res.status(500).json({ error: "Gagal membuat laporan update: " + errLog.message });
                res.json({ message: "Data berhasil diupdate dan laporan baru dibuat!" });
            });
        });
    });
});

app.delete('/penelitian/:id', (req, res) => {
    const deleteQuery = "DELETE FROM tb_penelitian WHERE id = ?";
    db.query(deleteQuery, [req.params.id], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Data berhasil dihapus!" });
    });
});

app.get('/laporan/:penelitian_id', (req, res) => {
    const query = "SELECT * FROM tb_laporan WHERE penelitian_id = ? ORDER BY created_at DESC";
    db.query(query, [req.params.penelitian_id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

app.get('/laporan/latest/:dosen_id', (req, res) => {
    const query = "SELECT created_at FROM tb_laporan WHERE dosen_id = ? ORDER BY created_at DESC LIMIT 1";
    db.query(query, [req.params.dosen_id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (results.length > 0) res.json({ latest: results[0].created_at });
        else res.json({ latest: null });
    });
});

app.use('/uploads', express.static(uploadDir));

app.listen(3000, () => console.log('API berjalan di port 3000'));