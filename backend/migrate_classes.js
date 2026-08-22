const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const db = new sqlite3.Database(path.resolve('./database.sqlite'));

db.serialize(() => {
    // We already added file_url_hindi to books earlier.
    db.run("ALTER TABLE students ADD COLUMN class_name TEXT DEFAULT 'General'", (err) => {
        if (err && !err.message.includes('duplicate column')) console.log("Error students:", err.message);
        else console.log('Added class_name column to students');
    });

    db.run("ALTER TABLE books ADD COLUMN class_name TEXT DEFAULT 'General'", (err) => {
        if (err && !err.message.includes('duplicate column')) console.log("Error books:", err.message);
        else console.log('Added class_name column to books');
    });
});

db.close(() => console.log('Migration complete'));
