import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import styles from '../teacher/Tabs.module.css'; 
import { useAuth } from '../../contexts/AuthContext';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

const CLASS_SUBJECTS = {
    '6': ['Maths', 'Science', 'Social Science', 'English', 'Hindi', 'Sanskrit'],
    '7': ['Maths', 'Science', 'Social Science', 'English', 'Hindi', 'Sanskrit'],
    '8': ['Maths', 'Science', 'Social Science', 'English', 'Hindi', 'Sanskrit'],
    '9': ['Maths', 'Science', 'Social Science', 'English', 'Hindi', 'Sanskrit'],
    '10': ['Maths', 'Science', 'Social Science', 'English', 'Hindi', 'Sanskrit'],
    '11': ['Physics', 'Chemistry', 'Mathematics', 'Biology', 'English', 'Accountancy', 'Business Studies', 'Economics', 'Physical Education', 'Computer Science'],
    '12': ['Physics', 'Chemistry', 'Mathematics', 'Biology', 'English', 'Accountancy', 'Business Studies', 'Economics', 'Physical Education', 'Computer Science'],
    'General': ['General Notes', 'Important Material', 'Sample Papers']
};

const SUBJECT_META = {
    'Maths': { emoji: '📐', color: '#60a5fa' },
    'Mathematics': { emoji: '📐', color: '#60a5fa' },
    'Science': { emoji: '🔬', color: '#34d399' },
    'Physics': { emoji: '⚡', color: '#a78bfa' },
    'Chemistry': { emoji: '🧪', color: '#f43f5e' },
    'Biology': { emoji: '🧬', color: '#10b981' },
    'Social Science': { emoji: '🌍', color: '#fb923c' },
    'English': { emoji: '📖', color: '#38bdf8' },
    'Hindi': { emoji: '📙', color: '#f59e0b' },
    'Sanskrit': { emoji: '📜', color: '#c084fc' },
    'Accountancy': { emoji: '📊', color: '#2dd4bf' },
    'Business Studies': { emoji: '💼', color: '#818cf8' },
    'Economics': { emoji: '📈', color: '#fbbf24' },
    'Computer Science': { emoji: '💻', color: '#06b6d4' },
    'Physical Education': { emoji: '🏃', color: '#e879f9' },
    'General Notes': { emoji: '📚', color: '#f472b6' }
};

const getSubjectMeta = (sub) => {
    return SUBJECT_META[sub] || { emoji: '📘', color: '#fbbf24' };
};

// Smart backend URL: auto-detects localhost to prevent calling old production Vercel
const getBackendUrl = () => {
    if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
        return 'http://localhost:5000';
    }
    return import.meta.env.VITE_BACKEND_URL || '';
};

const StudentNotesTab = () => {
    const { user } = useAuth();
    
    // Navigation State
    const [activeSubject, setActiveSubject] = useState(null);

    // Notes Data State
    const [notes, setNotes] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // Viewer State
    const [showBlackout, setShowBlackout] = useState(false);
    const [selectedNoteUrl, setSelectedNoteUrl] = useState(null);
    const [numPages, setNumPages] = useState(null);

    function onDocumentLoadSuccess({ numPages }) {
        setNumPages(numPages);
    }

    useEffect(() => {
        fetchNotes();

        // Anti-piracy event listeners
        const handleBlur = () => setShowBlackout(true);
        const handleFocus = () => setShowBlackout(false);
        const handleVisibilityChange = () => {
            if (document.hidden) {
                setShowBlackout(true);
            } else {
                setShowBlackout(false);
            }
        };

        const handleKeyDown = (e) => {
            // Block Print Screen key
            if (e.key === 'PrintScreen' || e.keyCode === 44) {
                e.preventDefault();
                try { navigator.clipboard.writeText('Screenshots are disabled'); } catch (err) {}
                setShowBlackout(true);
                setTimeout(() => setShowBlackout(false), 3000);
            }
            // Block Print (Ctrl+P)
            if (e.ctrlKey && (e.key === 'p' || e.key === 'P')) {
                e.preventDefault();
                setShowBlackout(true);
                setTimeout(() => setShowBlackout(false), 3000);
            }
            // Block Snipping shortcuts (Win+Shift+S, Cmd+Shift+3/4)
            if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 's' || e.key === 'S' || e.key === '3' || e.key === '4')) {
                e.preventDefault();
                setShowBlackout(true);
                setTimeout(() => setShowBlackout(false), 3000);
            }
            // Block Copy (Ctrl+C)
            if (e.ctrlKey && (e.key === 'c' || e.key === 'C')) {
                e.preventDefault();
                try { navigator.clipboard.writeText(''); } catch (err) {}
            }
        };

        if (import.meta.env.PROD) {
            window.addEventListener('blur', handleBlur);
            window.addEventListener('focus', handleFocus);
            document.addEventListener('visibilitychange', handleVisibilityChange);
            window.addEventListener('keydown', handleKeyDown);
        }

        return () => {
            if (import.meta.env.PROD) {
                window.removeEventListener('blur', handleBlur);
                window.removeEventListener('focus', handleFocus);
                document.removeEventListener('visibilitychange', handleVisibilityChange);
                window.removeEventListener('keydown', handleKeyDown);
            }
        };
    }, []);

    const fetchNotes = async () => {
        try {
            const res = await fetch(getBackendUrl() + '/api/notes', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            const contentType = res.headers.get('content-type') || '';
            if (res.ok && contentType.includes('application/json')) {
                const data = await res.json();
                setNotes(Array.isArray(data) ? data : []);
            }
        } catch (err) {
            console.error('Error fetching notes:', err);
        } finally {
            setLoading(false);
        }
    };

    // Generate Watermark SVG
    const watermarkSvg = `
        <svg width="250" height="150" xmlns="http://www.w3.org/2000/svg">
            <text x="20" y="80" font-family="Arial" font-size="16" fill="rgba(0, 0, 0, 0.15)" font-weight="bold" transform="rotate(-30 100 75)">
                ${user?.email || 'STUDENT ID'}
            </text>
        </svg>
    `;
    const watermarkUrl = `data:image/svg+xml;base64,${btoa(watermarkSvg)}`;

    const FolderCard = ({ title, count, onClick, color, emoji = '📁' }) => (
        <div onClick={onClick} style={{
            background: `linear-gradient(135deg, var(--color-border) 0%, var(--color-surface-hover) 100%)`,
            border: `1px solid ${color}`,
            borderRadius: '12px',
            padding: '1.75rem 1.25rem',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'transform 0.2s, box-shadow 0.2s',
            boxShadow: `0 4px 20px ${color}15`
        }}
        onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-5px)'; e.currentTarget.style.boxShadow = `0 8px 25px ${color}35`; }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = `0 4px 20px ${color}15`; }}
        >
            <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>{emoji}</div>
            <h3 style={{ margin: '0 0 0.4rem 0', color: 'var(--color-text-main)', fontSize: '1.25rem', fontWeight: '600', textAlign: 'center' }}>{title}</h3>
            {count !== undefined && (
                <span style={{ 
                    fontSize: '0.85rem', 
                    color: count > 0 ? '#10b981' : 'var(--color-text-muted)',
                    fontWeight: count > 0 ? '600' : '400',
                    background: count > 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                    padding: '2px 10px',
                    borderRadius: '12px'
                }}>
                    {count} {count === 1 ? 'Note' : 'Notes'}
                </span>
            )}
        </div>
    );

    const defaultSubjects = user?.class_name && CLASS_SUBJECTS[user.class_name] ? CLASS_SUBJECTS[user.class_name] : ['General Notes'];
    const uploadedSubjects = [...new Set(notes.map(n => n.subject))].filter(Boolean);
    const uniqueSubjects = [...new Set([...defaultSubjects, ...uploadedSubjects])];

    const filteredBySubject = activeSubject ? notes.filter(n => n.subject === activeSubject) : [];

    return (
        <>
            {showBlackout && (
                <div className={styles.blackoutOverlay}>
                    Screenshots and Screen Sharing are disabled for security.
                </div>
            )}
            
            {selectedNoteUrl && ReactDOM.createPortal(
                <div className={styles.noteViewerModal}>
                    <button onClick={() => setSelectedNoteUrl(null)} className={styles.closeBtn}>Close Notes</button>
                    
                    {/* Secure Watermark Overlay */}
                    <div style={{
                        position: 'absolute',
                        inset: 0,
                        backgroundImage: `url(${watermarkUrl})`,
                        backgroundRepeat: 'repeat',
                        pointerEvents: 'none',
                        zIndex: 9999
                    }} />

                    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', paddingBottom: '2rem' }}>
                        <Document 
                            file={selectedNoteUrl} 
                            onLoadSuccess={onDocumentLoadSuccess}
                            loading={<p style={{ color: 'white' }}>Loading secure document...</p>}
                            error={<p style={{ color: 'white' }}>Failed to load document securely.</p>}
                        >
                            {Array.from(new Array(numPages || 0), (el, index) => (
                                <Page 
                                    key={`page_${index + 1}`} 
                                    pageNumber={index + 1} 
                                    renderTextLayer={false} 
                                    renderAnnotationLayer={false} 
                                    width={window.innerWidth < 768 ? window.innerWidth * 0.9 : 800}
                                    style={{ marginBottom: '1rem', borderRadius: '8px', overflow: 'hidden' }}
                                />
                            ))}
                        </Document>
                    </div>
                </div>,
                document.body
            )}

            <div 
                className={`glass-panel animate-fade-in`} 
                style={{ padding: '2rem', userSelect: 'none' }}
                onContextMenu={(e) => {
                    if (import.meta.env.PROD) e.preventDefault();
                }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
                    <h2 style={{ color: 'var(--color-text-main)', margin: 0, fontSize: '1.8rem', fontWeight: '300' }}>
                        {activeSubject ? (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <button 
                                    onClick={() => setActiveSubject(null)} 
                                    style={{ background: 'transparent', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', fontSize: '1.5rem', padding: '0 0.5rem 0 0' }}
                                    title="Back to Subjects"
                                >
                                    ←
                                </button>
                                Study Notes / <span style={{ color: 'var(--color-primary)', fontWeight: '600' }}>{activeSubject}</span>
                            </span>
                        ) : (
                            'Study Notes Subjects'
                        )}
                    </h2>
                </div>
                
                {loading ? <p style={{ color: 'var(--color-text-muted)' }}>Loading notes...</p> : (
                    <>
                        {/* Level 1: Subjects */}
                        {!activeSubject && (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
                                {uniqueSubjects.map(sub => {
                                    const meta = getSubjectMeta(sub);
                                    const count = notes.filter(n => n.subject === sub).length;
                                    return (
                                        <FolderCard 
                                            key={sub} 
                                            title={sub} 
                                            count={count} 
                                            onClick={() => setActiveSubject(sub)} 
                                            color={meta.color} 
                                            emoji={meta.emoji} 
                                        />
                                    );
                                })}
                            </div>
                        )}

                        {/* Level 2: Notes List */}
                        {activeSubject && (
                            filteredBySubject.length === 0 ? (
                                <div style={{ 
                                    textAlign: 'center', 
                                    padding: '3rem 1.5rem', 
                                    background: 'var(--color-surface-hover)', 
                                    borderRadius: '12px',
                                    border: '1px dashed var(--color-border)'
                                }}>
                                    <div style={{ fontSize: '3.5rem', marginBottom: '0.75rem' }}>{getSubjectMeta(activeSubject).emoji}</div>
                                    <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--color-text-main)' }}>No Notes Available Yet</h3>
                                    <p style={{ color: 'var(--color-text-muted)' }}>
                                        Your teacher has not uploaded any study notes for {activeSubject} yet.
                                    </p>
                                </div>
                            ) : (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1.5rem' }}>
                                    {filteredBySubject.map(n => (
                                        <div key={n.id} style={{ 
                                            background: 'var(--color-surface-hover)', 
                                            padding: '1.25rem', 
                                            borderRadius: '8px', 
                                            border: '1px solid var(--color-border)', 
                                            display: 'flex', 
                                            flexDirection: 'column',
                                            transition: 'transform 0.2s, box-shadow 0.2s',
                                        }}
                                        onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.2)'; }}
                                        onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
                                        >
                                            <h3 style={{ 
                                                margin: '0 0 0.5rem 0', 
                                                background: 'linear-gradient(135deg, #f43f5e 0%, #fb923c 100%)', 
                                                WebkitBackgroundClip: 'text', 
                                                WebkitTextFillColor: 'transparent',
                                                fontSize: '1.15rem',
                                                fontWeight: '700'
                                            }}>
                                                {n.title}
                                            </h3>
                                            <p style={{ margin: '0 0 1rem 0', color: 'var(--color-text-muted)', fontSize: '0.9rem', flex: 1 }}>
                                                {n.description || 'No description provided.'}
                                            </p>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
                                                <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                                                    {new Date(n.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                </span>
                                                <button 
                                                    onClick={() => setSelectedNoteUrl(n.file_url)}
                                                    style={{ 
                                                        background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', 
                                                        color: '#ffffff', 
                                                        border: 'none', 
                                                        padding: '0.4rem 0.9rem', 
                                                        borderRadius: '6px', 
                                                        cursor: 'pointer',
                                                        fontWeight: '600',
                                                        fontSize: '0.9rem'
                                                    }}
                                                >
                                                    Read Note
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )
                        )}
                    </>
                )}
            </div>
        </>
    );
};

export default StudentNotesTab;
