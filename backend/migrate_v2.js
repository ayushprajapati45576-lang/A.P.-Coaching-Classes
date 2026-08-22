const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
        process.exit(1);
    }
});

db.serialize(() => {
    console.log("Starting migration to v2...");

    // 1. Add is_approved to users
    db.run("ALTER TABLE users ADD COLUMN is_approved BOOLEAN DEFAULT 0", (err) => {
        if (err && !err.message.includes("duplicate column name")) {
            console.error("Error adding is_approved:", err.message);
        } else {
            console.log("Added is_approved to users.");
        }
    });

    // Approve existing users so they aren't locked out
    db.run("UPDATE users SET is_approved = 1", (err) => {
        if (err) console.error("Error updating existing users:", err.message);
        else console.log("Set existing users to approved.");
    });

    // 2. Add father_name to students
    db.run("ALTER TABLE students ADD COLUMN father_name VARCHAR(255)", (err) => {
        if (err && !err.message.includes("duplicate column name")) {
            console.error("Error adding father_name:", err.message);
        } else {
            console.log("Added father_name to students.");
        }
    });

    // 3. Create Quizzes Tables
    const createQuizzes = `
        CREATE TABLE IF NOT EXISTS quizzes (
            id VARCHAR(255) PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            class_name VARCHAR(50),
            created_by VARCHAR(255) REFERENCES users(id),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `;
    db.run(createQuizzes, (err) => {
        if (err) console.error("Error creating quizzes:", err.message);
        else console.log("Created quizzes table.");
    });

    const createQuizQuestions = `
        CREATE TABLE IF NOT EXISTS quiz_questions (
            id VARCHAR(255) PRIMARY KEY,
            quiz_id VARCHAR(255) REFERENCES quizzes(id) ON DELETE CASCADE,
            question TEXT NOT NULL,
            option_a VARCHAR(255) NOT NULL,
            option_b VARCHAR(255) NOT NULL,
            option_c VARCHAR(255) NOT NULL,
            option_d VARCHAR(255) NOT NULL,
            correct_option CHAR(1) NOT NULL
        )
    `;
    db.run(createQuizQuestions, (err) => {
        if (err) console.error("Error creating quiz_questions:", err.message);
        else console.log("Created quiz_questions table.");
    });

    const createQuizResults = `
        CREATE TABLE IF NOT EXISTS quiz_results (
            id VARCHAR(255) PRIMARY KEY,
            quiz_id VARCHAR(255) REFERENCES quizzes(id) ON DELETE CASCADE,
            student_id VARCHAR(255) REFERENCES students(id) ON DELETE CASCADE,
            score NUMERIC NOT NULL,
            total_marks NUMERIC NOT NULL,
            taken_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `;
    db.run(createQuizResults, (err) => {
        if (err) console.error("Error creating quiz_results:", err.message);
        else {
            console.log("Created quiz_results table.");
            console.log("Migration complete!");
            db.close();
        }
    });
});
