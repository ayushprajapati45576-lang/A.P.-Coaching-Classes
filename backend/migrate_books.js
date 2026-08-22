const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const db = new sqlite3.Database(path.resolve('./database.sqlite'));

db.serialize(() => {
    db.run("ALTER TABLE books ADD COLUMN file_url_hindi TEXT", (err) => {
        if (err) console.log(err.message);
        else console.log('Added file_url_hindi column');
    });
});

db.close(() => console.log('Migration complete'));
