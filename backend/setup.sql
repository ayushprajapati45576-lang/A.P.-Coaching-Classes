-- Supabase PostgreSQL Schema Setup

-- ==========================================
-- ⚠️ STORAGE BUCKETS SETUP REQUIRED ⚠️
-- In addition to running this SQL script, please go to the "Storage" section
-- in your Supabase Dashboard and create two new buckets:
-- 1. "notes" (Make it PUBLIC)
-- 2. "books" (Make it PUBLIC)
-- ==========================================

-- 1. Users Table (Custom Auth)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('teacher', 'student')),
    active_session_id VARCHAR(255),
    is_approved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Students Profile Table (Linked to users)
CREATE TABLE students (
    id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    full_name VARCHAR(255) NOT NULL,
    father_name VARCHAR(255),
    phone VARCHAR(20),
    class_name VARCHAR(50) DEFAULT 'General',
    enrollment_date DATE DEFAULT CURRENT_DATE
);

-- 3. Notes Table
CREATE TABLE notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    file_url TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id)
);

-- 4. Books Table
CREATE TABLE books (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    author VARCHAR(255),
    class_name VARCHAR(50) DEFAULT 'General',
    file_url TEXT NOT NULL,
    file_url_hindi TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id)
);

-- 5. Notices Table
CREATE TABLE notices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id)
);


-- 6. Attendance Table
CREATE TABLE attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    status VARCHAR(20) CHECK (status IN ('present', 'absent', 'late')),
    marked_by UUID REFERENCES users(id),
    UNIQUE(student_id, date)
);

-- 7. Results Table
CREATE TABLE results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    exam_name VARCHAR(255) NOT NULL,
    marks_obtained NUMERIC NOT NULL,
    total_marks NUMERIC NOT NULL,
    date DATE NOT NULL,
    created_by UUID REFERENCES users(id)
);

-- 8. Fees Table
CREATE TABLE fees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL,
    due_date DATE,
    paid_date DATE,
    status VARCHAR(20) CHECK (status IN ('pending', 'paid', 'overdue')),
    recorded_by UUID REFERENCES users(id)
);

-- 9. Quizzes Table
CREATE TABLE quizzes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    class_name VARCHAR(50),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 10. Quiz Questions Table
CREATE TABLE quiz_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_id UUID REFERENCES quizzes(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    option_a VARCHAR(255) NOT NULL,
    option_b VARCHAR(255) NOT NULL,
    option_c VARCHAR(255) NOT NULL,
    option_d VARCHAR(255) NOT NULL,
    correct_option CHAR(1) NOT NULL
);

-- 11. Quiz Results Table
CREATE TABLE quiz_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_id UUID REFERENCES quizzes(id) ON DELETE CASCADE,
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    score NUMERIC NOT NULL,
    total_marks NUMERIC NOT NULL,
    taken_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. Insert Dummy Teacher Account
-- Email: teacher@coaching.com
-- Password: teacher123
INSERT INTO users (email, password_hash, role) 
VALUES ('teacher@coaching.com', '$2b$10$cmy2iz810DYwXQ.h/bawKOtxCd4Bm1a2fPZsrdI7ePwTKyVfRqVWC', 'teacher')
ON CONFLICT (email) DO NOTHING;
