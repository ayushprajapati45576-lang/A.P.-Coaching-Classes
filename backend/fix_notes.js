const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const db = new sqlite3.Database(path.resolve('./database.sqlite'));

db.serialize(() => {
    db.run("UPDATE notes SET class_name = '10' WHERE class_name = 'Class 10'", (err) => {
        if (err) console.error("Error updating Class 10:", err.message);
        else console.log("Updated Class 10 notes to '10'");
    });

    db.run("UPDATE notes SET class_name = '12' WHERE class_name = 'Class 12'", (err) => {
        if (err) console.error("Error updating Class 12:", err.message);
        else console.log("Updated Class 12 notes to '12'");
    });
});

db.close(() => console.log('Migration complete'));
