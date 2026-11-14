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
    database: process.env.DB_NAME || 'tugas1_rpl',
    port: process.env.DB_PORT || 3306
});

// Initialize Database
const initDB = () => {
    const queryDosen = `
        CREATE TABLE IF NOT EXISTS tb_dosen (
            dosen_id VARCHAR(50) PRIMARY KEY,
            dosen_name VARCHAR(255) NOT NULL,
            dosen_password VARCHAR(255) NOT NULL DEFAULT '1234567',
            dosen_image VARCHAR(255) DEFAULT NULL
        )
    `;

    const queryPenelitian = `
        CREATE TABLE IF NOT EXISTS tb_penelitian (
            id INT AUTO_INCREMENT PRIMARY KEY,
            dosen_id VARCHAR(50) NOT NULL,
            judul_penelitian TEXT NOT NULL,
            tahun_penelitian YEAR NOT NULL,
            status_penelitian ENUM('Berjalan', 'Selesai') NOT NULL,
            hasil_publikasi JSON, 
            FOREIGN KEY (dosen_id) REFERENCES tb_dosen(dosen_id) ON DELETE CASCADE ON UPDATE CASCADE
        )
    `;

    db.query(queryDosen, (err) => {
        if (err) return console.error("Gagal buat tabel dosen:", err);
        console.log("Tabel tb_dosen siap.");
        
        db.query(queryPenelitian, (err) => {
            if (err) console.error("Gagal buat tabel penelitian:", err);
            else console.log("Tabel tb_penelitian siap.");
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
        
        if (results.length > 0) {
            return res.json({ valid: true, message: "Session valid" });
        } else {
            return res.status(401).json({ valid: false, message: "Invalid session" });
        }
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

// 3. Add Penelitian (Max 3 Files)
app.post('/penelitian', upload.array('files', 3), (req, res) => {
    const { dosen_id, judul_penelitian, tahun_penelitian, status_penelitian } = req.body;
    
    let hasilPublikasiJson = null;
    if (req.files && req.files.length > 0) {
        hasilPublikasiJson = JSON.stringify(req.files.map(f => f.filename));
    }

    const query = "INSERT INTO tb_penelitian (dosen_id, judul_penelitian, tahun_penelitian, status_penelitian, hasil_publikasi) VALUES (?, ?, ?, ?, ?)";
    
    db.query(query, [dosen_id, judul_penelitian, tahun_penelitian, status_penelitian, hasilPublikasiJson], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Data berhasil disimpan!", id: result.insertId });
    });
});

// 4. Edit Penelitian (Now with physical file deletion)
app.put('/penelitian/:id', upload.array('files', 3), (req, res) => {
    const { id } = req.params;
    const { judul_penelitian, tahun_penelitian, status_penelitian, existing_files } = req.body;
    
    // 1. Get the current data from DB to check what files used to exist
    const getQuery = "SELECT hasil_publikasi FROM tb_penelitian WHERE id = ?";
    db.query(getQuery, [id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (results.length === 0) return res.status(404).json({ error: "Data tidak ditemukan" });

        // Safely parse old files
        let oldFiles = [];
        try {
            oldFiles = results[0].hasil_publikasi ? (typeof results[0].hasil_publikasi === 'string' ? JSON.parse(results[0].hasil_publikasi) : results[0].hasil_publikasi) : [];
        } catch (e) { oldFiles = []; }

        // Safely parse kept files sent from frontend
        let keptFiles = [];
        try {
            keptFiles = existing_files ? JSON.parse(existing_files) : [];
        } catch(e) { keptFiles = []; }

        // 2. Find which files were removed by the user
        const removedFiles = oldFiles.filter(file => !keptFiles.includes(file));

        // 3. Physically delete the removed files from the uploads folder
        removedFiles.forEach(file => {
            const filePath = path.join(uploadDir, file);
            fs.unlink(filePath, (err) => {
                if (err) console.error(`Gagal menghapus file fisik: ${file}`, err);
                else console.log(`File fisik dihapus: ${file}`);
            });
        });

        // 4. Proceed with the database update
        let fileArray = keptFiles;
        
        // Add newly uploaded files
        if (req.files && req.files.length > 0) {
            const newFiles = req.files.map(f => f.filename);
            fileArray = [...fileArray, ...newFiles];
        }

        // Enforce max 3 files total
        if (fileArray.length > 3) {
            return res.status(400).json({ error: "Maksimal 3 file publikasi!" });
        }

        const hasilPublikasiJson = fileArray.length > 0 ? JSON.stringify(fileArray) : null;
        const updateQuery = "UPDATE tb_penelitian SET judul_penelitian = ?, tahun_penelitian = ?, status_penelitian = ?, hasil_publikasi = ? WHERE id = ?";
        
        db.query(updateQuery, [judul_penelitian, tahun_penelitian, status_penelitian, hasilPublikasiJson, id], (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: "Data berhasil diupdate!" });
        });
    });
});

// 5. Delete Penelitian (Now also deletes physical files)
app.delete('/penelitian/:id', (req, res) => {
    const getQuery = "SELECT hasil_publikasi FROM tb_penelitian WHERE id = ?";
    
    db.query(getQuery, [req.params.id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        
        if (results.length > 0) {
            // Try to delete files from the folder before deleting the DB record
            let files = [];
            try {
                files = results[0].hasil_publikasi ? (typeof results[0].hasil_publikasi === 'string' ? JSON.parse(results[0].hasil_publikasi) : results[0].hasil_publikasi) : [];
            } catch(e) { files = []; }

            files.forEach(file => {
                const filePath = path.join(uploadDir, file);
                fs.unlink(filePath, (err) => {
                    if (err) console.error(`Gagal menghapus file fisik: ${file}`, err);
                });
            });
        }

        // Delete from database
        const deleteQuery = "DELETE FROM tb_penelitian WHERE id = ?";
        db.query(deleteQuery, [req.params.id], (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: "Data berhasil dihapus!" });
        });
    });
});

// Serve uploaded files
app.use('/uploads', express.static(uploadDir));

app.listen(3000, () => console.log('API berjalan di port 3000'));