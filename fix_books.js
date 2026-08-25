const fs = require('fs');

const teacherBooksFile = 'frontend/src/components/teacher/BooksTab.jsx';
const studentBooksFile = 'frontend/src/components/student/StudentBooksTab.jsx';

function fixBooksFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');

    // 1. Add class11Books filter
    const class10Filter = "const class10Books = books.filter(b => String(b.id).startsWith('ncert-10') || b.title.includes('Class 10') || b.class_name === '10');";
    const class11Filter = "const class11Books = books.filter(b => String(b.id).startsWith('ncert-11') || b.title.includes('Class 11') || b.class_name === '11');";
    if (!content.includes(class11Filter)) {
        content = content.replace(class10Filter, class10Filter + '\n    ' + class11Filter);
    }

    // 2. Update otherBooks filter
    const oldOtherBooks = "const otherBooks = books.filter(b => !class8Books.includes(b) && !class9Books.includes(b) && !class10Books.includes(b) && !class12Books.includes(b));";
    const newOtherBooks = "const otherBooks = books.filter(b => !class8Books.includes(b) && !class9Books.includes(b) && !class10Books.includes(b) && !class11Books.includes(b) && !class12Books.includes(b));";
    content = content.replace(oldOtherBooks, newOtherBooks);

    // 3. Add FolderCard
    const class10Folder = '<FolderCard title="Class 10" count={class10Books.length} onClick={() => setActiveClass(\'10\')} color="#60a5fa" />';
    const class11Folder = '<FolderCard title="Class 11" count={class11Books.length} onClick={() => setActiveClass(\'11\')} color="#fcd34d" />';
    if (!content.includes(class11Folder)) {
        content = content.replace(class10Folder, class10Folder + '\n                            ' + class11Folder);
    }

    // 4. Add ternary condition
    // For teacher:
    const teacherClass10Ternary = "activeClass === '10' ? renderTable(class10Books, 'Class 10th Books') :";
    const teacherClass11Ternary = "activeClass === '11' ? renderTable(class11Books, 'Class 11th Books') :";
    if (content.includes(teacherClass10Ternary) && !content.includes(teacherClass11Ternary)) {
        content = content.replace(teacherClass10Ternary, teacherClass10Ternary + '\n                        ' + teacherClass11Ternary);
    }

    // For student:
    const studentClass10Ternary = "activeClass === '10' ? renderBooks(class10Books) :";
    const studentClass11Ternary = "activeClass === '11' ? renderBooks(class11Books) :";
    if (content.includes(studentClass10Ternary) && !content.includes(studentClass11Ternary)) {
        content = content.replace(studentClass10Ternary, studentClass10Ternary + '\n                    ' + studentClass11Ternary);
    }

    fs.writeFileSync(filePath, content, 'utf8');
}

fixBooksFile(teacherBooksFile);
fixBooksFile(studentBooksFile);
console.log('Fixed both books tabs');
