import React, { useState, useEffect } from 'react';
import styles from './Tabs.module.css';

const BooksTab = () => {
    const [view, setView] = useState('list'); // 'list' or 'add'

    // List State
    const [books, setBooks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeClass, setActiveClass] = useState(null);

    // Form State
    const [title, setTitle] = useState('');
    const [author, setAuthor] = useState('');
    const [className, setClassName] = useState('10');
    const [fileEnglish, setFileEnglish] = useState(null);
    const [fileHindi, setFileHindi] = useState(null);
    const [status, setStatus] = useState({ type: '', message: '' });

    useEffect(() => {
        if (view === 'list') {
            fetchBooks();
        }
    }, [view]);

    const fetchBooks = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${import.meta.env.VITE_BACKEND_URL || ''}/api/books`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            const data = await res.json();
            if (res.ok) setBooks(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this?')) return;
        if (!window.confirm("Are you sure you want to delete this book?")) return;
        try {
            const res = await fetch(`${import.meta.env.VITE_BACKEND_URL || ''}/api/books/${id}`, {
                method: `DELETE',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            if (res.ok) {
                setBooks(books.filter(b => b.id !== id));
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!fileEnglish && !fileHindi) {
            setStatus({ type: 'error', message: 'Please select at least one file (English or Hindi)' });
            return;
        }

        setStatus({ type: 'loading', message: 'Uploading book...' });

        const formData = new FormData();
        formData.append('title', title);
        formData.append('author', author);
        formData.append('class_name', className);
        if (fileEnglish) formData.append('file_english', fileEnglish);
        if (fileHindi) formData.append('file_hindi', fileHindi);

        try {
            const res = await fetch(`${import.meta.env.VITE_BACKEND_URL || ''}/api/books`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: formData
            });

            const data = await res.json();
            if (res.ok) {
                setStatus({ type: 'success', message: 'Book uploaded successfully!' });
                setTitle('');
                setAuthor('');
                setClassName('10');
                setFileEnglish(null);
                setFileHindi(null);
                setTimeout(() => setView('list'), 1500);
            } else {
                setStatus({ type: 'error', message: data.error || 'Failed to upload book' });
            }
        } catch (err) {
            setStatus({ type: 'error', message: err.message });
        }
    };

    const class8Books = books.filter(b => String(b.id).startsWith('ncert-8') || b.title.includes('Class 8') || b.class_name === '8');
    const class9Books = books.filter(b => String(b.id).startsWith('ncert-9') || b.title.includes('Class 9') || b.class_name === '9');
    const class10Books = books.filter(b => String(b.id).startsWith('ncert-10') || b.title.includes('Class 10') || b.class_name === '10');
    const class12Books = books.filter(b => String(b.id).startsWith('ncert-12') || b.title.includes('Class 12') || b.class_name === '12');
    const otherBooks = books.filter(b => !class8Books.includes(b) && !class9Books.includes(b) && !class10Books.includes(b) && !class12Books.includes(b));

    const FolderCard = ({ title, count, onClick, color }) => (
        <div onClick={onClick} style={{
            background: `linear-gradient(135deg, var(--color-border) 0%, var(--color-surface-hover) 100%)`,
            border: `1px solid ${color}`,
            borderRadius: '12px',
            padding: '2rem',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'transform 0.2s, box-shadow 0.2s',
            boxShadow: `0 4px 20px ${color}20`
        }}
        onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-5px)'; e.currentTarget.style.boxShadow = `0 8px 25px ${color}40`; }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = `0 4px 20px ${color}20`; }}
        >
            <div style={{ fontSize: '4rem', marginBottom: '1rem', color: color }}>📁</div>
            <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--color-text-main)', fontSize: '1.5rem', fontWeight: '500' }}>{title}</h3>
            <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>{count} Books</p>
        </div>
    );

    const renderTable = (bookList, sectionTitle) => (
        <div style={{ marginBottom: '2rem' }}>
            <h3 style={{ color: 'var(--color-text-main)', fontSize: '1.2rem', marginBottom: '1rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem', fontWeight: '500' }}>
                {sectionTitle} <span style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>({bookList.length})</span>
            </h3>
            {bookList.length === 0 ? <p style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>No books in this section.</p> : (
                <div style={{ overflowX: 'auto', background: 'var(--color-surface-hover)', borderRadius: '8px', padding: '1rem' }}>
                    <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                                <th style={{ padding: '0.75rem', color: 'var(--color-text-muted)' }}>Title</th>
                                <th style={{ padding: '0.75rem', color: 'var(--color-text-muted)' }}>Author</th>
                                <th style={{ padding: '0.75rem', color: 'var(--color-text-muted)' }}>Date</th>
                                <th style={{ padding: '0.75rem', color: 'var(--color-text-muted)' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {bookList.map((b) => (
                                <tr key={b.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                                    <td style={{ 
                                        padding: '0.75rem', 
                                        background: 'linear-gradient(135deg, #f43f5e 0%, #fb923c 100%)', 
                                        WebkitBackgroundClip: 'text',
                                        WebkitTextFillColor: 'transparent',
                                        fontWeight: '700',
                                        letterSpacing: '0.5px'
                                    }}>{b.title}</td>
                                    <td style={{ padding: '0.75rem' }}>{b.author || 'N/A'}</td>
                                    <td style={{ padding: '0.75rem', fontSize: '0.9rem' }}>{new Date(b.created_at).toLocaleDateString()}</td>
                                    <td style={{ padding: '0.75rem' }}>
                                        {b.file_url && (
                                            <a href={b.file_url} target="_blank" rel="noreferrer" style={{ 
                                                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', 
                                                color: '#ffffff', 
                                                padding: '0.4rem 0.8rem', 
                                                borderRadius: '6px', 
                                                marginRight: '0.5rem', 
                                                textDecoration: 'none', 
                                                fontWeight: '500',
                                                display: 'inline-block',
                                                boxShadow: '0 2px 4px rgba(59, 130, 246, 0.3)'
                                            }}>English</a>
                                        )}
                                        {b.file_url_hindi && (
                                            <a href={b.file_url_hindi} target="_blank" rel="noreferrer" style={{ 
                                                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', 
                                                color: '#ffffff', 
                                                padding: '0.4rem 0.8rem', 
                                                borderRadius: '6px', 
                                                marginRight: '0.5rem', 
                                                textDecoration: 'none', 
                                                fontWeight: '500',
                                                display: 'inline-block',
                                                boxShadow: '0 2px 4px rgba(16, 185, 129, 0.3)'
                                            }}>Hindi</a>
                                        )}
                                        {!String(b.id).startsWith('ncert-') && (
                                            <button onClick={() => handleDelete(b.id)} style={{ 
                                                background: 'rgba(239, 68, 68, 0.15)', 
                                                color: '#ef4444', 
                                                border: '1px solid rgba(239, 68, 68, 0.3)', 
                                                padding: '0.4rem 0.8rem', 
                                                borderRadius: '6px',
                                                cursor: 'pointer',
                                                fontWeight: '500',
                                                display: 'inline-block'
                                            }}>Delete</button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );

    if (view === 'list') {
        return (
            <div className={`glass-panel animate-fade-in`} style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
                    <h2 style={{ color: 'var(--color-primary)', margin: 0, fontSize: '1.8rem', fontWeight: '300' }}>
                        {activeClass ? (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <button onClick={() => setActiveClass(null)} style={{ background: 'transparent', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', fontSize: '1.5rem', padding: 0 }}>←</button>
                                {['8', '9', '10', '12'].includes(activeClass) ? `Class ${activeClass} Books` : 'General Books'}
                            </span>
                        ) : 'Library Management'}
                    </h2>
                    <button onClick={() => setView('add')} className={styles.submitBtn} style={{ margin: 0, padding: '0.6rem 1.2rem', borderRadius: '6px' }}>
                        + Upload New Book
                    </button>
                </div>

                {loading ? <p style={{ color: 'var(--color-text-muted)' }}>Loading library...</p> : (
                    !activeClass ? (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem' }}>
                            <FolderCard title="Class 8" count={class8Books.length} onClick={() => setActiveClass('8')} color="#a78bfa" />
                            <FolderCard title="Class 9" count={class9Books.length} onClick={() => setActiveClass('9')} color="#fb923c" />
                            <FolderCard title="Class 10" count={class10Books.length} onClick={() => setActiveClass('10')} color="#60a5fa" />
                            <FolderCard title="Class 12" count={class12Books.length} onClick={() => setActiveClass('12')} color="#34d399" />
                            <FolderCard title="General" count={otherBooks.length} onClick={() => setActiveClass('General')} color="#f472b6" />
                        </div>
                    ) : (
                        activeClass === '8' ? renderTable(class8Books, 'Class 8th Books') :
                        activeClass === '9' ? renderTable(class9Books, 'Class 9th Books') :
                        activeClass === '10' ? renderTable(class10Books, 'Class 10th Books') :
                        activeClass === '12' ? renderTable(class12Books, 'Class 12th Books') :
                        renderTable(otherBooks, 'General Books')
                    )
                )}
            </div>
        );
    }

    return (
        <div className={`glass-panel ${styles.tabContainer} animate-fade-in`}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <h2 style={{ margin: 0 }}>Upload Library Book</h2>
                <button onClick={() => setView('list')} className={styles.logoutBtn} style={{ background: 'transparent', color: 'var(--color-text-muted)', border: 'none' }}>Cancel</button>
            </div>

            <form onSubmit={handleSubmit} className={styles.form}>
                <div className={styles.inputGroup}>
                    <label>Book Title</label>
                    <input required type="text" value={title} onChange={e => setTitle(e.target.value)} />
                </div>
                <div className={styles.inputGroup}>
                    <label>Author</label>
                    <input type="text" value={author} onChange={e => setAuthor(e.target.value)} />
                </div>
                <div className={styles.inputGroup}>
                    <label>Class</label>
                    <select value={className} onChange={e => setClassName(e.target.value)} className={styles.selectInput}>
                        <option value="8">Class 8</option>
                        <option value="9">Class 9</option>
                        <option value="10">Class 10</option>
                        <option value="12">Class 12</option>
                        <option value="General">General / Other</option>
                    </select>
                </div>
                <div className={styles.inputGroup}>
                    <label>English Book File (PDF or Image)</label>
                    <input type="file" accept="application/pdf,image/*" onChange={e => setFileEnglish(e.target.files[0])} className={styles.fileInput} />
                </div>
                
                <div className={styles.inputGroup}>
                    <label>Hindi Book File (PDF or Image)</label>
                    <input type="file" accept="application/pdf,image/*" onChange={e => setFileHindi(e.target.files[0])} className={styles.fileInput} />
                </div>

                {status.message && (
                    <div className={status.type === 'error' ? styles.errorMsg : styles.successMsg}>
                        {status.message}
                    </div>
                )}

                <button type="submit" disabled={status.type === 'loading'} className={styles.submitBtn}>
                    Upload Book
                </button>
            </form>
        </div>
    );
};

export default BooksTab;
