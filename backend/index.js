require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const multer = require('multer');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const supabase = require('./config/supabase');
const { authenticateToken, requireRole } = require('./middleware/auth');

const app = express();
const server = http.createServer(app);

const allowedOrigins = [
    process.env.FRONTEND_URL,
    'https://apcoachingclasses.vercel.app',
    'http://localhost:5173',
    'http://localhost:3000'
].filter(Boolean);

app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            // Fallback for Vercel preview URLs or generic access if FRONTEND_URL is not perfectly matching
            callback(null, true);
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Root route to check if backend is running
app.get('/', (req, res) => {
    res.json({ message: "A.P. Coaching Classes Backend is running successfully! 🚀" });
});

// We are keeping multer to MemoryStorage for Vercel compatibility.
// We will upload directly to Supabase storage.
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Helper function to upload file to Supabase Storage
async function uploadToSupabase(file, bucketName) {
    const fileName = `${Date.now()}_${file.originalname.replace(/\s+/g, '_')}`;
    const { data, error } = await supabase.storage
        .from(bucketName)
        .upload(fileName, file.buffer, {
            contentType: file.mimetype,
            upsert: false
        });
    if (error) throw error;
    
    const { data: publicUrlData } = supabase.storage.from(bucketName).getPublicUrl(fileName);
    return publicUrlData.publicUrl;
}

// --- Authentication Routes ---
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const { data: user, error: userError } = await supabase.from('users').select('*').eq('email', email).maybeSingle();
        if (userError) throw userError;
        if (!user) return res.status(401).json({ error: "Invalid email or password" });

        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) return res.status(401).json({ error: "Invalid email or password" });

        if (user.role === 'student' && !user.is_approved) {
            return res.status(403).json({ error: "Your account is pending teacher approval." });
        }

        const sessionId = crypto.randomBytes(16).toString('hex');
        await supabase.from('users').update({ active_session_id: sessionId }).eq('id', user.id);

        let className = 'General';
        let fullName = '';
        if (user.role === 'student') {
            const { data: studentInfo } = await supabase.from('students').select('class_name, full_name').eq('id', user.id).maybeSingle();
            if (studentInfo) {
                if (studentInfo.class_name) className = studentInfo.class_name;
                if (studentInfo.full_name) fullName = studentInfo.full_name;
            }
        } else if (user.role === 'teacher') {
            if (user.email === 'prajapatianil1975@gmail.com') fullName = 'Anil Kumar Prajapati';
            else fullName = 'Admin / Principal';
        }

        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role, sessionId: sessionId, class_name: className, full_name: fullName },
            process.env.JWT_SECRET || 'secret',
            { expiresIn: '24h' }
        );

        res.json({ token, role: user.role, email: user.email, id: user.id, class_name: className, full_name: fullName });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Internal server error" });
    }
});

app.post('/api/auth/register', async (req, res) => {
    const { email, password, fullName, fatherName, phone, class_name } = req.body;
    try {
        const { data: existing } = await supabase.from('users').select('*').eq('email', email).maybeSingle();
        if (existing) return res.status(400).json({ error: "Email already registered" });

        const hashedPassword = await bcrypt.hash(password, 10);
        const userId = crypto.randomUUID();
        
        const { error: insertUserErr } = await supabase.from('users').insert({ 
            id: userId, email, password_hash: hashedPassword, 
            role: 'student', is_approved: false 
        });
        if (insertUserErr) throw insertUserErr;
        
        const { error: insertStudentErr } = await supabase.from('students').insert({ 
            id: userId, full_name: fullName, father_name: fatherName, 
            phone, class_name: class_name || 'General' 
        });
        if (insertStudentErr) throw insertStudentErr;

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
        const hashedPassword = await bcrypt.hash(password, 10);
        const userId = crypto.randomUUID();
        
        await supabase.from('users').insert({ 
            id: userId, email, password_hash: hashedPassword, 
            role: 'student', is_approved: true 
        });
        await supabase.from('students').insert({ 
            id: userId, full_name: fullName, father_name: fatherName, 
            phone, class_name: class_name || 'General' 
        });

        const { data: studentData } = await supabase.from('students').select('*').eq('id', userId).maybeSingle();
        res.status(201).json({ message: "Student created successfully", student: studentData });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Internal server error" });
    }
});

app.get('/api/students', authenticateToken, requireRole('teacher'), async (req, res) => {
    try {
        // In Supabase, we can use relations
        const { data: students, error } = await supabase
            .from('students')
            .select('*, users!inner(email, is_approved)');
        
        if (error) throw error;

        const formatted = students.map(s => ({
            id: s.id, full_name: s.full_name, father_name: s.father_name, phone: s.phone, 
            enrollment_date: s.enrollment_date, class_name: s.class_name, 
            is_approved: s.users.is_approved,
            users: { email: s.users.email }
        }));
        res.json(formatted);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Internal server error" });
    }
});

app.delete('/api/students/:id', authenticateToken, requireRole('teacher'), async (req, res) => {
    try {
        await supabase.from('users').delete().eq('id', req.params.id);
        res.json({ message: "Student deleted successfully" });
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

app.put('/api/students/:id', authenticateToken, requireRole('teacher'), async (req, res) => {
    const { email, password, fullName, fatherName, phone, class_name } = req.body;
    try {
        if (email) await supabase.from('users').update({ email }).eq('id', req.params.id);
        if (password) {
            const hash = await bcrypt.hash(password, 10);
            await supabase.from('users').update({ password_hash: hash }).eq('id', req.params.id);
        }
        
        let studentUpdate = {};
        if (fullName) studentUpdate.full_name = fullName;
        if (fatherName !== undefined) studentUpdate.father_name = fatherName;
        if (phone !== undefined) studentUpdate.phone = phone;
        if (class_name) studentUpdate.class_name = class_name;
        
        if (Object.keys(studentUpdate).length > 0) {
            await supabase.from('students').update(studentUpdate).eq('id', req.params.id);
        }
        
        res.json({ message: "Student updated successfully" });
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

app.put('/api/students/:id/approve', authenticateToken, requireRole('teacher'), async (req, res) => {
    try {
        await supabase.from('users').update({ is_approved: true }).eq('id', req.params.id);
        res.json({ message: "Student approved successfully" });
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

app.post('/api/students/bulk-delete', authenticateToken, requireRole('teacher'), async (req, res) => {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: "No ids provided" });
    try {
        await supabase.from('users').delete().in('id', ids);
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
        const fileUrl = await uploadToSupabase(file, 'notes');
        const noteId = crypto.randomUUID();
        
        await supabase.from('notes').insert({ 
            id: noteId, title, description, file_url: fileUrl, 
            class_name: class_name || 'General', subject: subject || 'General', created_by: req.user.id 
        });
        
        const { data: noteData } = await supabase.from('notes').select('*').eq('id', noteId).maybeSingle();
        res.status(201).json({ message: "Note uploaded successfully", note: noteData });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Internal server error" });
    }
});

app.get('/api/notes', authenticateToken, async (req, res) => {
    try {
        let query = supabase.from('notes').select('*').order('created_at', { ascending: false });
        if (req.user.role === 'student') {
            query = query.in('class_name', [req.user.class_name, 'General']);
        }
        const { data: notes, error } = await query;
        if (error) throw error;
        res.json(notes);
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

app.delete('/api/notes/:id', authenticateToken, requireRole('teacher'), async (req, res) => {
    try {
        await supabase.from('notes').delete().eq('id', req.params.id);
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
        let englishUrl = '';
        let hindiUrl = '';
        
        if (englishFile) englishUrl = await uploadToSupabase(englishFile, 'books');
        if (hindiFile) hindiUrl = await uploadToSupabase(hindiFile, 'books');
        
        const bookId = crypto.randomUUID();
        
        await supabase.from('books').insert({ 
            id: bookId, title, author, file_url: englishUrl, file_url_hindi: hindiUrl, 
            class_name: class_name || 'General', created_by: req.user.id 
        });
        
        const { data: bookData } = await supabase.from('books').select('*').eq('id', bookId).maybeSingle();
        res.status(201).json({ message: "Book uploaded successfully", book: bookData });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Internal server error" });
    }
});

app.get('/api/books', authenticateToken, async (req, res) => {
    try {
        let query = supabase.from('books').select('*').order('created_at', { ascending: false });
        if (req.user.role === 'student') {
            query = query.in('class_name', [req.user.class_name, 'General']);
        }
        const { data: books, error } = await query;
        if (error) throw error;
        
        // Static NCERT Books
        let ncertBooks = [
            { id: 'ncert-8-math', title: 'Class 8 NCERT Mathematics', author: 'NCERT', file_url: 'https://ncert.nic.in/textbook.php?hemh1=0-16', file_url_hindi: 'https://ncert.nic.in/textbook.php?hhmh1=0-16', created_at: new Date().toISOString(), class_name: '8' },
            { id: 'ncert-8-sci', title: 'Class 8 NCERT Science', author: 'NCERT', file_url: 'https://ncert.nic.in/textbook.php?hesc1=0-13', file_url_hindi: 'https://ncert.nic.in/textbook.php?hhsc1=0-13', created_at: new Date().toISOString(), class_name: '8' },
            { id: 'ncert-8-eng', title: 'Class 8 NCERT English', author: 'NCERT', file_url: 'https://ncert.nic.in/textbook.php?hehd1=0-10', file_url_hindi: '', created_at: new Date().toISOString(), class_name: '8' },
            { id: 'ncert-8-hin', title: 'Class 8 NCERT Hindi', author: 'NCERT', file_url: '', file_url_hindi: 'https://ncert.nic.in/textbook.php?hhvs1=0-18', created_at: new Date().toISOString(), class_name: '8' },
            { id: 'ncert-8-sst', title: 'Class 8 NCERT Social Science', author: 'NCERT', file_url: 'https://ncert.nic.in/textbook.php?hess1=0-6', file_url_hindi: 'https://ncert.nic.in/textbook.php?hhss1=0-6', created_at: new Date().toISOString(), class_name: '8' },
            { id: 'ncert-9-math', title: 'Class 9 NCERT Mathematics', author: 'NCERT', file_url: 'https://ncert.nic.in/textbook.php?iemh1=0-12', file_url_hindi: 'https://ncert.nic.in/textbook.php?ihmh1=0-12', created_at: new Date().toISOString(), class_name: '9' },
            { id: 'ncert-9-sci', title: 'Class 9 NCERT Science', author: 'NCERT', file_url: 'https://ncert.nic.in/textbook.php?iesc1=0-15', file_url_hindi: 'https://ncert.nic.in/textbook.php?ihsc1=0-15', created_at: new Date().toISOString(), class_name: '9' },
            { id: 'ncert-9-eng', title: 'Class 9 NCERT English', author: 'NCERT', file_url: 'https://ncert.nic.in/textbook.php?iebe1=0-11', file_url_hindi: '', created_at: new Date().toISOString(), class_name: '9' },
            { id: 'ncert-9-hin', title: 'Class 9 NCERT Hindi', author: 'NCERT', file_url: '', file_url_hindi: 'https://ncert.nic.in/textbook.php?ihks1=0-17', created_at: new Date().toISOString(), class_name: '9' },
            { id: 'ncert-9-sst', title: 'Class 9 NCERT Social Science', author: 'NCERT', file_url: 'https://ncert.nic.in/textbook.php?iess1=0-5', file_url_hindi: 'https://ncert.nic.in/textbook.php?ihss1=0-5', created_at: new Date().toISOString(), class_name: '9' },
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
        await supabase.from('books').delete().eq('id', req.params.id);
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
        const noticeId = crypto.randomUUID();
        await supabase.from('notices').insert({ id: noticeId, title, content, created_by: req.user.id });
        const { data } = await supabase.from('notices').select('*').eq('id', noticeId).maybeSingle();
        res.status(201).json({ message: "Notice created successfully", notice: data });
    } catch (err) {
        console.error("Notice creation error:", err);
        res.status(500).json({ error: err.message || "Internal server error" });
    }
});

app.get('/api/notices', authenticateToken, async (req, res) => {
    try {
        const { data: notices } = await supabase.from('notices').select('*').order('created_at', { ascending: false });
        res.json(notices || []);
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

app.delete('/api/notices/:id', authenticateToken, requireRole('teacher'), async (req, res) => {
    try {
        await supabase.from('notices').delete().eq('id', req.params.id);
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
        await supabase.from('attendance').delete().eq('date', date);
        
        const inserts = records.map(r => ({
            id: crypto.randomUUID(),
            student_id: r.student_id,
            date,
            status: r.status,
            marked_by: req.user.id
        }));
        
        await supabase.from('attendance').insert(inserts);
        res.status(201).json({ message: "Attendance saved successfully" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Internal server error" });
    }
});

app.get('/api/attendance', authenticateToken, requireRole('teacher'), async (req, res) => {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: "Date is required" });

    try {
        const { data } = await supabase.from('attendance').select('*').eq('date', date);
        res.json(data || []);
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

app.get('/api/attendance/report', authenticateToken, requireRole('teacher'), async (req, res) => {
    const { month, year } = req.query;
    try {
        let query = supabase.from('attendance').select('*, students!inner(full_name)').order('date', { ascending: false });
        
        if (month && year) {
            const paddedMonth = month.padStart(2, '0');
            const startDate = `${year}-${paddedMonth}-01`;
            const nextMonth = parseInt(month) === 12 ? 1 : parseInt(month) + 1;
            const nextYear = parseInt(month) === 12 ? parseInt(year) + 1 : parseInt(year);
            const endDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
            query = query.gte('date', startDate).lt('date', endDate);
        }
        
        const { data, error } = await query;
        if (error) throw error;
        
        const formatted = (data || []).map(d => ({ ...d, full_name: d.students.full_name }));
        res.json(formatted);
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

app.get('/api/attendance/student/:student_id', authenticateToken, requireRole('teacher'), async (req, res) => {
    try {
        const { data } = await supabase.from('attendance').select('*').eq('student_id', req.params.student_id).order('date', { ascending: false });
        res.json(data || []);
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

app.put('/api/attendance/:id', authenticateToken, requireRole('teacher'), async (req, res) => {
    const { status } = req.body;
    try {
        await supabase.from('attendance').update({ status }).eq('id', req.params.id);
        res.json({ message: "Attendance updated" });
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

app.get('/api/student/attendance', authenticateToken, async (req, res) => {
    try {
        const { data } = await supabase.from('attendance').select('*').eq('student_id', req.user.id).order('date', { ascending: false });
        res.json(data || []);
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

// --- Results ---
app.post('/api/results', authenticateToken, requireRole('teacher'), async (req, res) => {
    const { student_id, exam_name, marks_data, date, status } = req.body;
    try {
        let finalExamName = exam_name;
        if (marks_data && Array.isArray(marks_data)) {
            finalExamName = `__MARKS__${exam_name}__JSON__${JSON.stringify(marks_data)}`;
        }
        await supabase.from('results').insert({
            id: crypto.randomUUID(), student_id, exam_name: finalExamName, date, 
            created_by: req.user.id, total_marks: 0, marks_obtained: 0, status: status || 'Pass'
        });
        res.status(201).json({ message: "Result added" });
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

app.get('/api/results', authenticateToken, requireRole('teacher'), async (req, res) => {
    try {
        const { data: results, error } = await supabase
            .from('results')
            .select('*, students!inner(full_name, users!inner(email))')
            .order('date', { ascending: false });
            
        if (error) throw error;
        
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
            r.students = { full_name: r.students.full_name, users: { email: r.students.users.email } };
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
        await supabase.from('results').delete().eq('id', req.params.id);
        res.json({ message: "Result deleted" });
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

app.get('/api/student/results', authenticateToken, async (req, res) => {
    try {
        const { data: results } = await supabase.from('results').select('*').eq('student_id', req.user.id).order('date', { ascending: false });
        
        const processedData = (results || []).map(r => {
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
        const { error } = await supabase.from('fees').insert({
            id: crypto.randomUUID(), student_id, amount, status, due_date, paid_date, recorded_by: req.user.id
        });
        if (error) return res.status(400).json({ error: error.message });
        res.status(201).json({ message: "Fee record added" });
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

app.get('/api/fees', authenticateToken, requireRole('teacher'), async (req, res) => {
    try {
        const { data: fees, error } = await supabase
            .from('fees')
            .select('*, students!inner(full_name, users!inner(email))')
            .order('due_date', { ascending: false });
            
        if (error) throw error;
        
        const formatted = fees.map(f => {
            f.students = { full_name: f.students.full_name, users: { email: f.students.users.email } };
            return f;
        });
        res.json(formatted);
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

app.delete('/api/fees/:id', authenticateToken, requireRole('teacher'), async (req, res) => {
    try {
        await supabase.from('fees').delete().eq('id', req.params.id);
        res.json({ message: "Fee record deleted" });
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

app.put('/api/fees/:id', authenticateToken, requireRole('teacher'), async (req, res) => {
    const { student_id, amount, status, due_date, paid_date } = req.body;
    try {
        const { error } = await supabase.from('fees').update({ student_id, amount, status, due_date, paid_date }).eq('id', req.params.id);
        if (error) return res.status(400).json({ error: error.message });
        res.json({ message: "Fee record updated" });
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

app.get('/api/student/fees', authenticateToken, async (req, res) => {
    try {
        const { data } = await supabase.from('fees').select('*').eq('student_id', req.user.id).order('due_date', { ascending: false });
        res.json(data || []);
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
        const yesterday = new Date(Date.now() - 24*60*60*1000).toISOString();
        const { count, error } = await supabase.from('notices').select('*', { count: 'exact', head: true }).gte('created_at', yesterday);
        res.json({ count: count || 0 });
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

// --- Quizzes ---
app.post('/api/quizzes', authenticateToken, requireRole('teacher'), async (req, res) => {
    const { title, class_name, questions } = req.body;
    try {
        const quizId = crypto.randomUUID();
        await supabase.from('quizzes').insert({ id: quizId, title, class_name: class_name || 'General', created_by: req.user.id });
        
        if (questions && questions.length > 0) {
            const questionInserts = questions.map(q => ({
                id: crypto.randomUUID(), quiz_id: quizId, question: q.question, 
                option_a: q.option_a, option_b: q.option_b, option_c: q.option_c, 
                option_d: q.option_d, correct_option: q.correct_option
            }));
            await supabase.from('quiz_questions').insert(questionInserts);
        }
        res.status(201).json({ message: "Quiz created successfully", quizId });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Internal server error" });
    }
});

app.get('/api/quizzes', authenticateToken, async (req, res) => {
    try {
        let query = supabase.from('quizzes').select('*').order('created_at', { ascending: false });
        if (req.user.role === 'student') {
            query = query.in('class_name', [req.user.class_name, 'General']);
        }
        const { data } = await query;
        res.json(data || []);
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

app.get('/api/quizzes/:id/questions', authenticateToken, async (req, res) => {
    try {
        const { data } = await supabase.from('quiz_questions').select('id, quiz_id, question, option_a, option_b, option_c, option_d').eq('quiz_id', req.params.id);
        res.json(data || []);
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

app.post('/api/quizzes/:id/submit', authenticateToken, async (req, res) => {
    const { answers } = req.body; 
    if (req.user.role !== 'student') return res.status(403).json({ error: "Only students can submit quizzes" });
    
    try {
        const { data: questions } = await supabase.from('quiz_questions').select('id, correct_option').eq('quiz_id', req.params.id);
        
        let score = 0;
        const total_marks = (questions || []).length;
        
        (questions || []).forEach(q => {
            if (answers[q.id] === q.correct_option) score += 1;
        });
        
        await supabase.from('quiz_results').insert({
            id: crypto.randomUUID(), quiz_id: req.params.id, student_id: req.user.id, score, total_marks
        });
        
        res.json({ score, total_marks, message: "Quiz submitted successfully" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Internal server error" });
    }
});

app.get('/api/student/quiz-results', authenticateToken, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('quiz_results')
            .select('*, quizzes!inner(title)')
            .eq('student_id', req.user.id)
            .order('taken_at', { ascending: false });
            
        if (error) throw error;
        
        const formatted = data.map(r => ({ ...r, title: r.quizzes.title }));
        res.json(formatted);
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

app.delete('/api/quizzes/:id', authenticateToken, requireRole('teacher'), async (req, res) => {
    try {
        await supabase.from('quizzes').delete().eq('id', req.params.id);
        res.json({ message: "Quiz deleted successfully" });
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

// --- Dashboard Stats ---
app.get('/api/dashboard/stats', authenticateToken, requireRole('teacher'), async (req, res) => {
    try {
        const { date } = req.query;
        
        const { count: studentsCount } = await supabase.from('students').select('*', { count: 'exact', head: true });
        
        let presentToday = 0;
        if (date) {
            const { count } = await supabase.from('attendance').select('*', { count: 'exact', head: true }).eq('date', date).eq('status', 'present');
            presentToday = count || 0;
        }

        res.json({
            totalStudents: studentsCount || 0,
            presentToday: presentToday,
            latestExamAverage: 'N/A'
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Internal server error" });
    }
});

// --- Live Class Status (Stored as a special Notice to avoid DB changes) ---
app.get('/api/live-class', authenticateToken, async (req, res) => {
    try {
        const { data: notice } = await supabase.from('notices').select('*').eq('title', '__LIVE_CLASS_STATUS__').maybeSingle();
        if (notice && notice.content) {
            try {
                const statusData = JSON.parse(notice.content);
                return res.json(statusData);
            } catch (e) {
                return res.json({ isActive: false, link: '' });
            }
        }
        res.json({ isActive: false, link: '' });
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

app.post('/api/live-class', authenticateToken, requireRole('teacher'), async (req, res) => {
    const { isActive, link } = req.body;
    try {
        const content = JSON.stringify({ isActive, link });
        const { data: existing } = await supabase.from('notices').select('*').eq('title', '__LIVE_CLASS_STATUS__').maybeSingle();
        
        if (existing) {
            await supabase.from('notices').update({ content }).eq('id', existing.id);
        } else {
            await supabase.from('notices').insert({ 
                id: crypto.randomUUID(), 
                title: '__LIVE_CLASS_STATUS__', 
                content, 
                created_by: req.user.id 
            });
        }
        res.json({ message: "Live class status updated successfully" });
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

// --- Quizzes ---
app.post('/api/quizzes/generate', authenticateToken, requireRole('teacher'), async (req, res) => {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "Prompt is required" });
    if (!process.env.GEMINI_API_KEY) return res.status(500).json({ error: "Gemini API Key is not configured." });

    try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-3.6-flash" });

const systemPrompt = `You are a helpful teaching assistant that generates multiple-choice quizzes.
Generate a concise quiz (maximum 5 questions unless specified otherwise) based on the user's prompt to ensure fast generation.
You MUST respond with ONLY a raw JSON array of objects.
Do NOT include markdown formatting like \`\`\`json or \`\`\`.
Each object must have exactly these keys:
- question (string)
- option_a (string)
- option_b (string)
- option_c (string)
- option_d (string)
- correct_option (string, must be exactly "A", "B", "C", or "D")`;

        const result = await model.generateContent(`${systemPrompt}\n\nUser Prompt: ${prompt}`);
        let responseText = result.response.text().trim();
        
        if (responseText.startsWith('```json')) {
            responseText = responseText.replace(/```json\n?/, '').replace(/```\n?$/, '');
        } else if (responseText.startsWith('```')) {
            responseText = responseText.replace(/```\n?/, '').replace(/```\n?$/, '');
        }

        const questions = JSON.parse(responseText);
        res.json(questions);
    } catch (err) {
        console.error("AI Generation Error:", err);
        res.status(500).json({ error: "Failed to generate quiz with AI." });
    }
});

const PORT = process.env.PORT || 5000;

if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    server.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
        console.log("Supabase Client Initialized and Ready.");
    });
}

module.exports = app;
