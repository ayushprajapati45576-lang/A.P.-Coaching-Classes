-- ========================================================
-- MIGRATION: Add session_type to attendance table
-- ========================================================

-- 1. Add the session_type column with a default value of 'Morning'
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS session_type VARCHAR(50) DEFAULT 'Morning';

-- 2. Drop the existing unique constraint on (student_id, date)
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_student_id_date_key;

-- 3. Add a new unique constraint that includes session_type
ALTER TABLE attendance ADD CONSTRAINT attendance_student_id_date_session_key UNIQUE(student_id, date, session_type);

-- Run these queries in your Supabase SQL Editor.
