require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const multer = require('multer');
const path = require('path');
const { initDB, getDB } = require('./db');
const { authenticateToken, requireRole } = require('./middleware/auth');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] }
});

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Configure Multer for local disk storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}_${file.originalname.replace(/\s+/g, '_')}`);
    }
});
const upload = multer({ storage: storage });

// --- Authentication Routes ---
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const db = await getDB();
        const user = await db.get('SELECT * FROM users WHERE email = ?', [email]);
        if (!user) return res.status(401).json({ error: "Invalid email or password" });

        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) return res.status(401).json({ error: "Invalid email or password" });

        // Check approval status
        if (user.role === 'student' && !user.is_approved) {
            return res.status(403).json({ error: "Your account is pending teacher approval." });
        }

        const sessionId = crypto.randomBytes(16).toString('hex');
        await db.run('UPDATE users SET active_session_id = ? WHERE id = ?', [sessionId, user.id]);

        let className = 'General';
        if (user.role === 'student') {
            const studentInfo = await db.get('SELECT class_name FROM students WHERE id = ?', [user.id]);
            if (studentInfo && studentInfo.class_name) className = studentInfo.class_name;
        }

        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role, sessionId: sessionId, class_name: className },
            process.env.JWT_SECRET || 'secret',
            { expiresIn: '24h' }
        );

        res.json({ token, role: user.role, email: user.email, id: user.id, class_name: className });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Internal server error" });
    }
});

app.post('/api/auth/register', async (req, res) => {
    const { email, password, fullName, fatherName, phone, class_name } = req.body;
    try {
        const db = await getDB();
        // Check if email exists
        const existing = await db.get('SELECT * FROM users WHERE email = ?', [email]);
        if (existing) return res.status(400).json({ error: "Email already registered" });

        const hashedPassword = await bcrypt.hash(password, 10);
        const userId = crypto.randomUUID();
        
        // is_approved defaults to 0
        await db.run('INSERT INTO users (id, email, password_hash, plain_password, role, is_approved) VALUES (?, ?, ?, ?, ?, 0)', 
            [userId, email, hashedPassword, password, 'student']);
        
        await db.run('INSERT INTO students (id, full_name, father_name, phone, class_name) VALUES (?, ?, ?, ?, ?)', 
            [userId, fullName, fatherName, phone, class_name || 'General']);

        res.status(201).json({ message: "Registration successful, pending teacher approval" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Internal server error" });
    }
});

// --- Students ---
app.post('/api/students', authenticateToken, requireRole('teacher'), async (req, res) => {
    const { email, password, fullName, fatherName, phone, class_name } = req.body;
    try {
        const db = await getDB();
        const hashedPassword = await bcrypt.hash(password, 10);
        const userId = crypto.randomUUID();
        
        await db.run('INSERT INTO users (id, email, password_hash, plain_password, role, is_approved) VALUES (?, ?, ?, ?, ?, 1)', [userId, email, hashedPassword, password, 'student']);
        await db.run('INSERT INTO students (id, full_name, father_name, phone, class_name) VALUES (?, ?, ?, ?, ?)', [userId, fullName, fatherName, phone, class_name || 'General']);

        const studentData = await db.get('SELECT * FROM students WHERE id = ?', [userId]);
        res.status(201).json({ message: "Student created successfully", student: studentData });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Internal server error" });
    }
});

app.get('/api/students', authenticateToken, requireRole('teacher'), async (req, res) => {
    try {
        const db = await getDB();
        const students = await db.all(`
            SELECT s.id, s.full_name, s.father_name, s.phone, s.enrollment_date, s.class_name, u.email, u.plain_password, u.is_approved
            FROM students s 
            JOIN users u ON s.id = u.id
        `);
        // Format to match original Supabase nested structure: { email } inside users
        const formatted = students.map(s => ({
            id: s.id, full_name: s.full_name, father_name: s.father_name, phone: s.phone, enrollment_date: s.enrollment_date, class_name: s.class_name, plain_password: s.plain_password,
            is_approved: s.is_approved,
            users: { email: s.email }
        }));
        res.json(formatted);
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

app.delete('/api/students/:id', authenticateToken, requireRole('teacher'), async (req, res) => {
    try {
        const db = await getDB();
        await db.run('DELETE FROM users WHERE id = ?', [req.params.id]); 
        await db.run('DELETE FROM students WHERE id = ?', [req.params.id]);
        res.json({ message: "Student deleted successfully" });
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

app.put('/api/students/:id', authenticateToken, requireRole('teacher'), async (req, res) => {
    const { email, password, fullName, fatherName, phone, class_name } = req.body;
    try {
        const db = await getDB();
        if (email) await db.run('UPDATE users SET email = ? WHERE id = ?', [email, req.params.id]);
        if (password) {
            const hash = await bcrypt.hash(password, 10);
            await db.run('UPDATE users SET password_hash = ?, plain_password = ? WHERE id = ?', [hash, password, req.params.id]);
        }
        if (fullName) await db.run('UPDATE students SET full_name = ? WHERE id = ?', [fullName, req.params.id]);
        if (fatherName !== undefined) await db.run('UPDATE students SET father_name = ? WHERE id = ?', [fatherName, req.params.id]);
        if (phone !== undefined) await db.run('UPDATE students SET phone = ? WHERE id = ?', [phone, req.params.id]);
        if (class_name) await db.run('UPDATE students SET class_name = ? WHERE id = ?', [class_name, req.params.id]);
        res.json({ message: "Student updated successfully" });
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

app.put('/api/students/:id/approve', authenticateToken, requireRole('teacher'), async (req, res) => {
    try {
        const db = await getDB();
        await db.run('UPDATE users SET is_approved = 1 WHERE id = ?', [req.params.id]);
        res.json({ message: "Student approved successfully" });
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

app.post('/api/students/bulk-delete', authenticateToken, requireRole('teacher'), async (req, res) => {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: "No ids provided" });
    try {
        const db = await getDB();
        const placeholders = ids.map(() => '?').join(',');
        await db.run(`DELETE FROM students WHERE id IN (${placeholders})`, ids);
        await db.run(`DELETE FROM users WHERE id IN (${placeholders})`, ids);
        res.json({ message: "Students deleted successfully" });
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

// --- Notes ---
app.post('/api/notes', authenticateToken, requireRole('teacher'), upload.single('file'), async (req, res) => {
    const { title, description, class_name, subject } = req.body;
    const file = req.file;
    if (!file) return res.status(400).json({ error: "File is required" });

    try {
        const db = await getDB();
        const fileUrl = `http://localhost:${process.env.PORT || 5000}/uploads/${file.filename}`;
        const noteId = crypto.randomUUID();
        
        await db.run('INSERT INTO notes (id, title, description, file_url, class_name, subject, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)', 
            [noteId, title, description, fileUrl, class_name || 'General', subject || 'General', req.user.id]);
        
        const noteData = await db.get('SELECT * FROM notes WHERE id = ?', [noteId]);
        res.status(201).json({ message: "Note uploaded successfully", note: noteData });
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

app.get('/api/notes', authenticateToken, async (req, res) => {
    try {
        const db = await getDB();
        let notes;
        if (req.user.role === 'student') {
            notes = await db.all("SELECT * FROM notes WHERE class_name = ? OR class_name = 'General' ORDER BY created_at DESC", [req.user.class_name]);
        } else {
            notes = await db.all('SELECT * FROM notes ORDER BY created_at DESC');
        }
        res.json(notes);
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

app.delete('/api/notes/:id', authenticateToken, requireRole('teacher'), async (req, res) => {
    try {
        const db = await getDB();
        await db.run('DELETE FROM notes WHERE id = ?', [req.params.id]);
        res.json({ message: "Note deleted successfully" });
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

// --- Books ---
app.post('/api/books', authenticateToken, requireRole('teacher'), upload.fields([{ name: 'file_english', maxCount: 1 }, { name: 'file_hindi', maxCount: 1 }]), async (req, res) => {
    const { title, author, class_name } = req.body;
    
    const englishFile = req.files && req.files['file_english'] ? req.files['file_english'][0] : null;
    const hindiFile = req.files && req.files['file_hindi'] ? req.files['file_hindi'][0] : null;
    
    if (!englishFile && !hindiFile) {
        return res.status(400).json({ error: "At least one file (English or Hindi) is required" });
    }

    try {
        const db = await getDB();
        const baseUrl = `http://localhost:${process.env.PORT || 5000}/uploads/`;
        
        const englishUrl = englishFile ? `${baseUrl}${englishFile.filename}` : '';
        const hindiUrl = hindiFile ? `${baseUrl}${hindiFile.filename}` : '';
        
        const bookId = crypto.randomUUID();
        
        await db.run('INSERT INTO books (id, title, author, file_url, file_url_hindi, class_name, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)', 
            [bookId, title, author, englishUrl, hindiUrl, class_name || 'General', req.user.id]);
        
        const bookData = await db.get('SELECT * FROM books WHERE id = ?', [bookId]);
        res.status(201).json({ message: "Book uploaded successfully", book: bookData });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Internal server error" });
    }
});

app.get('/api/books', authenticateToken, async (req, res) => {
    try {
        const db = await getDB();
        let books;
        if (req.user.role === 'student') {
            books = await db.all("SELECT * FROM books WHERE class_name = ? OR class_name = 'General' ORDER BY created_at DESC", [req.user.class_name]);
        } else {
            books = await db.all('SELECT * FROM books ORDER BY created_at DESC');
        }
        
        // Static NCERT Books
        let ncertBooks = [
            // Class 8
            { id: 'ncert-8-math', title: 'Class 8 NCERT Mathematics', author: 'NCERT', file_url: 'https://ncert.nic.in/textbook.php?hemh1=0-16', file_url_hindi: 'https://ncert.nic.in/textbook.php?hhmh1=0-16', created_at: new Date().toISOString(), class_name: '8' },
            { id: 'ncert-8-sci', title: 'Class 8 NCERT Science', author: 'NCERT', file_url: 'https://ncert.nic.in/textbook.php?hesc1=0-13', file_url_hindi: 'https://ncert.nic.in/textbook.php?hhsc1=0-13', created_at: new Date().toISOString(), class_name: '8' },
            { id: 'ncert-8-eng', title: 'Class 8 NCERT English', author: 'NCERT', file_url: 'https://ncert.nic.in/textbook.php?hehd1=0-10', file_url_hindi: '', created_at: new Date().toISOString(), class_name: '8' },
            { id: 'ncert-8-hin', title: 'Class 8 NCERT Hindi', author: 'NCERT', file_url: '', file_url_hindi: 'https://ncert.nic.in/textbook.php?hhvs1=0-18', created_at: new Date().toISOString(), class_name: '8' },
            { id: 'ncert-8-sst', title: 'Class 8 NCERT Social Science', author: 'NCERT', file_url: 'https://ncert.nic.in/textbook.php?hess1=0-6', file_url_hindi: 'https://ncert.nic.in/textbook.php?hhss1=0-6', created_at: new Date().toISOString(), class_name: '8' },
            // Class 9
            { id: 'ncert-9-math', title: 'Class 9 NCERT Mathematics', author: 'NCERT', file_url: 'https://ncert.nic.in/textbook.php?iemh1=0-12', file_url_hindi: 'https://ncert.nic.in/textbook.php?ihmh1=0-12', created_at: new Date().toISOString(), class_name: '9' },
            { id: 'ncert-9-sci', title: 'Class 9 NCERT Science', author: 'NCERT', file_url: 'https://ncert.nic.in/textbook.php?iesc1=0-15', file_url_hindi: 'https://ncert.nic.in/textbook.php?ihsc1=0-15', created_at: new Date().toISOString(), class_name: '9' },
            { id: 'ncert-9-eng', title: 'Class 9 NCERT English', author: 'NCERT', file_url: 'https://ncert.nic.in/textbook.php?iebe1=0-11', file_url_hindi: '', created_at: new Date().toISOString(), class_name: '9' },
            { id: 'ncert-9-hin', title: 'Class 9 NCERT Hindi', author: 'NCERT', file_url: '', file_url_hindi: 'https://ncert.nic.in/textbook.php?ihks1=0-17', created_at: new Date().toISOString(), class_name: '9' },
            { id: 'ncert-9-sst', title: 'Class 9 NCERT Social Science', author: 'NCERT', file_url: 'https://ncert.nic.in/textbook.php?iess1=0-5', file_url_hindi: 'https://ncert.nic.in/textbook.php?ihss1=0-5', created_at: new Date().toISOString(), class_name: '9' },
            // Class 10
            { id: 'ncert-10-math', title: 'Class 10 NCERT Mathematics', author: 'NCERT', file_url: 'https://ncert.nic.in/textbook.php?jemh1=0-14', file_url_hindi: 'https://ncert.nic.in/textbook.php?jhmh1=0-14', created_at: new Date().toISOString(), class_name: '10' },
            { id: 'ncert-10-sci', title: 'Class 10 NCERT Science', author: 'NCERT', file_url: 'https://ncert.nic.in/textbook.php?jesc1=0-13', file_url_hindi: 'https://ncert.nic.in/textbook.php?jhsc1=0-13', created_at: new Date().toISOString(), class_name: '10' },
            { id: 'ncert-10-eng', title: 'Class 10 NCERT English', author: 'NCERT', file_url: 'https://ncert.nic.in/textbook.php?jeef1=0-11', file_url_hindi: '', created_at: new Date().toISOString(), class_name: '10' },
            { id: 'ncert-10-hin', title: 'Class 10 NCERT Hindi', author: 'NCERT', file_url: '', file_url_hindi: 'https://ncert.nic.in/textbook.php?jhks1=0-17', created_at: new Date().toISOString(), class_name: '10' },
            { id: 'ncert-10-sst', title: 'Class 10 NCERT Social Science', author: 'NCERT', file_url: 'https://ncert.nic.in/textbook.php?jess1=0-7', file_url_hindi: 'https://ncert.nic.in/textbook.php?jhss1=0-7', created_at: new Date().toISOString(), class_name: '10' },
            { id: 'ncert-10-san', title: 'Class 10 NCERT Sanskrit', author: 'NCERT', file_url: '', file_url_hindi: 'https://ncert.nic.in/textbook.php?jhsk1=0-12', created_at: new Date().toISOString(), class_name: '10' },
            { id: 'ncert-12-phys1', title: 'Class 12 NCERT Physics (Part 1)', author: 'NCERT', file_url: 'https://ncert.nic.in/textbook.php?leph1=0-8', file_url_hindi: 'https://ncert.nic.in/textbook.php?lhph1=0-8', created_at: new Date().toISOString(), class_name: '12' },
            { id: 'ncert-12-phys2', title: 'Class 12 NCERT Physics (Part 2)', author: 'NCERT', file_url: 'https://ncert.nic.in/textbook.php?leph2=0-6', file_url_hindi: 'https://ncert.nic.in/textbook.php?lhph2=0-6', created_at: new Date().toISOString(), class_name: '12' },
            { id: 'ncert-12-chem1', title: 'Class 12 NCERT Chemistry (Part 1)', author: 'NCERT', file_url: 'https://ncert.nic.in/textbook.php?lech1=0-5', file_url_hindi: 'https://ncert.nic.in/textbook.php?lhch1=0-5', created_at: new Date().toISOString(), class_name: '12' },
            { id: 'ncert-12-chem2', title: 'Class 12 NCERT Chemistry (Part 2)', author: 'NCERT', file_url: 'https://ncert.nic.in/textbook.php?lech2=0-5', file_url_hindi: 'https://ncert.nic.in/textbook.php?lhch2=0-5', created_at: new Date().toISOString(), class_name: '12' },
            { id: 'ncert-12-math1', title: 'Class 12 NCERT Mathematics (Part 1)', author: 'NCERT', file_url: 'https://ncert.nic.in/textbook.php?lemh1=0-6', file_url_hindi: 'https://ncert.nic.in/textbook.php?lhmh1=0-6', created_at: new Date().toISOString(), class_name: '12' },
            { id: 'ncert-12-math2', title: 'Class 12 NCERT Mathematics (Part 2)', author: 'NCERT', file_url: 'https://ncert.nic.in/textbook.php?lemh2=0-7', file_url_hindi: 'https://ncert.nic.in/textbook.php?lhmh2=0-7', created_at: new Date().toISOString(), class_name: '12' },
            { id: 'ncert-12-bio', title: 'Class 12 NCERT Biology', author: 'NCERT', file_url: 'https://ncert.nic.in/textbook.php?lebo1=0-16', file_url_hindi: 'https://ncert.nic.in/textbook.php?lhbo1=0-16', created_at: new Date().toISOString(), class_name: '12' }
        ];

        if (req.user.role === 'student') {
            ncertBooks = ncertBooks.filter(b => b.class_name === req.user.class_name || req.user.class_name === 'General');
        }

        res.json([...ncertBooks, ...books]);
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

app.delete('/api/books/:id', authenticateToken, requireRole('teacher'), async (req, res) => {
    try {
        const db = await getDB();
        await db.run('DELETE FROM books WHERE id = ?', [req.params.id]);
        res.json({ message: "Book deleted successfully" });
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

// --- Notices ---
app.post('/api/notices', authenticateToken, requireRole('teacher'), async (req, res) => {
    const { title, content } = req.body;
    if (!title || !content) return res.status(400).json({ error: "Title and content are required" });

    try {
        const db = await getDB();
        const noticeId = crypto.randomUUID();
        await db.run('INSERT INTO notices (id, title, content, created_by) VALUES (?, ?, ?, ?)', [noticeId, title, content, req.user.id]);
        const data = await db.get('SELECT * FROM notices WHERE id = ?', [noticeId]);
        res.status(201).json({ message: "Notice created successfully", notice: data });
    } catch (err) {
        console.error("Notice creation error:", err);
        res.status(500).json({ error: err.message || "Internal server error" });
    }
});

app.get('/api/notices', authenticateToken, async (req, res) => {
    try {
        const db = await getDB();
        const notices = await db.all('SELECT * FROM notices ORDER BY created_at DESC');
        res.json(notices);
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

app.delete('/api/notices/:id', authenticateToken, requireRole('teacher'), async (req, res) => {
    try {
        const db = await getDB();
        await db.run('DELETE FROM notices WHERE id = ?', [req.params.id]);
        res.json({ message: "Notice deleted successfully" });
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

// --- Attendance ---
app.post('/api/attendance', authenticateToken, requireRole('teacher'), async (req, res) => {
    const { date, records } = req.body;
    if (!date || !records || !Array.isArray(records)) return res.status(400).json({ error: "Invalid data" });

    try {
        const db = await getDB();
        await db.run('DELETE FROM attendance WHERE date = ?', [date]);
        
        for (const r of records) {
            await db.run('INSERT INTO attendance (id, student_id, date, status, marked_by) VALUES (?, ?, ?, ?, ?)', 
                [crypto.randomUUID(), r.student_id, date, r.status, req.user.id]);
        }
        res.status(201).json({ message: "Attendance saved successfully" });
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

app.get('/api/attendance', authenticateToken, requireRole('teacher'), async (req, res) => {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: "Date is required" });

    try {
        const db = await getDB();
        const data = await db.all('SELECT * FROM attendance WHERE date = ?', [date]);
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

app.get('/api/attendance/report', authenticateToken, requireRole('teacher'), async (req, res) => {
    const { month, year } = req.query;
    try {
        const db = await getDB();
        let query = `
            SELECT a.*, s.full_name 
            FROM attendance a 
            JOIN students s ON a.student_id = s.id 
        `;
        let params = [];
        if (month && year) {
            query += ` WHERE a.date LIKE ? `;
            // pad month with 0 if needed
            const paddedMonth = month.padStart(2, '0');
            params.push(`${year}-${paddedMonth}-%`);
        }
        query += ` ORDER BY a.date DESC`;
        
        const data = await db.all(query, params);
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

app.get('/api/attendance/student/:student_id', authenticateToken, requireRole('teacher'), async (req, res) => {
    try {
        const db = await getDB();
        const data = await db.all('SELECT * FROM attendance WHERE student_id = ? ORDER BY date DESC', [req.params.student_id]);
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

app.put('/api/attendance/:id', authenticateToken, requireRole('teacher'), async (req, res) => {
    const { status } = req.body;
    try {
        const db = await getDB();
        await db.run('UPDATE attendance SET status = ? WHERE id = ?', [status, req.params.id]);
        res.json({ message: "Attendance updated" });
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

app.get('/api/student/attendance', authenticateToken, async (req, res) => {
    try {
        const db = await getDB();
        const data = await db.all('SELECT * FROM attendance WHERE student_id = ? ORDER BY date DESC', [req.user.id]);
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

// --- Results ---
app.post('/api/results', authenticateToken, requireRole('teacher'), async (req, res) => {
    const { student_id, exam_name, marks_data, date, status } = req.body;
    try {
        const db = await getDB();
        let finalExamName = exam_name;
        if (marks_data && Array.isArray(marks_data)) {
            finalExamName = `__MARKS__${exam_name}__JSON__${JSON.stringify(marks_data)}`;
        }
        await db.run('INSERT INTO results (id, student_id, exam_name, date, created_by, total_marks, marks_obtained, status) VALUES (?, ?, ?, ?, ?, 0, 0, ?)', 
            [crypto.randomUUID(), student_id, finalExamName, date, req.user.id, status || 'Pass']);
        res.status(201).json({ message: "Result added" });
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

app.get('/api/results', authenticateToken, requireRole('teacher'), async (req, res) => {
    try {
        const db = await getDB();
        const results = await db.all(`
            SELECT r.*, s.full_name, u.email 
            FROM results r 
            JOIN students s ON r.student_id = s.id 
            JOIN users u ON s.id = u.id 
            ORDER BY r.date DESC
        `);
        
        const processedData = results.map(r => {
            if (r.exam_name && r.exam_name.startsWith('__MARKS__')) {
                const parts = r.exam_name.split('__JSON__');
                r.exam_name = parts[0].replace('__MARKS__', '');
                try {
                    r.marks_data = JSON.parse(parts[1]);
                } catch (e) {
                    r.marks_data = [];
                }
            }
            r.students = { full_name: r.full_name, users: { email: r.email } };
            r.obtained_marks = r.marks_obtained;
            return r;
        });

        res.json(processedData);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Internal server error" });
    }
});

app.delete('/api/results/:id', authenticateToken, requireRole('teacher'), async (req, res) => {
    try {
        const db = await getDB();
        await db.run('DELETE FROM results WHERE id = ?', [req.params.id]);
        res.json({ message: "Result deleted" });
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

app.get('/api/student/results', authenticateToken, async (req, res) => {
    try {
        const db = await getDB();
        const results = await db.all('SELECT * FROM results WHERE student_id = ? ORDER BY date DESC', [req.user.id]);
        
        const processedData = results.map(r => {
            if (r.exam_name && r.exam_name.startsWith('__MARKS__')) {
                const parts = r.exam_name.split('__JSON__');
                r.exam_name = parts[0].replace('__MARKS__', '');
                try {
                    r.marks_data = JSON.parse(parts[1]);
                } catch (e) {
                    r.marks_data = [];
                }
            }
            r.obtained_marks = r.marks_obtained;
            return r;
        });

        res.json(processedData);
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

// --- Fees ---
app.post('/api/fees', authenticateToken, requireRole('teacher'), async (req, res) => {
    const { student_id, amount, status, due_date, paid_date } = req.body;
    try {
        const db = await getDB();
        await db.run('INSERT INTO fees (id, student_id, amount, status, due_date, paid_date, recorded_by) VALUES (?, ?, ?, ?, ?, ?, ?)', 
            [crypto.randomUUID(), student_id, amount, status, due_date, paid_date, req.user.id]);
        res.status(201).json({ message: "Fee record added" });
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

app.get('/api/fees', authenticateToken, requireRole('teacher'), async (req, res) => {
    try {
        const db = await getDB();
        const fees = await db.all(`
            SELECT f.*, s.full_name, u.email 
            FROM fees f 
            JOIN students s ON f.student_id = s.id 
            JOIN users u ON s.id = u.id 
            ORDER BY f.due_date DESC
        `);
        const formatted = fees.map(f => {
            f.students = { full_name: f.full_name, users: { email: f.email } };
            return f;
        });
        res.json(formatted);
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

app.delete('/api/fees/:id', authenticateToken, requireRole('teacher'), async (req, res) => {
    try {
        const db = await getDB();
        await db.run('DELETE FROM fees WHERE id = ?', [req.params.id]);
        res.json({ message: "Fee record deleted" });
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

app.put('/api/fees/:id', authenticateToken, requireRole('teacher'), async (req, res) => {
    const { student_id, amount, status, due_date, paid_date } = req.body;
    try {
        const db = await getDB();
        await db.run('UPDATE fees SET student_id = ?, amount = ?, status = ?, due_date = ?, paid_date = ? WHERE id = ?',
            [student_id, amount, status, due_date, paid_date, req.params.id]);
        res.json({ message: "Fee record updated" });
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

app.get('/api/student/fees', authenticateToken, async (req, res) => {
    try {
        const db = await getDB();
        const data = await db.all('SELECT * FROM fees WHERE student_id = ? ORDER BY due_date DESC', [req.user.id]);
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

app.get('/api/me', authenticateToken, (req, res) => {
    res.json(req.user);
});

// --- Notifications ---
app.get('/api/notifications/unread', authenticateToken, async (req, res) => {
    try {
        const db = await getDB();
        // Simple logic: return total count of notices in last 24 hrs
        const count = await db.get("SELECT COUNT(*) as count FROM notices WHERE created_at >= datetime('now', '-1 day')");
        res.json({ count: count.count || 0 });
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

// --- Quizzes ---
app.post('/api/quizzes', authenticateToken, requireRole('teacher'), async (req, res) => {
    const { title, class_name, questions } = req.body;
    try {
        const db = await getDB();
        const quizId = crypto.randomUUID();
        await db.run('INSERT INTO quizzes (id, title, class_name, created_by) VALUES (?, ?, ?, ?)', 
            [quizId, title, class_name || 'General', req.user.id]);
        
        if (questions && questions.length > 0) {
            for (const q of questions) {
                await db.run('INSERT INTO quiz_questions (id, quiz_id, question, option_a, option_b, option_c, option_d, correct_option) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                    [crypto.randomUUID(), quizId, q.question, q.option_a, q.option_b, q.option_c, q.option_d, q.correct_option]);
            }
        }
        res.status(201).json({ message: "Quiz created successfully", quizId });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Internal server error" });
    }
});

app.get('/api/quizzes', authenticateToken, async (req, res) => {
    try {
        const db = await getDB();
        let quizzes;
        if (req.user.role === 'student') {
            quizzes = await db.all("SELECT * FROM quizzes WHERE class_name = ? OR class_name = 'General' ORDER BY created_at DESC", [req.user.class_name]);
        } else {
            quizzes = await db.all('SELECT * FROM quizzes ORDER BY created_at DESC');
        }
        res.json(quizzes);
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

app.get('/api/quizzes/:id/questions', authenticateToken, async (req, res) => {
    try {
        const db = await getDB();
        const questions = await db.all('SELECT id, quiz_id, question, option_a, option_b, option_c, option_d FROM quiz_questions WHERE quiz_id = ?', [req.params.id]);
        res.json(questions);
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

app.post('/api/quizzes/:id/submit', authenticateToken, async (req, res) => {
    const { answers } = req.body; // { question_id: 'A', ... }
    if (req.user.role !== 'student') return res.status(403).json({ error: "Only students can submit quizzes" });
    
    try {
        const db = await getDB();
        const questions = await db.all('SELECT id, correct_option FROM quiz_questions WHERE quiz_id = ?', [req.params.id]);
        
        let score = 0;
        const total_marks = questions.length;
        
        questions.forEach(q => {
            if (answers[q.id] === q.correct_option) {
                score += 1;
            }
        });
        
        const resultId = crypto.randomUUID();
        await db.run('INSERT INTO quiz_results (id, quiz_id, student_id, score, total_marks) VALUES (?, ?, ?, ?, ?)',
            [resultId, req.params.id, req.user.id, score, total_marks]);
        
        res.json({ score, total_marks, message: "Quiz submitted successfully" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Internal server error" });
    }
});

app.get('/api/student/quiz-results', authenticateToken, async (req, res) => {
    try {
        const db = await getDB();
        const results = await db.all(`
            SELECT qr.*, q.title 
            FROM quiz_results qr 
            JOIN quizzes q ON qr.quiz_id = q.id 
            WHERE qr.student_id = ? 
            ORDER BY qr.taken_at DESC
        `, [req.user.id]);
        res.json(results);
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

app.delete('/api/quizzes/:id', authenticateToken, requireRole('teacher'), async (req, res) => {
    try {
        const db = await getDB();
        await db.run('DELETE FROM quizzes WHERE id = ?', [req.params.id]);
        res.json({ message: "Quiz deleted successfully" });
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

// --- Dashboard Stats ---
app.get('/api/dashboard/stats', authenticateToken, requireRole('teacher'), async (req, res) => {
    try {
        const { date } = req.query;
        const db = await getDB();
        
        const studentsCount = await db.get('SELECT COUNT(*) as count FROM students');
        
        let presentToday = 0;
        if (date) {
            const todayStats = await db.get(`
                SELECT COUNT(*) as present_count 
                FROM attendance 
                WHERE date = ? AND status = 'present'
            `, [date]);
            presentToday = todayStats ? todayStats.present_count : 0;
        }

        res.json({
            totalStudents: studentsCount.count,
            presentToday: presentToday,
            latestExamAverage: 'N/A'
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Internal server error" });
    }
});

// --- WebRTC Signaling (Socket.io) ---
let broadcasterSocketId = null;

io.on('connection', (socket) => {
    socket.on('broadcaster', (data) => {
        broadcasterSocketId = socket.id;
        socket.join(data.room);
        socket.broadcast.emit('broadcaster');
    });

    socket.on('watcher', (data) => {
        socket.join(data.room);
        if (broadcasterSocketId) {
            socket.to(broadcasterSocketId).emit('watcher', socket.id, data.name);
        }
    });

    socket.on('offer', (id, message) => {
        socket.to(id).emit('offer', socket.id, message);
    });

    socket.on('answer', (id, message) => {
        socket.to(id).emit('answer', socket.id, message);
    });

    socket.on('candidate', (id, message) => {
        socket.to(id).emit('candidate', socket.id, message);
    });

    socket.on('reaction', (data) => {
        io.to(data.room).emit('reaction', { emoji: data.emoji, sender: socket.id });
    });

    socket.on('force-mute', (data) => {
        socket.to(data.targetId).emit('force-mute', data.mute);
    });

    socket.on('disconnect', () => {
        if (socket.id === broadcasterSocketId) {
            broadcasterSocketId = null;
            socket.broadcast.emit('broadcaster-disconnected');
        } else {
            if (broadcasterSocketId) {
                socket.to(broadcasterSocketId).emit('disconnectPeer', socket.id);
            }
        }
    });
});

const PORT = process.env.PORT || 5000;

if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    initDB().then(() => {
        server.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
            console.log("SQLite Database Initialized and Ready.");
        });
    }).catch(err => {
        console.error("Failed to initialize database:", err);
    });
} else {
    // In serverless environments, initialize the DB asynchronously and export the app
    initDB().catch(err => console.error("Failed to initialize database:", err));
}

module.exports = app;
