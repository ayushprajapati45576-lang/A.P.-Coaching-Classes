const fs = require('fs');
const path = require('path');

const srcDir = 'frontend/src';
function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(file));
        } else if (file.endsWith('.jsx')) {
            results.push(file);
        }
    });
    return results;
}

const files = walk(srcDir);
let updatedCount = 0;

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;

    // Replace arrays
    content = content.replace(/\['8', '9', '10', '12'\]/g, "['8', '9', '10', '11', '12']");

    // Replace options. We look for <option value="10">Class 10</option> and add 11 after it.
    const option10Regex = /(<option value="10">Class 10<\/option>\s*)(?!<option value="11">)/g;
    
    content = content.replace(option10Regex, (match, p1) => {
        const lines = p1.split('\n');
        const indent = lines.length > 1 ? lines[lines.length - 1] : '';
        return match + '<option value="11">Class 11</option>\n' + indent;
    });

    if (content !== original) {
        fs.writeFileSync(file, content, 'utf8');
        updatedCount++;
        console.log('Updated', file);
    }
});

console.log('Total files updated:', updatedCount);
