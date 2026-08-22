const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const db = new sqlite3.Database(path.resolve('./database.sqlite'));

db.serialize(() => {
    db.run("ALTER TABLE users ADD COLUMN plain_password TEXT", (err) => {
        if (err && !err.message.includes('duplicate column')) console.log("Error users:", err.message);
        else console.log('Added plain_password column to users');
    });
});

db.close(() => console.log('Migration complete'));
