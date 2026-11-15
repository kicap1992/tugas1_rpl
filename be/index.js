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

// Database Config
const db = mysql.createPool({
    host: process.env.DB_HOST || 'db',
    user: process.env.DB_USER || 'karan',
    password: process.env.DB_PASSWORD || 'karan456',
    database: process.env.DB_NAME || 'db_penelitian',
    port: process.env.DB_PORT || 3306
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
            created_at TIMESTAMP DEFAULT CONVERT_TZ(NOW(), '+00:00', '+08:00'),
            updated_at TIMESTAMP DEFAULT CONVERT_TZ(NOW(), '+00:00', '+08:00') ON UPDATE CONVERT_TZ(NOW(), '+00:00', '+08:00')
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
            created_at TIMESTAMP DEFAULT CONVERT_TZ(NOW(), '+00:00', '+08:00'),
            updated_at TIMESTAMP DEFAULT CONVERT_TZ(NOW(), '+00:00', '+08:00') ON UPDATE CONVERT_TZ(NOW(), '+00:00', '+08:00'),
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
            created_at TIMESTAMP DEFAULT CONVERT_TZ(NOW(), '+00:00', '+08:00'),
            FOREIGN KEY (penelitian_id) REFERENCES tb_penelitian(id) ON DELETE CASCADE
        )
    `;

    db.query(queryDosen, (err) => {
        if (err) return console.error("Gagal buat tabel dosen:", err);
        console.log("Tabel tb_dosen siap.");
        
        db.query(queryPenelitian, (err) => {
            if (err) return console.error("Gagal buat tabel penelitian:", err);
            console.log("Tabel tb_penelitian siap.");
            
            // Add new columns to existing tb_penelitian if they don't exist yet
            const alterPenelitian = [
                "ALTER TABLE tb_penelitian ADD COLUMN keterangan TEXT DEFAULT NULL",
                "ALTER TABLE tb_penelitian ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
                "ALTER TABLE tb_penelitian ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"
            ];
            
            alterPenelitian.forEach(q => {
                db.query(q, (err) => {
                    // Ignore error if column already exists
                    if (err && err.code !== 'ER_DUP_FIELDNAME') console.error("Alter error:", err.message);
                });
            });

            db.query(queryLaporan, (err) => {
                if (err) console.error("Gagal buat tabel laporan:", err);
                else console.log("Tabel tb_laporan siap.");
            });
        });
    });
};
setTimeout(initDB, 5000);

app.get('/', (req, res) => {
    res.send('API Penelitian Dosen berjalan!');
});

// Login endpoint
app.post('/login', (req, res) => {
    const { username, password } = req.body;

    if (username === 'admin' && password === 'admin') {
        return res.json({ success: true, role: 'admin', message: 'Login Admin berhasil' });
    }

    const query = "SELECT dosen_id, dosen_name FROM tb_dosen WHERE dosen_id = ? AND dosen_password = ?";
    db.query(query, [username, password], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        
        if (results.length > 0) {
            return res.json({ 
                success: true, 
                role: 'dosen', 
                dosen_id: results[0].dosen_id, 
                dosen_name: results[0].dosen_name,
                message: 'Login Dosen berhasil' 
            });
        } else {
            return res.status(401).json({ success: false, message: 'Username atau password salah!' });
        }
    });
});

// ================= DOSEN ENDPOINTS =================

app.get('/dosen', (req, res) => {
    const query = "SELECT dosen_id, dosen_name, dosen_image FROM tb_dosen";
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

// ================= PENELITIAN ENDPOINTS =================

// 1. Get ALL penelitian (Admin)
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

// 2. Get penelitian by Dosen ID (Dosen Page)
app.get('/penelitian/dosen/:dosen_id', (req, res) => {
    const query = "SELECT * FROM tb_penelitian WHERE dosen_id = ? ORDER BY tahun_penelitian DESC";
    db.query(query, [req.params.dosen_id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// 3. Add Penelitian (Max 3 Files) AND Create Initial Laporan
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

        // Also insert into tb_laporan for the initial history
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


// 4. Edit Penelitian (Update tb_penelitian, then INSERT new snapshot into tb_laporan)
app.put('/penelitian/:id', upload.array('files', 3), (req, res) => {
    const { id } = req.params;
    // ONLY extract what is allowed to change
    const { status_penelitian, keterangan, existing_files } = req.body;
    
    db.query("SELECT dosen_id, judul_penelitian, tahun_penelitian, hasil_publikasi FROM tb_penelitian WHERE id = ?", [id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (results.length === 0) return res.status(404).json({ error: "Data tidak ditemukan" });

        const dosen_id = results[0].dosen_id;
        const judul_penelitian = results[0].judul_penelitian; // Keep old title
        const tahun_penelitian = results[0].tahun_penelitian; // Keep old year

        // Handle files
        let keptFiles = existing_files ? JSON.parse(existing_files) : [];
        let newFiles = req.files ? req.files.map(f => f.filename) : [];
        let finalFiles = [...keptFiles, ...newFiles];

        if (finalFiles.length > 3) return res.status(400).json({ error: "Maksimal 3 file publikasi!" });
        let hasilPublikasiJson = finalFiles.length > 0 ? JSON.stringify(finalFiles) : null;

        // 1. Update the main table (Only Status, Keterangan, and Files)
        const updateQuery = `
            UPDATE tb_penelitian 
            SET status_penelitian = ?, keterangan = ?, hasil_publikasi = ? 
            WHERE id = ?
        `;
        db.query(updateQuery, [status_penelitian, keterangan, hasilPublikasiJson, id], (err) => {
            if (err) return res.status(500).json({ error: err.message });

            // 2. Insert snapshot into tb_laporan (use old title and year)
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

// 5. Delete Penelitian (No physical file deletion, just delete DB record)
// Since ON DELETE CASCADE is applied, deleting this will also delete all tb_laporan related to it
app.delete('/penelitian/:id', (req, res) => {
    const deleteQuery = "DELETE FROM tb_penelitian WHERE id = ?";
    db.query(deleteQuery, [req.params.id], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Data berhasil dihapus!" });
    });
});

// 6. Get Laporan History by Penelitian ID
app.get('/laporan/:penelitian_id', (req, res) => {
    const query = "SELECT * FROM tb_laporan WHERE penelitian_id = ? ORDER BY created_at DESC";
    db.query(query, [req.params.penelitian_id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// Serve uploaded files
app.use('/uploads', express.static(uploadDir));

app.listen(3000, () => console.log('API berjalan di port 3000'));