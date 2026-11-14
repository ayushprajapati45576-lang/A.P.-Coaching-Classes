require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const multer = require('multer');
const path = require('path');
const zlib = require('zlib');
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

// High-performance native Gzip compression for API responses > 1KB
app.use((req, res, next) => {
    const acceptEncoding = req.headers['accept-encoding'] || '';
    if (!acceptEncoding.includes('gzip')) return next();

    const originalJson = res.json;
    res.json = function (obj) {
        try {
            const bodyStr = JSON.stringify(obj);
            if (bodyStr.length > 1024) {
                res.setHeader('Content-Type', 'application/json; charset=utf-8');
                res.setHeader('Content-Encoding', 'gzip');
                res.setHeader('Vary', 'Accept-Encoding');
                zlib.gzip(Buffer.from(bodyStr), (err, compressed) => {
                    if (err) {
                        res.removeHeader('Content-Encoding');
                        return originalJson.call(this, obj);
                    }
                    res.setHeader('Content-Length', compressed.length);
                    res.send(compressed);
                });
                return this;
            }
        } catch (e) {}
        return originalJson.call(this, obj);
    };
    next();
});

// Root route to check if backend is running
app.get('/', (req, res) => {
    res.json({ message: "A.P. Coaching Classes Backend is running successfully! 🚀" });
});

// We are keeping multer to MemoryStorage for Vercel compatibility.
// We will upload directly to Supabase storage.
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Helper function to upload file to Supabase Storage with auto-retry
async function uploadToSupabase(file, bucketName, maxRetries = 2) {
    const ext = path.extname(file.originalname || '').toLowerCase() || '.pdf';
    const rawBase = path.basename(file.originalname || 'file', ext);
    // Sanitize: allow only safe alphanumeric, underscore, hyphen
    const safeBase = rawBase
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .replace(/_+/g, '_')
        .slice(0, 40);
    const fileName = `${Date.now()}_${safeBase || 'note'}${ext}`;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const { data, error } = await supabase.storage
                .from(bucketName)
                .upload(fileName, file.buffer, {
                    contentType: file.mimetype || 'application/pdf',
                    upsert: true
                });

            if (error) {
                if (error.statusCode === '413' || error.message?.includes('exceeded the maximum allowed size')) {
                    throw new Error('File exceeds the 20 MB cloud storage limit. Please compress your PDF below 20 MB.');
                }
                throw new Error(error.message || 'File upload to cloud storage failed');
            }
            
            const { data: publicUrlData } = supabase.storage.from(bucketName).getPublicUrl(fileName);
            return publicUrlData.publicUrl;
        } catch (err) {
            console.error(`Upload to [${bucketName}] attempt ${attempt} failed:`, err.message);
            if (attempt === maxRetries || err.message?.includes('20 MB')) {
                throw err;
            }
            // Wait 1 second before retrying transient network errors like ECONNRESET
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
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

        let className = 'General';
        let fullName = '';
        if (user.role === 'student') {
            if (!user.is_approved) {
                return res.status(403).json({ error: "Your account is pending teacher approval." });
            }

            // Check if student is inactive / left
            const statuses = await getStudentEnrollmentStatuses();
            const { data: studentInfo } = await supabase
                .from('students')
                .select('enrollment_status, class_name, full_name')
                .eq('id', user.id)
                .maybeSingle();

            const rawStatus = studentInfo?.enrollment_status || statuses[user.id] || 'active';
            const isInactive = rawStatus === 'inactive' || rawStatus === 'leave';

            if (isInactive) {
                return res.status(403).json({ 
                    error: "Aapka account inactive / suspended kar diya gaya hai. Kripya coaching institute / teacher se sampark karein." 
                });
            }

            if (studentInfo) {
                if (studentInfo.class_name) className = studentInfo.class_name;
                if (studentInfo.full_name) fullName = studentInfo.full_name;
            }
        } else if (user.role === 'teacher') {
            const emailPrefix = user.email.split('@')[0];
            fullName = emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1);
        }

        const sessionId = crypto.randomBytes(16).toString('hex');
        await supabase.from('users').update({ active_session_id: sessionId }).eq('id', user.id);

        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role, sessionId: sessionId, class_name: className, full_name: fullName },
            process.env.JWT_SECRET || 'secret',
            { expiresIn: '24h' }
        );

        res.json({ token, role: user.role, email: user.email, id: user.id, class_name: className, full_name: fullName });
    } catch (err) {
        console.error("Error in POST /api/notes:", err);
        res.status(500).json({ error: err.message || "Internal server error" });
    }
});

app.post('/api/auth/register', async (req, res) => {
    const { email, password, fullName, fatherName, phone, class_name, batch } = req.body;
    try {
        if (!email || !email.trim()) {
            return res.status(400).json({ error: "Email is required" });
        }
        if (!password) {
            return res.status(400).json({ error: "Password is required" });
        }

        const cleanEmail = email.trim().toLowerCase();
        const { data: existing, error: checkErr } = await supabase.from('users').select('id').ilike('email', cleanEmail).maybeSingle();
        if (checkErr) throw checkErr;
        if (existing) {
            return res.status(400).json({ error: "Email already registered. Please login or use a different email." });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const userId = crypto.randomUUID();
        
        const { error: insertUserErr } = await supabase.from('users').insert({ 
            id: userId, email: cleanEmail, password_hash: hashedPassword, 
            role: 'student', is_approved: false 
        });
        if (insertUserErr) {
            if (insertUserErr.code === '23505' || (insertUserErr.message && insertUserErr.message.toLowerCase().includes('unique'))) {
                return res.status(400).json({ error: "Email already registered. Please login or use a different email." });
            }
            throw insertUserErr;
        }
        
        const cleanBatch = ['Morning', 'Evening', 'Both'].includes(batch) ? batch : 'Both';
        let insertStudentErr = null;
        try {
            const resInsert = await supabase.from('students').insert({ 
                id: userId, full_name: fullName, father_name: fatherName, 
                phone, class_name: class_name || 'General',
                batch: cleanBatch
            });
            insertStudentErr = resInsert.error;
        } catch (e) {
            insertStudentErr = e;
        }

        if (insertStudentErr) {
            const { error: fallbackErr } = await supabase.from('students').insert({ 
                id: userId, full_name: fullName, father_name: fatherName, 
                phone, class_name: class_name || 'General' 
            });
            if (fallbackErr) throw fallbackErr;
        }

        await setStudentBatch(userId, cleanBatch);

        res.status(201).json({ message: "Registration successful, pending teacher approval" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message || "Internal server error" });
    }
});

// --- Students ---
app.post('/api/students', authenticateToken, requireRole('teacher'), async (req, res) => {
    const { email, password, fullName, fatherName, phone, class_name, batch } = req.body;
    try {
        if (!email || !email.trim()) {
            return res.status(400).json({ error: "Email is required" });
        }
        if (!password) {
            return res.status(400).json({ error: "Password is required" });
        }

        const cleanEmail = email.trim().toLowerCase();

        // 1. Check if email already exists in users table
        const { data: existingUser, error: checkErr } = await supabase
            .from('users')
            .select('id, email, role')
            .ilike('email', cleanEmail)
            .maybeSingle();

        if (checkErr) throw checkErr;
        if (existingUser) {
            return res.status(400).json({ error: "Email already registered! This email already exists in the system." });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const userId = crypto.randomUUID();
        
        const { error: insertUserErr } = await supabase.from('users').insert({ 
            id: userId, email: cleanEmail, password_hash: hashedPassword, 
            role: 'student', is_approved: true 
        });
        if (insertUserErr) {
            if (insertUserErr.code === '23505' || (insertUserErr.message && insertUserErr.message.toLowerCase().includes('unique'))) {
                return res.status(400).json({ error: "Email already registered! This email already exists in the system." });
            }
            throw insertUserErr;
        }

        const cleanBatch = ['Morning', 'Evening', 'Both'].includes(batch) ? batch : 'Both';
        let insertStudentErr = null;
        try {
            const resInsert = await supabase.from('students').insert({ 
                id: userId, full_name: fullName, father_name: fatherName, 
                phone, class_name: class_name || 'General',
                batch: cleanBatch
            });
            insertStudentErr = resInsert.error;
        } catch (e) {
            insertStudentErr = e;
        }

        if (insertStudentErr) {
            const { error: fallbackErr } = await supabase.from('students').insert({ 
                id: userId, full_name: fullName, father_name: fatherName, 
                phone, class_name: class_name || 'General' 
            });
            if (fallbackErr) throw fallbackErr;
        }

        await setStudentBatch(userId, cleanBatch, req.user.id);

        const { data: studentData, error: fetchErr } = await supabase.from('students').select('*').eq('id', userId).maybeSingle();
        if (fetchErr) throw fetchErr;

        res.status(201).json({ message: "Student created successfully", student: { ...studentData, batch: cleanBatch } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message || "Internal server error" });
    }
});

// --- High-Performance In-Memory Metadata Cache ---
const CACHE_TTL_MS = 60 * 1000;
let cacheEnrollment = { data: null, expiresAt: 0 };
let cacheBatches = { data: null, expiresAt: 0 };
let cacheFeeConfigs = { data: null, expiresAt: 0 };
let cachePaymentMeta = { data: null, expiresAt: 0 };

// --- Student Status (Active / Inactive) Helpers ---
async function getStudentEnrollmentStatuses() {
    if (cacheEnrollment.data && Date.now() < cacheEnrollment.expiresAt) {
        return cacheEnrollment.data;
    }
    try {
        const { data: notice } = await supabase
            .from('notices')
            .select('*')
            .eq('title', '__STUDENT_ENROLLMENT_STATUS__')
            .maybeSingle();
        if (notice && notice.content) {
            try {
                const parsed = JSON.parse(notice.content);
                cacheEnrollment = { data: parsed, expiresAt: Date.now() + CACHE_TTL_MS };
                return parsed;
            } catch (e) {
                return {};
            }
        }
    } catch (err) {
        console.error("Error fetching student enrollment statuses:", err);
    }
    return {};
}

async function setStudentEnrollmentStatus(studentId, status, teacherUserId) {
    const isInactive = status === 'inactive' || status === 'leave';
    const cleanStatus = isInactive ? 'inactive' : 'active';
    const statuses = await getStudentEnrollmentStatuses();
    statuses[studentId] = cleanStatus;
    cacheEnrollment = { data: statuses, expiresAt: Date.now() + CACHE_TTL_MS };

    const { data: existing } = await supabase
        .from('notices')
        .select('id')
        .eq('title', '__STUDENT_ENROLLMENT_STATUS__')
        .maybeSingle();
    const content = JSON.stringify(statuses);

    if (existing) {
        await supabase.from('notices').update({ content }).eq('id', existing.id);
    } else {
        await supabase.from('notices').insert({
            title: '__STUDENT_ENROLLMENT_STATUS__',
            content,
            created_by: teacherUserId || null
        });
    }

    // Also attempt direct DB column update if available
    try {
        await supabase.from('students').update({ enrollment_status: cleanStatus }).eq('id', studentId);
    } catch (_) {}

    return statuses;
}

// --- Student Batch Helpers (Morning / Evening / Both) ---
async function getStudentBatches() {
    if (cacheBatches.data && Date.now() < cacheBatches.expiresAt) {
        return cacheBatches.data;
    }
    try {
        const { data: notice } = await supabase
            .from('notices')
            .select('*')
            .eq('title', '__STUDENT_BATCHES__')
            .maybeSingle();
        if (notice && notice.content) {
            try {
                const parsed = JSON.parse(notice.content);
                cacheBatches = { data: parsed, expiresAt: Date.now() + CACHE_TTL_MS };
                return parsed;
            } catch (e) {
                return {};
            }
        }
    } catch (err) {
        console.error("Error fetching student batches:", err);
    }
    return {};
}

async function setStudentBatch(studentId, batch, teacherUserId) {
    const cleanBatch = ['Morning', 'Evening', 'Both'].includes(batch) ? batch : 'Both';
    const batches = await getStudentBatches();
    batches[studentId] = cleanBatch;
    cacheBatches = { data: batches, expiresAt: Date.now() + CACHE_TTL_MS };

    const { data: existing } = await supabase
        .from('notices')
        .select('id')
        .eq('title', '__STUDENT_BATCHES__')
        .maybeSingle();
    const content = JSON.stringify(batches);

    if (existing) {
        await supabase.from('notices').update({ content }).eq('id', existing.id);
    } else {
        await supabase.from('notices').insert({
            title: '__STUDENT_BATCHES__',
            content,
            created_by: teacherUserId || null
        });
    }

    try {
        await supabase.from('students').update({ batch: cleanBatch }).eq('id', studentId);
    } catch (_) {}

    return batches;
}

// --- Student Fee Config Helpers (Monthly vs Yearly) ---
async function getStudentFeeConfigs() {
    if (cacheFeeConfigs.data && Date.now() < cacheFeeConfigs.expiresAt) {
        return cacheFeeConfigs.data;
    }
    try {
        const { data: notice } = await supabase
            .from('notices')
            .select('*')
            .eq('title', '__STUDENT_FEE_CONFIGS__')
            .maybeSingle();
        if (notice && notice.content) {
            try {
                const parsed = JSON.parse(notice.content);
                cacheFeeConfigs = { data: parsed, expiresAt: Date.now() + CACHE_TTL_MS };
                return parsed;
            } catch (e) {
                return {};
            }
        }
    } catch (err) {
        console.error("Error fetching student fee configs:", err);
    }
    return {};
}

async function setStudentFeeConfig(studentId, config, teacherUserId) {
    const configs = await getStudentFeeConfigs();
    configs[studentId] = {
        ...(configs[studentId] || {}),
        ...config
    };
    cacheFeeConfigs = { data: configs, expiresAt: Date.now() + CACHE_TTL_MS };

    const { data: existing } = await supabase
        .from('notices')
        .select('id')
        .eq('title', '__STUDENT_FEE_CONFIGS__')
        .maybeSingle();
    const content = JSON.stringify(configs);

    if (existing) {
        await supabase.from('notices').update({ content }).eq('id', existing.id);
    } else {
        await supabase.from('notices').insert({
            title: '__STUDENT_FEE_CONFIGS__',
            content,
            created_by: teacherUserId || null
        });
    }

    try {
        const updateObj = {};
        if (config.fee_type) updateObj.fee_type = config.fee_type;
        if (config.monthly_amount !== undefined) updateObj.monthly_amount = config.monthly_amount;
        if (Object.keys(updateObj).length > 0) {
            await supabase.from('students').update(updateObj).eq('id', studentId);
        }
    } catch (_) {}

    return configs;
}

// Payment metadata helpers (fee_type, month_for)
async function getPaymentMetaMap() {
    if (cachePaymentMeta.data && Date.now() < cachePaymentMeta.expiresAt) {
        return cachePaymentMeta.data;
    }
    try {
        const { data: notice } = await supabase
            .from('notices')
            .select('*')
            .eq('title', '__PAYMENTS_META__')
            .maybeSingle();
        if (notice && notice.content) {
            try {
                const parsed = JSON.parse(notice.content);
                cachePaymentMeta = { data: parsed, expiresAt: Date.now() + CACHE_TTL_MS };
                return parsed;
            } catch (e) {
                return {};
            }
        }
    } catch (err) {
        console.error("Error fetching payment meta:", err);
    }
    return {};
}

async function setPaymentMeta(paymentId, meta, teacherUserId) {
    if (!paymentId) return;
    const metaMap = await getPaymentMetaMap();
    metaMap[paymentId] = {
        ...(metaMap[paymentId] || {}),
        ...meta
    };
    cachePaymentMeta = { data: metaMap, expiresAt: Date.now() + CACHE_TTL_MS };

    const { data: existing } = await supabase
        .from('notices')
        .select('id')
        .eq('title', '__PAYMENTS_META__')
        .maybeSingle();
    const content = JSON.stringify(metaMap);

    if (existing) {
        await supabase.from('notices').update({ content }).eq('id', existing.id);
    } else {
        await supabase.from('notices').insert({
            title: '__PAYMENTS_META__',
            content,
            created_by: teacherUserId || null
        });
    }

    try {
        const updateObj = {};
        if (meta.fee_type) updateObj.fee_type = meta.fee_type;
        if (meta.month_for) updateObj.month_for = meta.month_for;
        if (Object.keys(updateObj).length > 0) {
            await supabase.from('payments').update(updateObj).eq('id', paymentId);
        }
    } catch (_) {}
}

app.get('/api/students', authenticateToken, requireRole('teacher'), async (req, res) => {
    try {
        const [studentsRes, statuses, batches, feeConfigs] = await Promise.all([
            supabase.from('students').select('*, users!inner(email, is_approved)'),
            getStudentEnrollmentStatuses(),
            getStudentBatches(),
            getStudentFeeConfigs()
        ]);
        
        if (studentsRes.error) throw studentsRes.error;
        const students = studentsRes.data || [];

        const formatted = students.map(s => {
            const rawStatus = s.enrollment_status || statuses[s.id] || 'active';
            const status = (rawStatus === 'inactive' || rawStatus === 'leave') ? 'inactive' : 'active';
            const batch = s.batch || batches[s.id] || 'Both';
            const feeCfg = feeConfigs[s.id] || {};
            const feeType = s.fee_type || feeCfg.fee_type || 'Yearly';
            const monthlyAmount = s.monthly_amount !== undefined && s.monthly_amount !== null
                ? Number(s.monthly_amount)
                : (feeCfg.monthly_amount !== undefined && feeCfg.monthly_amount !== null ? Number(feeCfg.monthly_amount) : null);

            return {
                id: s.id, 
                full_name: s.full_name, 
                father_name: s.father_name, 
                phone: s.phone, 
                enrollment_date: s.enrollment_date, 
                class_name: s.class_name, 
                class: s.class_name, 
                total_fees: s.total_fees !== undefined && s.total_fees !== null ? Number(s.total_fees) : null, 
                fees_start_date: s.fees_start_date || feeCfg.fees_start_date || null, 
                fees_due_date: s.fees_due_date || feeCfg.fees_due_date || null, 
                fee_type: feeType, // 'Yearly' | 'Monthly'
                monthly_amount: monthlyAmount,
                is_approved: s.users.is_approved,
                enrollment_status: status, // 'active' or 'inactive'
                batch: batch, // 'Morning', 'Evening', 'Both'
                users: { email: s.users.email }
            };
        });
        res.json(formatted);
    } catch (err) {
        console.error("Error in GET /api/students:", err);
        res.status(500).json({ error: err.message || "Internal server error" });
    }
});

// Update student enrollment status (active | inactive) without deleting data
app.put('/api/students/:id/status', authenticateToken, requireRole('teacher'), async (req, res) => {
    const { status } = req.body;
    const isInactive = status === 'inactive' || status === 'leave';
    const cleanStatus = isInactive ? 'inactive' : 'active';
    try {
        const { data: student, error: fetchErr } = await supabase
            .from('students')
            .select('id, full_name')
            .eq('id', req.params.id)
            .maybeSingle();

        if (fetchErr) throw fetchErr;
        if (!student) return res.status(404).json({ error: "Student not found" });

        await setStudentEnrollmentStatus(req.params.id, cleanStatus, req.user.id);

        if (isInactive) {
            // Invalidate their active session immediately to kick out any logged-in session
            try {
                await supabase.from('users').update({ active_session_id: null }).eq('id', req.params.id);
            } catch (sessErr) {
                console.error("Session invalidation error:", sessErr);
            }
        }

        res.json({
            message: `Student marked as ${cleanStatus === 'inactive' ? 'Inactive' : 'Active'}`,
            id: req.params.id,
            enrollment_status: cleanStatus
        });
    } catch (err) {
        console.error("Error in PUT /api/students/:id/status:", err);
        res.status(500).json({ error: err.message || "Internal server error" });
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
    const { email, password, fullName, fatherName, phone, class_name, batch } = req.body;
    try {
        if (email) {
            const cleanEmail = email.trim().toLowerCase();
            // Check if another user has this email
            const { data: existingUser, error: checkErr } = await supabase
                .from('users')
                .select('id')
                .ilike('email', cleanEmail)
                .neq('id', req.params.id)
                .maybeSingle();

            if (checkErr) throw checkErr;
            if (existingUser) {
                return res.status(400).json({ error: "Email already registered! Another user is already using this email." });
            }

            const { error: emailErr } = await supabase.from('users').update({ email: cleanEmail }).eq('id', req.params.id);
            if (emailErr) {
                if (emailErr.code === '23505' || (emailErr.message && emailErr.message.toLowerCase().includes('unique'))) {
                    return res.status(400).json({ error: "Email already registered! Another user is already using this email." });
                }
                throw emailErr;
            }
        }
        if (password) {
            const hash = await bcrypt.hash(password, 10);
            const { error: passErr } = await supabase.from('users').update({ password_hash: hash }).eq('id', req.params.id);
            if (passErr) throw passErr;
        }
        
        let studentUpdate = {};
        if (fullName) studentUpdate.full_name = fullName;
        if (fatherName !== undefined) studentUpdate.father_name = fatherName;
        if (phone !== undefined) studentUpdate.phone = phone;
        if (class_name) studentUpdate.class_name = class_name;

        if (batch) {
            const cleanBatch = ['Morning', 'Evening', 'Both'].includes(batch) ? batch : 'Both';
            await setStudentBatch(req.params.id, cleanBatch, req.user.id);
        }
        
        if (Object.keys(studentUpdate).length > 0) {
            const { error: studentErr } = await supabase.from('students').update(studentUpdate).eq('id', req.params.id);
            if (studentErr) throw studentErr;
        }
        
        res.json({ message: "Student updated successfully" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message || "Internal server error" });
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
        
        const { error: insertError } = await supabase.from('notes').insert({ 
            id: noteId, 
            title: title || 'Untitled Note', 
            description: description || '', 
            file_url: fileUrl, 
            class_name: class_name || 'General', 
            subject: subject || 'General Notes', 
            created_by: req.user.id 
        });
        
        if (insertError) {
            console.error("Supabase notes insert error:", insertError);
            return res.status(500).json({ error: `Database error: ${insertError.message}` });
        }
        
        const { data: noteData } = await supabase.from('notes').select('*').eq('id', noteId).maybeSingle();
        
        // Auto-broadcast notice for students
        try {
            const noteNoticeId = crypto.randomUUID();
            const noteTitle = `📚 New Study Note: ${title || 'New Material'}`;
            const targetClass = class_name && class_name !== 'General' ? `Class ${class_name}` : 'All Classes';
            const noteContent = `New study material has been added for ${targetClass}${subject ? ' (' + subject + ')' : ''}. Open the Study Notes tab to view!`;
            await supabase.from('notices').insert({
                id: noteNoticeId,
                title: noteTitle,
                content: noteContent,
                created_by: req.user.id
            });
        } catch (noticeErr) {
            console.warn("Could not auto-create notice for note:", noticeErr);
        }

        res.status(201).json({ message: "Note uploaded successfully", note: noteData });
    } catch (err) {
        console.error("Error in POST /api/notes:", err);
        res.status(500).json({ error: err.message || "Internal server error" });
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

        // Auto-broadcast notice for students
        try {
            const bookNoticeId = crypto.randomUUID();
            const bookTitle = `📖 New Book Added: ${title || 'New Book'}`;
            const targetClass = class_name && class_name !== 'General' ? `Class ${class_name}` : 'All Classes';
            const bookContent = `A new textbook/reference book has been added to the Digital Library for ${targetClass}. Check it out in the Digital Library tab!`;
            await supabase.from('notices').insert({
                id: bookNoticeId,
                title: bookTitle,
                content: bookContent,
                created_by: req.user.id
            });
        } catch (noticeErr) {
            console.warn("Could not auto-create notice for book:", noticeErr);
        }

        res.status(201).json({ message: "Book uploaded successfully", book: bookData });
    } catch (err) {
        console.error("Error in POST /api/notes:", err);
        res.status(500).json({ error: err.message || "Internal server error" });
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
            { id: 'ncert-6-math', title: 'Class 6 NCERT Mathematics', author: 'NCERT', file_url: 'https://ncert.nic.in/textbook.php?femh1=0-14', file_url_hindi: 'https://ncert.nic.in/textbook.php?fhmh1=0-14', created_at: new Date().toISOString(), class_name: '6' },
            { id: 'ncert-6-sci', title: 'Class 6 NCERT Science', author: 'NCERT', file_url: 'https://ncert.nic.in/textbook.php?fesc1=0-11', file_url_hindi: 'https://ncert.nic.in/textbook.php?fhsc1=0-11', created_at: new Date().toISOString(), class_name: '6' },
            { id: 'ncert-6-eng', title: 'Class 6 NCERT English', author: 'NCERT', file_url: 'https://ncert.nic.in/textbook.php?fehd1=0-10', file_url_hindi: '', created_at: new Date().toISOString(), class_name: '6' },
            { id: 'ncert-6-hin', title: 'Class 6 NCERT Hindi', author: 'NCERT', file_url: '', file_url_hindi: 'https://ncert.nic.in/textbook.php?fhvs1=0-17', created_at: new Date().toISOString(), class_name: '6' },
            { id: 'ncert-6-sst', title: 'Class 6 NCERT Social Science', author: 'NCERT', file_url: 'https://ncert.nic.in/textbook.php?fess1=0-9', file_url_hindi: 'https://ncert.nic.in/textbook.php?fhss1=0-9', created_at: new Date().toISOString(), class_name: '6' },
            { id: 'ncert-7-math', title: 'Class 7 NCERT Mathematics', author: 'NCERT', file_url: 'https://ncert.nic.in/textbook.php?gemh1=0-13', file_url_hindi: 'https://ncert.nic.in/textbook.php?ghmh1=0-13', created_at: new Date().toISOString(), class_name: '7' },
            { id: 'ncert-7-sci', title: 'Class 7 NCERT Science', author: 'NCERT', file_url: 'https://ncert.nic.in/textbook.php?gesc1=0-13', file_url_hindi: 'https://ncert.nic.in/textbook.php?ghsc1=0-13', created_at: new Date().toISOString(), class_name: '7' },
            { id: 'ncert-7-eng', title: 'Class 7 NCERT English', author: 'NCERT', file_url: 'https://ncert.nic.in/textbook.php?gehc1=0-10', file_url_hindi: '', created_at: new Date().toISOString(), class_name: '7' },
            { id: 'ncert-7-hin', title: 'Class 7 NCERT Hindi', author: 'NCERT', file_url: '', file_url_hindi: 'https://ncert.nic.in/textbook.php?ghvs1=0-15', created_at: new Date().toISOString(), class_name: '7' },
            { id: 'ncert-7-sst', title: 'Class 7 NCERT Social Science', author: 'NCERT', file_url: 'https://ncert.nic.in/textbook.php?gess1=0-8', file_url_hindi: 'https://ncert.nic.in/textbook.php?ghss1=0-8', created_at: new Date().toISOString(), class_name: '7' },
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
            { id: 'ncert-11-phys1', title: 'Class 11 NCERT Physics (Part 1)', author: 'NCERT', file_url: 'https://ncert.nic.in/textbook.php?keph1=0-8', file_url_hindi: 'https://ncert.nic.in/textbook.php?khph1=0-8', created_at: new Date().toISOString(), class_name: '11' },
            { id: 'ncert-11-phys2', title: 'Class 11 NCERT Physics (Part 2)', author: 'NCERT', file_url: 'https://ncert.nic.in/textbook.php?keph2=0-6', file_url_hindi: 'https://ncert.nic.in/textbook.php?khph2=0-6', created_at: new Date().toISOString(), class_name: '11' },
            { id: 'ncert-11-chem1', title: 'Class 11 NCERT Chemistry (Part 1)', author: 'NCERT', file_url: 'https://ncert.nic.in/textbook.php?kech1=0-7', file_url_hindi: 'https://ncert.nic.in/textbook.php?khch1=0-7', created_at: new Date().toISOString(), class_name: '11' },
            { id: 'ncert-11-chem2', title: 'Class 11 NCERT Chemistry (Part 2)', author: 'NCERT', file_url: 'https://ncert.nic.in/textbook.php?kech2=0-7', file_url_hindi: 'https://ncert.nic.in/textbook.php?khch2=0-7', created_at: new Date().toISOString(), class_name: '11' },
            { id: 'ncert-11-math', title: 'Class 11 NCERT Mathematics', author: 'NCERT', file_url: 'https://ncert.nic.in/textbook.php?kemh1=0-16', file_url_hindi: 'https://ncert.nic.in/textbook.php?khmh1=0-16', created_at: new Date().toISOString(), class_name: '11' },
            { id: 'ncert-11-bio', title: 'Class 11 NCERT Biology', author: 'NCERT', file_url: 'https://ncert.nic.in/textbook.php?kebo1=0-22', file_url_hindi: 'https://ncert.nic.in/textbook.php?khbo1=0-22', created_at: new Date().toISOString(), class_name: '11' },
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
let cacheUnreadNotices = { data: null, expiresAt: 0, lastSeen: '' };

app.post('/api/notices', authenticateToken, requireRole('teacher'), async (req, res) => {
    const { title, content } = req.body;
    if (!title || !content) return res.status(400).json({ error: "Title and content are required" });

    try {
        const noticeId = crypto.randomUUID();
        await supabase.from('notices').insert({ id: noticeId, title, content, created_by: req.user.id });
        cacheUnreadNotices.expiresAt = 0; // invalidate notification cache immediately
        const { data } = await supabase.from('notices').select('*').eq('id', noticeId).maybeSingle();
        res.status(201).json({ message: "Notice created successfully", notice: data });
    } catch (err) {
        console.error("Notice creation error:", err);
        res.status(500).json({ error: err.message || "Internal server error" });
    }
});

app.get('/api/notices', authenticateToken, async (req, res) => {
    try {
        const { data: notices } = await supabase.from('notices')
            .select('*')
            .neq('title', '__LIVE_CLASS_STATUS__')
            .neq('title', '__STUDENT_ENROLLMENT_STATUS__')
            .neq('title', '__STUDENT_BATCHES__')
            .neq('title', '__STUDENT_FEE_CONFIGS__')
            .neq('title', '__PAYMENTS_META__')
            .order('created_at', { ascending: false });
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
    console.log("POST /api/attendance RECEIVED:", req.body);
    const { date, session_type, records } = req.body;
    if (!date || !records || !Array.isArray(records)) return res.status(400).json({ error: "Invalid data" });
    const sessionType = session_type || 'Morning';

    try {
        const { error: deleteError } = await supabase.from('attendance').delete().eq('date', date).eq('session_type', sessionType);
        if (deleteError) throw deleteError;
        
        const inserts = records.map(r => ({
            id: crypto.randomUUID(),
            student_id: r.student_id,
            date,
            session_type: sessionType,
            status: r.status,
            marked_by: req.user.id
        }));
        
        const { error: insertError } = await supabase.from('attendance').insert(inserts);
        if (insertError) throw insertError;
        
        res.status(201).json({ message: "Attendance saved successfully" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message || "Internal server error" });
    }
});

app.post('/api/attendance/single', authenticateToken, requireRole('teacher'), async (req, res) => {
    const { student_id, date, session_type, status } = req.body;
    if (!student_id || !date || !status) return res.status(400).json({ error: "Missing required fields" });
    const sessionType = session_type || 'Morning';

    try {
        const insertData = {
            id: crypto.randomUUID(),
            student_id,
            date,
            session_type: sessionType,
            status,
            marked_by: req.user.id
        };
        
        const { data, error } = await supabase.from('attendance').insert([insertData]).select();
        if (error) throw error;
        
        res.status(201).json({ message: "Attendance record added", record: data[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message || "Internal server error" });
    }
});

app.get('/api/attendance', authenticateToken, requireRole('teacher'), async (req, res) => {
    const { date, session_type } = req.query;
    if (!date) return res.status(400).json({ error: "Date is required" });
    const sessionType = session_type || 'Morning';

    try {
        const { data, error } = await supabase.from('attendance').select('*').eq('date', date).eq('session_type', sessionType);
        if (error) throw error;
        res.json(data || []);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message || "Internal server error" });
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

app.delete('/api/attendance/:id', authenticateToken, requireRole('teacher'), async (req, res) => {
    try {
        await supabase.from('attendance').delete().eq('id', req.params.id);
        res.json({ message: "Attendance deleted" });
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
        console.error("Error in POST /api/notes:", err);
        res.status(500).json({ error: err.message || "Internal server error" });
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
        const [studentRes, studentPaymentsRes, oldFeesRes, feeConfigs, paymentMetaMap] = await Promise.all([
            supabase
                .from('students')
                .select('id, full_name, father_name, phone, class_name, total_fees, fees_start_date, fees_due_date')
                .eq('id', req.user.id)
                .maybeSingle(),
            supabase
                .from('payments')
                .select('*')
                .eq('student_id', req.user.id)
                .order('payment_date', { ascending: false })
                .order('created_at', { ascending: false }),
            supabase
                .from('fees')
                .select('*')
                .eq('student_id', req.user.id)
                .order('due_date', { ascending: false }),
            getStudentFeeConfigs(),
            getPaymentMetaMap()
        ]);

        const student = studentRes.data;
        const studentPayments = studentPaymentsRes.data;
        const oldFees = oldFeesRes.data;
        const feeCfg = feeConfigs[req.user.id] || {};
        const feeType = student?.fee_type || feeCfg.fee_type || 'Yearly';
        const monthlyAmount = student?.monthly_amount !== undefined && student?.monthly_amount !== null
            ? Number(student.monthly_amount)
            : (feeCfg.monthly_amount !== undefined && feeCfg.monthly_amount !== null ? Number(feeCfg.monthly_amount) : null);

        if (student && (Number(student.total_fees) > 0 || monthlyAmount > 0 || (studentPayments && studentPayments.length > 0))) {
            const payments = studentPayments || [];
            const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);

            const studentInfo = {
                ...student,
                fee_type: feeType,
                monthly_amount: monthlyAmount
            };

            if (feeType === 'Monthly') {
                const records = payments.map(p => {
                    const meta = paymentMetaMap[p.id] || {};
                    return {
                        id: p.id,
                        student_id: p.student_id,
                        amount: monthlyAmount || Number(student.total_fees) || Number(p.amount),
                        paid_amount: Number(p.amount),
                        due_amount: 0,
                        due_date: student.fees_due_date,
                        status: 'paid',
                        paid_date: p.payment_date,
                        fee_type: 'Monthly',
                        month_for: p.month_for || meta.month_for || null,
                        student_info: studentInfo
                    };
                });

                if (records.length === 0) {
                    records.push({
                        id: 'due-' + student.id,
                        student_id: student.id,
                        amount: monthlyAmount || 0,
                        paid_amount: 0,
                        due_amount: monthlyAmount || 0,
                        due_date: student.fees_due_date,
                        status: 'pending',
                        paid_date: null,
                        fee_type: 'Monthly',
                        student_info: studentInfo
                    });
                }

                return res.json(records);
            }

            // Yearly logic
            const total = Number(student.total_fees) || 0;
            const remainingDue = Math.max(0, total - totalPaid);

            const records = payments.map(p => {
                const meta = paymentMetaMap[p.id] || {};
                return {
                    id: p.id,
                    student_id: p.student_id,
                    amount: total,
                    paid_amount: Number(p.amount),
                    due_amount: remainingDue,
                    due_date: student.fees_due_date,
                    status: 'paid',
                    paid_date: p.payment_date,
                    fee_type: 'Yearly',
                    month_for: p.month_for || meta.month_for || null,
                    student_info: studentInfo
                };
            });

            if (records.length === 0 && total > 0) {
                records.push({
                    id: 'due-' + student.id,
                    student_id: student.id,
                    amount: total,
                    paid_amount: 0,
                    due_amount: remainingDue,
                    due_date: student.fees_due_date,
                    status: 'pending',
                    paid_date: null,
                    fee_type: 'Yearly',
                    student_info: studentInfo
                });
            }

            return res.json(records);
        }

        res.json(oldFees || []);
    } catch (err) {
        console.error("Error in GET /api/student/fees:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

// ==========================================
// --- New Student Fees & Payments System ---
// ==========================================

// GET /api/payments -> All payments, newest first
app.get('/api/payments', authenticateToken, requireRole('teacher'), async (req, res) => {
    try {
        const [paymentsRes, paymentMetaMap] = await Promise.all([
            supabase
                .from('payments')
                .select('*')
                .order('payment_date', { ascending: false })
                .order('created_at', { ascending: false }),
            getPaymentMetaMap()
        ]);

        if (paymentsRes.error) throw paymentsRes.error;
        const payments = paymentsRes.data;

        const formatted = (payments || []).map(p => {
            const meta = paymentMetaMap[p.id] || {};
            return {
                ...p,
                amount: Number(p.amount),
                fee_type: p.fee_type || meta.fee_type || 'Yearly',
                month_for: p.month_for || meta.month_for || null
            };
        });

        res.json(formatted);
    } catch (err) {
        console.error("Error in GET /api/payments:", err);
        res.status(500).json({ error: err.message || "Internal server error" });
    }
});

// Helper: Compute exact same day of next month (with month-end clamping) for backend
function getBackendNextMonthSameDate(dateInput) {
    try {
        if (!dateInput) return null;
        const dateStr = String(dateInput).slice(0, 10);
        const parts = dateStr.split('-');
        if (parts.length !== 3) return null;
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);

        let nextYear = year;
        let nextMonth = month + 1;
        if (nextMonth > 11) {
            nextMonth = 0;
            nextYear += 1;
        }

        const daysInNextMonth = new Date(nextYear, nextMonth + 1, 0).getDate();
        const clampedDay = Math.min(day, daysInNextMonth);
        return `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`;
    } catch {
        return null;
    }
}

// PUT /api/students/:id/fees -> Set or edit fees (Yearly or Monthly)
app.put('/api/students/:id/fees', authenticateToken, requireRole('teacher'), async (req, res) => {
    const studentId = req.params.id;
    const { 
        fee_type = 'Yearly', 
        monthly_amount, 
        total_fees, 
        fees_start_date, 
        fees_due_date, 
        initial_payment 
    } = req.body;

    try {
        // Fetch student
        const { data: student, error: stErr } = await supabase
            .from('students')
            .select('*')
            .eq('id', studentId)
            .maybeSingle();

        if (stErr || !student) {
            return res.status(404).json({ error: "Student not found" });
        }

        if (!fees_start_date) {
            return res.status(400).json({ error: "Fees start date is required" });
        }

        // --- Monthly Fee Mode ---
        if (fee_type === 'Monthly') {
            const numMonthly = Number(monthly_amount);
            if (!numMonthly || isNaN(numMonthly) || numMonthly <= 0) {
                return res.status(400).json({ error: "Monthly fee amount must be greater than 0" });
            }

            const isFirstTime = !student.total_fees || Number(student.total_fees) === 0;
            let initialAmount = 0;
            let initialDate = null;
            let initialMonthFor = null;

            if (isFirstTime && initial_payment && Number(initial_payment.amount) > 0) {
                initialAmount = Number(initial_payment.amount);
                initialDate = initial_payment.payment_date;
                initialMonthFor = initial_payment.month_for || null;
                if (!initialDate) {
                    return res.status(400).json({ error: "Payment date is required for initial payment" });
                }
            }

            const finalDueDate = fees_due_date 
                ? String(fees_due_date).slice(0, 10) 
                : getBackendNextMonthSameDate(initialDate || fees_start_date);

            // Update student
            const { error: updErr } = await supabase
                .from('students')
                .update({
                    total_fees: numMonthly,
                    fees_start_date: String(fees_start_date).slice(0, 10),
                    fees_due_date: finalDueDate
                })
                .eq('id', studentId);

            if (updErr) throw updErr;

            // Save fee config
            await setStudentFeeConfig(studentId, {
                fee_type: 'Monthly',
                monthly_amount: numMonthly,
                fees_start_date: String(fees_start_date).slice(0, 10),
                fees_due_date: finalDueDate
            }, req.user.id);

            // Record initial payment if provided
            if (isFirstTime && initialAmount > 0) {
                const { data: newPay, error: insErr } = await supabase
                    .from('payments')
                    .insert({
                        student_id: studentId,
                        amount: initialAmount,
                        payment_date: String(initialDate).slice(0, 10)
                    })
                    .select()
                    .single();

                if (insErr) throw insErr;

                if (newPay) {
                    await setPaymentMeta(newPay.id, {
                        fee_type: 'Monthly',
                        month_for: initialMonthFor
                    }, req.user.id);
                }
            }

            return res.json({ message: "Monthly fees updated successfully" });
        }

        // --- Yearly Fee Mode ---
        const numTotal = Number(total_fees);
        if (!numTotal || isNaN(numTotal) || numTotal <= 0) {
            return res.status(400).json({ error: "Total course fees must be greater than 0" });
        }

        // Fetch existing payments for this student
        const { data: existingPayments, error: payErr } = await supabase
            .from('payments')
            .select('amount')
            .eq('student_id', studentId);

        if (payErr) throw payErr;

        const existingPaid = (existingPayments || []).reduce((sum, p) => sum + Number(p.amount), 0);

        const isFirstTime = !student.total_fees || Number(student.total_fees) === 0;
        let initialAmount = 0;
        let initialDate = null;

        if (isFirstTime && initial_payment && Number(initial_payment.amount) > 0) {
            initialAmount = Number(initial_payment.amount);
            initialDate = initial_payment.payment_date;
            if (!initialDate) {
                return res.status(400).json({ error: "Payment date is required for initial payment" });
            }
            if (initialAmount <= 0) {
                return res.status(400).json({ error: "Initial payment amount must be greater than 0" });
            }
        }

        const totalPaid = existingPaid + initialAmount;
        if (numTotal < totalPaid) {
            return res.status(400).json({ 
                error: `Total fees cannot be less than already paid (₹${totalPaid.toLocaleString('en-IN')})` 
            });
        }

        const remaining = numTotal - totalPaid;
        if (remaining > 0 && !fees_due_date) {
            return res.status(400).json({ error: "Due date is required for remaining fees" });
        }

        const finalDueDate = remaining === 0 ? null : (fees_due_date ? String(fees_due_date).slice(0, 10) : null);

        // Update student fees details
        const { error: updErr } = await supabase
            .from('students')
            .update({
                total_fees: numTotal,
                fees_start_date: String(fees_start_date).slice(0, 10),
                fees_due_date: finalDueDate
            })
            .eq('id', studentId);

        if (updErr) throw updErr;

        // Save fee config
        await setStudentFeeConfig(studentId, {
            fee_type: 'Yearly',
            total_fees: numTotal,
            fees_start_date: String(fees_start_date).slice(0, 10),
            fees_due_date: finalDueDate
        }, req.user.id);

        // Insert initial payment if provided for first-time set
        if (isFirstTime && initialAmount > 0) {
            const { data: newPay, error: insErr } = await supabase
                .from('payments')
                .insert({
                    student_id: studentId,
                    amount: initialAmount,
                    payment_date: String(initialDate).slice(0, 10)
                })
                .select()
                .single();

            if (insErr) throw insErr;

            if (newPay) {
                await setPaymentMeta(newPay.id, {
                    fee_type: 'Yearly'
                }, req.user.id);
            }
        }

        res.json({ message: "Fees updated successfully" });
    } catch (err) {
        console.error("Error in PUT /api/students/:id/fees:", err);
        res.status(500).json({ error: err.message || "Internal server error" });
    }
});

// DELETE /api/students/:id/fees -> Reset all fees and payment history for a student
app.delete('/api/students/:id/fees', authenticateToken, requireRole('teacher'), async (req, res) => {
    const studentId = req.params.id;
    try {
        const { data: student, error: stErr } = await supabase
            .from('students')
            .select('id, full_name')
            .eq('id', studentId)
            .maybeSingle();

        if (stErr || !student) {
            return res.status(404).json({ error: "Student not found" });
        }

        // 1. Delete all payments for this student
        await supabase.from('payments').delete().eq('student_id', studentId);

        // 2. Delete legacy fees table records if any
        await supabase.from('fees').delete().eq('student_id', studentId);

        // 3. Reset fee columns in students table
        await supabase.from('students').update({
            total_fees: null,
            fees_start_date: null,
            fees_due_date: null,
            monthly_amount: null,
            fee_type: 'Yearly'
        }).eq('id', studentId);

        // 4. Reset in student fee configs notice & cache
        await setStudentFeeConfig(studentId, {
            fee_type: 'Yearly',
            monthly_amount: null,
            fees_start_date: null,
            fees_due_date: null
        }, req.user.id);

        res.json({ message: "Student fee data reset successfully", student_id: studentId });
    } catch (err) {
        console.error("Error in DELETE /api/students/:id/fees:", err);
        res.status(500).json({ error: err.message || "Internal server error" });
    }
});

// POST /api/payments -> Add payment
app.post('/api/payments', authenticateToken, requireRole('teacher'), async (req, res) => {
    const { student_id, amount, payment_date, fees_due_date, fee_type, month_for } = req.body;

    try {
        const numAmount = Number(amount);
        if (!numAmount || isNaN(numAmount) || numAmount <= 0) {
            return res.status(400).json({ error: "Amount must be greater than 0" });
        }
        if (!payment_date) {
            return res.status(400).json({ error: "Payment date is required" });
        }
        if (!student_id) {
            return res.status(400).json({ error: "Student ID is required" });
        }

        // Fetch student
        const { data: student, error: stErr } = await supabase
            .from('students')
            .select('id, total_fees, fees_due_date')
            .eq('id', student_id)
            .maybeSingle();

        if (stErr || !student) {
            return res.status(404).json({ error: "Student not found" });
        }

        // Check student fee config
        const feeConfigs = await getStudentFeeConfigs();
        const studentFeeCfg = feeConfigs[student_id] || {};
        const effectiveFeeType = fee_type || student.fee_type || studentFeeCfg.fee_type || 'Yearly';

        // --- Monthly Payment Handling ---
        if (effectiveFeeType === 'Monthly') {
            const { data: newPayment, error: insErr } = await supabase
                .from('payments')
                .insert({
                    student_id,
                    amount: numAmount,
                    payment_date: String(payment_date).slice(0, 10)
                })
                .select()
                .single();

            if (insErr) throw insErr;

            const targetDueDate = fees_due_date 
                ? String(fees_due_date).slice(0, 10) 
                : getBackendNextMonthSameDate(payment_date);

            if (targetDueDate) {
                await supabase.from('students').update({ fees_due_date: targetDueDate }).eq('id', student_id);
            }

            if (newPayment) {
                await setPaymentMeta(newPayment.id, {
                    fee_type: 'Monthly',
                    month_for: month_for || null
                }, req.user.id);
            }

            return res.status(201).json({ message: "Monthly payment recorded successfully", payment: newPayment });
        }

        // --- Yearly Payment Handling ---
        const totalFees = Number(student.total_fees);
        if (!totalFees || totalFees <= 0) {
            return res.status(400).json({ error: "Total fees not set for this student. Please set fees first." });
        }

        // Existing payments
        const { data: existingPayments, error: payErr } = await supabase
            .from('payments')
            .select('amount')
            .eq('student_id', student_id);

        if (payErr) throw payErr;

        const currentPaid = (existingPayments || []).reduce((sum, p) => sum + Number(p.amount), 0);
        const currentRemaining = Math.max(0, totalFees - currentPaid);

        if (numAmount > currentRemaining) {
            return res.status(400).json({ 
                error: `Amount cannot be more than remaining (₹${currentRemaining.toLocaleString('en-IN')})` 
            });
        }

        const newRemaining = currentRemaining - numAmount;
        if (newRemaining > 0 && !fees_due_date && !student.fees_due_date) {
            return res.status(400).json({ error: "Due date is required for remaining fees" });
        }

        // Insert payment
        const { data: newPayment, error: insErr } = await supabase
            .from('payments')
            .insert({
                student_id,
                amount: numAmount,
                payment_date: String(payment_date).slice(0, 10)
            })
            .select()
            .single();

        if (insErr) throw insErr;

        // If remaining becomes 0, clear fees_due_date. Otherwise update if fees_due_date provided.
        if (newRemaining === 0) {
            await supabase.from('students').update({ fees_due_date: null }).eq('id', student_id);
        } else if (fees_due_date) {
            await supabase.from('students').update({ fees_due_date: String(fees_due_date).slice(0, 10) }).eq('id', student_id);
        }

        if (newPayment) {
            await setPaymentMeta(newPayment.id, {
                fee_type: 'Yearly'
            }, req.user.id);
        }

        res.status(201).json({ message: "Payment recorded successfully", payment: newPayment });
    } catch (err) {
        console.error("Error in POST /api/payments:", err);
        res.status(500).json({ error: err.message || "Internal server error" });
    }
});

// PUT /api/payments/:id -> Edit payment
app.put('/api/payments/:id', authenticateToken, requireRole('teacher'), async (req, res) => {
    const paymentId = req.params.id;
    const { amount, payment_date, fees_due_date, month_for } = req.body;

    try {
        const numAmount = Number(amount);
        if (!numAmount || isNaN(numAmount) || numAmount <= 0) {
            return res.status(400).json({ error: "Amount must be greater than 0" });
        }
        if (!payment_date) {
            return res.status(400).json({ error: "Payment date is required" });
        }

        // Fetch payment
        const { data: payment, error: pErr } = await supabase
            .from('payments')
            .select('*')
            .eq('id', paymentId)
            .maybeSingle();

        if (pErr || !payment) {
            return res.status(404).json({ error: "Payment not found" });
        }

        const studentId = payment.student_id;

        // Fetch student
        const { data: student, error: stErr } = await supabase
            .from('students')
            .select('id, total_fees, fees_due_date')
            .eq('id', studentId)
            .maybeSingle();

        if (stErr || !student) {
            return res.status(404).json({ error: "Student not found" });
        }

        const feeConfigs = await getStudentFeeConfigs();
        const studentFeeCfg = feeConfigs[studentId] || {};
        const paymentMetaMap = await getPaymentMetaMap();
        const payMeta = paymentMetaMap[paymentId] || {};
        const effectiveFeeType = payment.fee_type || payMeta.fee_type || student.fee_type || studentFeeCfg.fee_type || 'Yearly';

        if (effectiveFeeType === 'Monthly') {
            const { error: updErr } = await supabase
                .from('payments')
                .update({
                    amount: numAmount,
                    payment_date: String(payment_date).slice(0, 10)
                })
                .eq('id', paymentId);

            if (updErr) throw updErr;

            const targetDueDate = fees_due_date 
                ? String(fees_due_date).slice(0, 10) 
                : getBackendNextMonthSameDate(payment_date);

            if (targetDueDate) {
                await supabase.from('students').update({ fees_due_date: targetDueDate }).eq('id', studentId);
            }

            if (month_for !== undefined) {
                await setPaymentMeta(paymentId, { month_for }, req.user.id);
            }

            return res.json({ message: "Monthly payment updated successfully" });
        }

        // Yearly payment check
        const totalFees = Number(student.total_fees) || 0;

        // Fetch payments for student
        const { data: existingPayments, error: payErr } = await supabase
            .from('payments')
            .select('id, amount')
            .eq('student_id', studentId);

        if (payErr) throw payErr;

        // Sum excluding this payment
        const paidExcludingThis = (existingPayments || [])
            .filter(p => p.id !== paymentId)
            .reduce((sum, p) => sum + Number(p.amount), 0);

        const remainingWithoutThis = Math.max(0, totalFees - paidExcludingThis);

        if (numAmount > remainingWithoutThis) {
            return res.status(400).json({ 
                error: `Amount cannot be more than remaining (₹${remainingWithoutThis.toLocaleString('en-IN')})` 
            });
        }

        const newRemaining = remainingWithoutThis - numAmount;
        if (newRemaining > 0 && !fees_due_date && !student.fees_due_date) {
            return res.status(400).json({ error: "Due date is required for remaining fees" });
        }

        // Update payment
        const { error: updErr } = await supabase
            .from('payments')
            .update({
                amount: numAmount,
                payment_date: String(payment_date).slice(0, 10)
            })
            .eq('id', paymentId);

        if (updErr) throw updErr;

        // Update student due date
        if (newRemaining === 0) {
            await supabase.from('students').update({ fees_due_date: null }).eq('id', studentId);
        } else if (fees_due_date) {
            await supabase.from('students').update({ fees_due_date: String(fees_due_date).slice(0, 10) }).eq('id', studentId);
        }

        if (month_for !== undefined) {
            await setPaymentMeta(paymentId, { month_for }, req.user.id);
        }

        res.json({ message: "Payment updated successfully" });
    } catch (err) {
        console.error("Error in PUT /api/payments/:id:", err);
        res.status(500).json({ error: err.message || "Internal server error" });
    }
});

// DELETE /api/payments/:id -> Delete payment
app.delete('/api/payments/:id', authenticateToken, requireRole('teacher'), async (req, res) => {
    try {
        const { error } = await supabase.from('payments').delete().eq('id', req.params.id);
        if (error) throw error;
        res.json({ message: "Payment deleted successfully" });
    } catch (err) {
        console.error("Error in POST /api/notes:", err);
        res.status(500).json({ error: err.message || "Internal server error" });
    }
});


app.get('/api/me', authenticateToken, async (req, res) => {
    try {
        let fullName = req.user.full_name || '';
        if (!fullName) {
            if (req.user.role === 'student') {
                const { data: studentInfo } = await supabase.from('students').select('full_name').eq('id', req.user.id).maybeSingle();
                if (studentInfo && studentInfo.full_name) fullName = studentInfo.full_name;
            } else if (req.user.role === 'teacher') {
                const emailPrefix = req.user.email.split('@')[0];
                fullName = emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1);
            }
        }
        res.json({ ...req.user, full_name: fullName });
    } catch (err) {
        res.json(req.user);
    }
});

// --- Notifications ---
app.get('/api/notifications/unread', authenticateToken, async (req, res) => {
    try {
        const { lastSeen } = req.query;
        const now = Date.now();
        const seenKey = lastSeen || '';
        if (cacheUnreadNotices.data && cacheUnreadNotices.lastSeen === seenKey && now < cacheUnreadNotices.expiresAt) {
            return res.json(cacheUnreadNotices.data);
        }

        let query = supabase.from('notices')
            .select('*')
            .neq('title', '__LIVE_CLASS_STATUS__')
            .neq('title', '__STUDENT_ENROLLMENT_STATUS__')
            .neq('title', '__STUDENT_BATCHES__')
            .neq('title', '__STUDENT_FEE_CONFIGS__')
            .neq('title', '__PAYMENTS_META__')
            .order('created_at', { ascending: false });

        if (lastSeen) {
            query = query.gt('created_at', lastSeen);
        } else {
            const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
            query = query.gte('created_at', twoDaysAgo);
        }

        const { data: notices, error } = await query;
        if (error) throw error;

        const unreadList = notices || [];
        const result = { 
            count: unreadList.length,
            latestNotice: unreadList[0] || null,
            notices: unreadList.slice(0, 5)
        };
        cacheUnreadNotices = { data: result, expiresAt: now + 6000, lastSeen: seenKey };
        res.json(result);
    } catch (err) {
        console.error("Notifications unread error:", err);
        res.status(500).json({ error: "Internal server error", count: 0, latestNotice: null, notices: [] });
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

        // Auto broadcast notice for students
        try {
            const targetClass = class_name && class_name !== 'General' ? `Class ${class_name}` : 'All Classes';
            await supabase.from('notices').insert({
                id: crypto.randomUUID(),
                title: `📝 New Quiz: ${title || 'Quiz'}`,
                content: `A new quiz has been published for ${targetClass}. Test your preparation now in the Quizzes tab!`,
                created_by: req.user.id
            });
        } catch (noticeErr) {}

        res.status(201).json({ message: "Quiz created successfully", quizId });
    } catch (err) {
        console.error("Error in POST /api/notes:", err);
        res.status(500).json({ error: err.message || "Internal server error" });
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
        console.error("Error in POST /api/notes:", err);
        res.status(500).json({ error: err.message || "Internal server error" });
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
        
        const [studRes, statuses, batches] = await Promise.all([
            supabase.from('students').select('id, enrollment_status'),
            getStudentEnrollmentStatuses(),
            getStudentBatches()
        ]);
        if (studRes.error) throw studRes.error;
        const allStudents = studRes.data || [];
        
        let activeCount = 0;
        let inactiveCount = 0;
        let morningActive = 0;
        let eveningActive = 0;

        (allStudents || []).forEach(s => {
            const rawStatus = s.enrollment_status || statuses[s.id] || 'active';
            const isInactive = rawStatus === 'inactive' || rawStatus === 'leave';
            const sBatch = s.batch || batches[s.id] || 'Both';

            if (isInactive) {
                inactiveCount++;
            } else {
                activeCount++;
                if (sBatch === 'Morning' || sBatch === 'Both') {
                    morningActive++;
                }
                if (sBatch === 'Evening' || sBatch === 'Both') {
                    eveningActive++;
                }
            }
        });
        
        let presentMorning = 0;
        let presentEvening = 0;
        let presentToday = 0;
        if (date) {
            const [morningRes, eveningRes] = await Promise.all([
                supabase
                    .from('attendance')
                    .select('*', { count: 'exact', head: true })
                    .eq('date', date)
                    .eq('session_type', 'Morning')
                    .eq('status', 'present'),
                supabase
                    .from('attendance')
                    .select('*', { count: 'exact', head: true })
                    .eq('date', date)
                    .eq('session_type', 'Evening')
                    .eq('status', 'present')
            ]);
            presentMorning = morningRes.count || 0;
            presentEvening = eveningRes.count || 0;
            presentToday = presentMorning;
        }

        res.json({
            totalStudents: activeCount, // Active students count for dashboard
            totalActive: activeCount,
            totalInactive: inactiveCount,
            totalMorning: morningActive,
            totalEvening: eveningActive,
            totalEnrolled: activeCount,
            totalLeave: inactiveCount,
            totalAll: (allStudents || []).length,
            presentMorning: presentMorning,
            presentEvening: presentEvening,
            presentToday: presentToday,
            latestExamAverage: 'N/A'
        });
    } catch (err) {
        console.error("Error in GET /api/dashboard/stats:", err);
        res.status(500).json({ error: err.message || "Internal server error" });
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

        // If teacher started live class, broadcast notification
        if (isActive) {
            try {
                await supabase.from('notices').insert({
                    id: crypto.randomUUID(),
                    title: `🔴 Live Class has Started!`,
                    content: `Your teacher is now live! Tap the Live Class tab to join the class right now.`,
                    created_by: req.user.id
                });
            } catch (noticeErr) {}
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
