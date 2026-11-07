-- ========================================================
-- MIGRATION: Add session_type to attendance table
-- ========================================================

-- 1. Add the session_type column with a default value of 'Morning'
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS session_type VARCHAR(50) DEFAULT 'Morning';

-- 2. Drop the existing unique constraint on (student_id, date)
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_student_id_date_key;

-- 3. Add a new unique constraint that includes session_type
ALTER TABLE attendance ADD CONSTRAINT attendance_student_id_date_session_key UNIQUE(student_id, date, session_type);

-- ========================================================
-- MIGRATION: Add paid_amount and due_amount to fees table
-- ========================================================

ALTER TABLE fees ADD COLUMN IF NOT EXISTS paid_amount NUMERIC DEFAULT 0;
ALTER TABLE fees ADD COLUMN IF NOT EXISTS due_amount NUMERIC DEFAULT 0;

-- Update existing records so due_amount matches amount if pending, or 0 if paid
UPDATE fees SET 
    due_amount = CASE WHEN status = 'paid' THEN 0 ELSE amount END,
    paid_amount = CASE WHEN status = 'paid' THEN amount ELSE 0 END
WHERE due_amount IS NULL OR due_amount = 0;

-- ========================================================
-- MIGRATION: Student-wise Total Fees & Payments System
-- (Old 'fees' table is now unused in the Fees tab)
-- ========================================================

-- 1. Add fees columns to students table
ALTER TABLE students ADD COLUMN IF NOT EXISTS total_fees numeric(10,2) null;
ALTER TABLE students ADD COLUMN IF NOT EXISTS fees_start_date date null;
ALTER TABLE students ADD COLUMN IF NOT EXISTS fees_due_date date null;

-- 2. Create payments table
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    amount numeric(10,2) NOT NULL CHECK (amount > 0),
    payment_date date NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payments_student_id ON payments(student_id);

-- ========================================================
-- MIGRATION: Add class_name and subject to notes table
-- ========================================================

ALTER TABLE notes 
ADD COLUMN IF NOT EXISTS class_name VARCHAR(50) DEFAULT 'General',
ADD COLUMN IF NOT EXISTS subject VARCHAR(100) DEFAULT 'General Notes';

CREATE INDEX IF NOT EXISTS idx_notes_class_subject ON notes(class_name, subject);

-- Run these queries in your Supabase SQL Editor.
