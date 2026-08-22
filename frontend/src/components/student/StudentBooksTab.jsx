import React, { useState, useEffect } from 'react';
import styles from '../teacher/Tabs.module.css';

const StudentBooksTab = () => {
    const [books, setBooks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeClass, setActiveClass] = useState(null);

    useEffect(() => {
        fetchBooks();  
    }, []);

    const fetchBooks = async () => {
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

    const class8Books = books.filter(b => String(b.id).startsWith('ncert-8') || b.title.includes('Class 8') || b.class_name === '8');
    const class9Books = books.filter(b => String(b.id).startsWith('ncert-9') || b.title.includes('Class 9') || b.class_name === '9');
    const class10Books = books.filter(b => String(b.id).startsWith('ncert-10') || b.title.includes('Class 10') || b.class_name === '10');
    const class12Books = books.filter(b => String(b.id).startsWith('ncert-12') || b.title.includes('Class 12') || b.class_name === '12');
    const otherBooks = books.filter(b => !class8Books.includes(b) && !class9Books.includes(b) && !class10Books.includes(b) && !class12Books.includes(b));

    const renderBooks = (bookList) => (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1.5rem', marginTop: '1.5rem' }}>
            {bookList.map(b => (
                <div key={b.id} style={{ 
                    background: 'rgba(255,255,255,0.03)', 
                    padding: '1.5rem', 
                    borderRadius: '12px', 
                    border: '1px solid rgba(255,255,255,0.08)', 
                    display: 'flex', 
                    flexDirection: 'column',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                }}>
                    <h3 style={{ 
                        margin: '0 0 0.75rem 0', 
                        background: 'linear-gradient(135deg, #f43f5e 0%, #fb923c 100%)', 
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        fontSize: '1.25rem', 
                        fontWeight: '700', 
                        letterSpacing: '0.5px',
                        textShadow: '0 2px 10px rgba(244, 63, 94, 0.2)'
                    }}>{b.title}</h3>
                    <p style={{ margin: '0 0 1.25rem 0', color: 'var(--color-text-muted)', fontSize: '0.95rem', flex: 1, fontStyle: 'italic' }}>By {b.author || 'Unknown'}</p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)' }}>{new Date(b.created_at).toLocaleDateString()}</span>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            {b.file_url && (
                                <a href={b.file_url} target="_blank" rel="noreferrer" style={{ 
                                    background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                                    color: '#fff',
                                    padding: '0.5rem 0.8rem', 
                                    textDecoration: 'none', 
                                    display: 'inline-block', 
                                    fontSize: '0.85rem', 
                                    fontWeight: 'bold', 
                                    borderRadius: '6px',
                                    boxShadow: '0 2px 4px rgba(59, 130, 246, 0.3)'
                                }}>English</a>
                            )}
                            {b.file_url_hindi && (
                                <a href={b.file_url_hindi} target="_blank" rel="noreferrer" style={{ 
                                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                    color: '#fff',
                                    padding: '0.5rem 0.8rem', 
                                    textDecoration: 'none', 
                                    display: 'inline-block', 
                                    fontSize: '0.85rem', 
                                    fontWeight: 'bold', 
                                    borderRadius: '6px',
                                    boxShadow: '0 2px 4px rgba(16, 185, 129, 0.3)'
                                }}>Hindi</a>
                            )}
                        </div>
                    </div>
                </div>
            ))}
            {bookList.length === 0 && <p style={{ color: 'var(--color-text-muted)', gridColumn: '1 / -1' }}>No books in this folder yet.</p>}
        </div>
    );

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

    return (
        <div className={`glass-panel animate-fade-in`} style={{ padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h2 style={{ color: 'var(--color-text-main)', margin: 0, fontSize: '1.8rem', fontWeight: '300' }}>
                    {activeClass ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <button onClick={() => setActiveClass(null)} style={{ background: 'transparent', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', fontSize: '1.5rem', padding: 0 }}>←</button>
                            {['8', '9', '10', '12'].includes(activeClass) ? `Class ${activeClass} Books` : 'General Books'}
                        </span>
                    ) : 'Digital Library'}
                </h2>
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
                    activeClass === '8' ? renderBooks(class8Books) :
                    activeClass === '9' ? renderBooks(class9Books) :
                    activeClass === '10' ? renderBooks(class10Books) :
                    activeClass === '12' ? renderBooks(class12Books) :
                    renderBooks(otherBooks)
                )
            )}
        </div>
    );
};

export default StudentBooksTab;
