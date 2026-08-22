const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const bcrypt = require('bcrypt');

let dbInstance = null;

async function initDB() {
    if (dbInstance) return dbInstance;

    const db = await open({
        filename: './database.sqlite',
        driver: sqlite3.Database
    });

    await db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            plain_password TEXT,
            role TEXT NOT NULL CHECK (role IN ('teacher', 'student')),
            active_session_id TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS students (
            id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
            full_name TEXT NOT NULL,
            phone TEXT,
            class_name TEXT DEFAULT 'General',
            enrollment_date DATE DEFAULT CURRENT_DATE
        );

        CREATE TABLE IF NOT EXISTS notes (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT,
            file_url TEXT NOT NULL,
            class_name TEXT DEFAULT 'General',
            subject TEXT DEFAULT 'General',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            created_by TEXT REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS books (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            author TEXT,
            file_url TEXT,
            file_url_hindi TEXT,
            class_name TEXT DEFAULT 'General',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            created_by TEXT REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS notices (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            created_by TEXT REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS attendance (
            id TEXT PRIMARY KEY,
            student_id TEXT REFERENCES students(id) ON DELETE CASCADE,
            date DATE NOT NULL,
            status TEXT CHECK (status IN ('present', 'absent', 'late')),
            marked_by TEXT REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS results (
            id TEXT PRIMARY KEY,
            student_id TEXT REFERENCES students(id) ON DELETE CASCADE,
            exam_name TEXT NOT NULL,
            marks_obtained NUMERIC NOT NULL,
            total_marks NUMERIC NOT NULL,
            date DATE NOT NULL,
            status TEXT DEFAULT 'Pass',
            created_by TEXT REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS fees (
            id TEXT PRIMARY KEY,
            student_id TEXT REFERENCES students(id) ON DELETE CASCADE,
            amount NUMERIC NOT NULL,
            due_date DATE,
            paid_date DATE,
            status TEXT CHECK (status IN ('pending', 'paid', 'overdue')),
            recorded_by TEXT REFERENCES users(id)
        );
    `);

    // Insert Default Teacher
    const defaultEmail = 'teacher@coaching.com';
    const existing = await db.get('SELECT * FROM users WHERE email = ?', [defaultEmail]);
    if (!existing) {
        const hash = await bcrypt.hash('teacher123', 10);
        await db.run(
            'INSERT INTO users (id, email, password_hash, role) VALUES (?, ?, ?, ?)',
            ['teacher-1', defaultEmail, hash, 'teacher']
        );
    }

    dbInstance = db;
    return db;
}

// Helper to execute queries once DB is initialized
async function getDB() {
    if (!dbInstance) return await initDB();
    return dbInstance;
}

module.exports = { initDB, getDB };
