import React, { useState, useEffect } from 'react';
import styles from './Tabs.module.css';

// Pre-defined subjects per class
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

// Distinct colors and emojis for subjects
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
    'General Notes': { emoji: '📚', color: '#f472b6' },
    'Important Material': { emoji: '⭐', color: '#eab308' },
    'Sample Papers': { emoji: '📝', color: '#a855f7' }
};

const getSubjectMeta = (sub) => {
    return SUBJECT_META[sub] || { emoji: '📁', color: '#fbbf24' };
};

// Smart backend URL: auto-detects localhost to prevent calling old production Vercel
const getBackendUrl = () => {
    if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
        return 'http://localhost:5000';
    }
    return import.meta.env.VITE_BACKEND_URL || '';
};

const NotesTab = () => {
    const [view, setView] = useState('list'); // 'list' or 'add'
    
    // Navigation State (Hierarchy: Level 1 Class -> Level 2 Subject -> Level 3 Notes)
    const [activeClass, setActiveClass] = useState(null); // '6', '7', '8', '9', '10', '11', '12', 'General'
    const [activeSubject, setActiveSubject] = useState(null); // e.g., 'Maths', 'Science'

    // List State
    const [notes, setNotes] = useState([]);
    const [loading, setLoading] = useState(true);

    // Form State
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [className, setClassName] = useState('10');
    const [subject, setSubject] = useState('Maths');
    const [isCustomSubject, setIsCustomSubject] = useState(false);
    const [customSubject, setCustomSubject] = useState('');
    const [file, setFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState('');
    const [status, setStatus] = useState({ type: '', message: '' });

    useEffect(() => {
        if (view === 'list') {
            fetchNotes();
        }
    }, [view]);

    // Handle Browser Back button (popstate) to navigate backwards through folders instead of exiting to dashboard
    useEffect(() => {
        const handlePopState = () => {
            if (view === 'add') {
                setView('list');
                return;
            }
            if (activeSubject) {
                setActiveSubject(null);
                return;
            }
            if (activeClass) {
                setActiveClass(null);
                return;
            }
        };

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [view, activeSubject, activeClass]);

    const fetchNotes = async () => {
        setLoading(true);
        try {
            const res = await fetch(getBackendUrl() + '/api/notes', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            const data = await res.json();
            if (res.ok && Array.isArray(data)) {
                setNotes(data);
            }
        } catch (err) {
            console.error('Error fetching notes:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure you want to delete this note?")) return;
        try {
            const res = await fetch(`${getBackendUrl()}/api/notes/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            if (res.ok) {
                setNotes(notes.filter(n => n.id !== id));
            } else {
                alert('Failed to delete note');
            }
        } catch (err) {
            console.error('Error deleting note:', err);
            alert('Failed to delete note');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setStatus({ type: '', message: '' });

        const finalSubject = (isCustomSubject ? customSubject : subject)?.trim();

        if (!title.trim()) {
            setStatus({ type: 'error', message: 'Please enter a note title' });
            return;
        }
        if (!finalSubject) {
            setStatus({ type: 'error', message: 'Please select or enter a subject name' });
            return;
        }
        if (!file) {
            setStatus({ type: 'error', message: 'Please select a PDF or image file' });
            return;
        }

        if (file.size > 20 * 1024 * 1024) {
            setStatus({ type: 'error', message: `File is too large (${(file.size / (1024 * 1024)).toFixed(1)} MB). Maximum allowed size is 20 MB. Please compress your PDF.` });
            return;
        }

        setStatus({ type: 'loading', message: 'Uploading note to server...' });

        const formData = new FormData();
        formData.append('title', title.trim());
        formData.append('description', description.trim());
        formData.append('class_name', className);
        formData.append('subject', finalSubject);
        formData.append('file', file);

        try {
            const res = await fetch(getBackendUrl() + '/api/notes', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: formData
            });

            const data = await res.json();
            if (res.ok) {
                setStatus({ type: 'success', message: 'Note uploaded successfully!' });
                setTitle('');
                setDescription('');
                setFile(null);
                setPreviewUrl('');
                setIsCustomSubject(false);
                setCustomSubject('');
                fetchNotes();
                // Stay on the class and subject folder where the note was uploaded
                setActiveClass(className);
                setActiveSubject(finalSubject);
                setTimeout(() => setView('list'), 1000);
            } else {
                setStatus({ type: 'error', message: data.error || 'Failed to upload note' });
            }
        } catch (err) {
            setStatus({ type: 'error', message: err.message || 'Upload failed due to network error' });
        }
    };

    const handleUploadClick = () => {
        const targetClass = activeClass || '10';
        const availableSubs = CLASS_SUBJECTS[targetClass] || CLASS_SUBJECTS['10'];
        const chosenSub = activeSubject || availableSubs[0];
        
        setClassName(targetClass);
        setSubject(chosenSub);
        setIsCustomSubject(false);
        setCustomSubject('');
        setStatus({ type: '', message: '' });

        try {
            window.history.pushState({ notesStep: 'add' }, '', window.location.href);
        } catch (e) {}

        setView('add');
    };

    const handleBackFromAdd = () => {
        if (window.history.state && window.history.state.notesStep === 'add') {
            window.history.back();
        } else {
            setView('list');
        }
    };

    const handleSelectClass = (cls) => {
        setActiveClass(cls);
        setActiveSubject(null);
        try {
            window.history.pushState({ notesStep: 'class', class: cls }, '', window.location.href);
        } catch (e) {}
    };

    const handleBackToClasses = () => {
        setActiveClass(null);
        setActiveSubject(null);
        if (window.history.state && (window.history.state.notesStep === 'class' || window.history.state.notesStep === 'subject')) {
            try { window.history.back(); } catch (e) {}
        }
    };

    const handleSelectSubject = (sub) => {
        setActiveSubject(sub);
        try {
            window.history.pushState({ notesStep: 'subject', subject: sub }, '', window.location.href);
        } catch (e) {}
    };

    const handleBackToSubjects = () => {
        setActiveSubject(null);
        if (window.history.state && window.history.state.notesStep === 'subject') {
            try { window.history.back(); } catch (e) {}
        }
    };

    const FolderCard = ({ title, count, onClick, color, emoji = '📁', isAddCard = false }) => (
        <div onClick={onClick} style={{
            background: isAddCard 
                ? 'rgba(255, 255, 255, 0.45)'
                : `linear-gradient(135deg, var(--color-border) 0%, var(--color-surface-hover) 100%)`,
            border: isAddCard ? `2px dashed ${color}` : `1px solid ${color}`,
            borderRadius: '12px',
            padding: '1.75rem 1.25rem',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'transform 0.2s, box-shadow 0.2s',
            boxShadow: isAddCard ? 'none' : `0 4px 20px ${color}15`,
            position: 'relative'
        }}
        onMouseEnter={(e) => { 
            e.currentTarget.style.transform = 'translateY(-5px)'; 
            e.currentTarget.style.boxShadow = `0 8px 25px ${color}35`; 
        }}
        onMouseLeave={(e) => { 
            e.currentTarget.style.transform = 'translateY(0)'; 
            e.currentTarget.style.boxShadow = isAddCard ? 'none' : `0 4px 20px ${color}15`; 
        }}
        >
            <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>{emoji}</div>
            <h3 style={{ margin: '0 0 0.4rem 0', color: 'var(--color-text-main)', fontSize: '1.25rem', fontWeight: '600', textAlign: 'center' }}>
                {title}
            </h3>
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

    if (view === 'list') {
        const filteredByClass = activeClass ? notes.filter(n => n.class_name === activeClass) : [];
        
        // Subject Folders for the selected class: combine predefined subjects + any custom uploaded subjects
        const defaultSubjects = activeClass ? (CLASS_SUBJECTS[activeClass] || ['General Notes']) : [];
        const uploadedSubjects = activeClass ? [...new Set(filteredByClass.map(n => n.subject))].filter(Boolean) : [];
        const allSubjectsForClass = [...new Set([...defaultSubjects, ...uploadedSubjects])];

        const filteredBySubject = activeSubject ? filteredByClass.filter(n => n.subject === activeSubject) : [];

        return (
            <div className={`glass-panel animate-fade-in`} style={{ padding: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
                    <h2 style={{ color: 'var(--color-text-main)', margin: 0, fontSize: '1.8rem', fontWeight: '300' }}>
                        {activeSubject ? (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <button 
                                    onClick={handleBackToSubjects} 
                                    title="Back to Subjects"
                                    style={{ background: 'transparent', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', fontSize: '1.5rem', padding: '0 0.5rem 0 0' }}
                                >
                                    ←
                                </button>
                                {['6', '7', '8', '9', '10', '11', '12'].includes(activeClass) ? `Class ${activeClass}` : activeClass} / <span style={{ color: 'var(--color-primary)', fontWeight: '600' }}>{activeSubject}</span>
                            </span>
                        ) : activeClass ? (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <button 
                                    onClick={handleBackToClasses} 
                                    title="Back to All Classes"
                                    style={{ background: 'transparent', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', fontSize: '1.5rem', padding: '0 0.5rem 0 0' }}
                                >
                                    ←
                                </button>
                                {['6', '7', '8', '9', '10', '11', '12'].includes(activeClass) ? `Class ${activeClass}` : activeClass} Subject Folders
                            </span>
                        ) : (
                            'Study Notes — All Classes'
                        )}
                    </h2>
                    
                    <button onClick={handleUploadClick} className={styles.submitBtn} style={{ margin: 0, padding: '0.6rem 1.4rem', borderRadius: '6px' }}>
                        {activeSubject ? `+ Upload to ${activeSubject}` : '+ Upload Note'}
                    </button>
                </div>

                {loading ? <p style={{ color: 'var(--color-text-muted)' }}>Loading notes...</p> : (
                    <>
                        {/* ======================================================== */}
                        {/* LEVEL 1: ALL CLASS FOLDERS                               */}
                        {/* ======================================================== */}
                        {!activeClass && (
                            <div>
                                <p style={{ color: 'var(--color-text-muted)', marginBottom: '1.5rem' }}>
                                    Select a class to view its subject folders and uploaded study material:
                                </p>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
                                    <FolderCard title="Class 6" count={notes.filter(n => n.class_name === '6').length} onClick={() => handleSelectClass('6')} color="#ec4899" emoji="📖" />
                                    <FolderCard title="Class 7" count={notes.filter(n => n.class_name === '7').length} onClick={() => handleSelectClass('7')} color="#8b5cf6" emoji="📙" />
                                    <FolderCard title="Class 8" count={notes.filter(n => n.class_name === '8').length} onClick={() => handleSelectClass('8')} color="#a78bfa" emoji="📐" />
                                    <FolderCard title="Class 9" count={notes.filter(n => n.class_name === '9').length} onClick={() => handleSelectClass('9')} color="#fb923c" emoji="🔬" />
                                    <FolderCard title="Class 10" count={notes.filter(n => n.class_name === '10').length} onClick={() => handleSelectClass('10')} color="#60a5fa" emoji="🎒" />
                                    <FolderCard title="Class 11" count={notes.filter(n => n.class_name === '11').length} onClick={() => handleSelectClass('11')} color="#fcd34d" emoji="🏫" />
                                    <FolderCard title="Class 12" count={notes.filter(n => n.class_name === '12').length} onClick={() => handleSelectClass('12')} color="#34d399" emoji="🎓" />
                                    <FolderCard title="General" count={notes.filter(n => n.class_name === 'General').length} onClick={() => handleSelectClass('General')} color="#f472b6" emoji="📚" />
                                </div>
                            </div>
                        )}

                        {/* ======================================================== */}
                        {/* LEVEL 2: SUBJECT FOLDERS INSIDE SELECTED CLASS           */}
                        {/* ======================================================== */}
                        {activeClass && !activeSubject && (
                            <div>
                                <p style={{ color: 'var(--color-text-muted)', marginBottom: '1.5rem' }}>
                                    Click on a subject to open its notes, or upload a note directly:
                                </p>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
                                    {allSubjectsForClass.map(sub => {
                                        const meta = getSubjectMeta(sub);
                                        const count = filteredByClass.filter(n => n.subject === sub).length;
                                        return (
                                            <FolderCard 
                                                key={sub} 
                                                title={sub} 
                                                count={count} 
                                                onClick={() => handleSelectSubject(sub)} 
                                                color={meta.color} 
                                                emoji={meta.emoji} 
                                            />
                                        );
                                    })}
                                    {/* Add Custom Subject Button */}
                                    <FolderCard 
                                        title="+ Other Subject" 
                                        onClick={() => {
                                            setIsCustomSubject(true);
                                            setCustomSubject('');
                                            setSubject('');
                                            setClassName(activeClass);
                                            try {
                                                window.history.pushState({ notesStep: 'add' }, '', window.location.href);
                                            } catch (e) {}
                                            setView('add');
                                        }}
                                        color="var(--color-primary)" 
                                        emoji="➕" 
                                        isAddCard={true}
                                    />
                                </div>
                            </div>
                        )}

                        {/* ======================================================== */}
                        {/* LEVEL 3: NOTES LIST INSIDE SELECTED SUBJECT              */}
                        {/* ======================================================== */}
                        {activeSubject && (
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                                    <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>
                                        Showing all notes for <strong>{['6', '7', '8', '9', '10', '11', '12'].includes(activeClass) ? `Class ${activeClass}` : activeClass} · {activeSubject}</strong>
                                    </p>
                                </div>

                                {filteredBySubject.length === 0 ? (
                                    <div style={{ 
                                        textAlign: 'center', 
                                        padding: '3rem 1.5rem', 
                                        background: 'var(--color-surface-hover)', 
                                        borderRadius: '12px',
                                        border: '1px dashed var(--color-border)'
                                    }}>
                                        <div style={{ fontSize: '3.5rem', marginBottom: '0.75rem' }}>{getSubjectMeta(activeSubject).emoji}</div>
                                        <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--color-text-main)', fontSize: '1.3rem' }}>
                                            No notes uploaded in {activeSubject} yet
                                        </h3>
                                        <p style={{ color: 'var(--color-text-muted)', marginBottom: '1.5rem', maxWidth: '400px', margin: '0 auto 1.5rem auto' }}>
                                            Add the first study material (PDF or image) for your students in {activeSubject}.
                                        </p>
                                        <button 
                                            onClick={handleUploadClick} 
                                            className={styles.submitBtn} 
                                            style={{ padding: '0.6rem 1.4rem', borderRadius: '6px' }}
                                        >
                                            + Upload Note to {activeSubject}
                                        </button>
                                    </div>
                                ) : (
                                    <div style={{ width: '100%', maxWidth: '100%', overflowX: 'auto', background: 'var(--color-surface-hover)', borderRadius: '8px', padding: '1rem', boxSizing: 'border-box', WebkitOverflowScrolling: 'touch' }}>
                                        <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                                            <thead>
                                                <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                                                    <th style={{ padding: '0.75rem', color: 'var(--color-text-muted)' }}>Title</th>
                                                    <th style={{ padding: '0.75rem', color: 'var(--color-text-muted)' }}>Description</th>
                                                    <th style={{ padding: '0.75rem', color: 'var(--color-text-muted)' }}>Upload Date</th>
                                                    <th style={{ padding: '0.75rem', color: 'var(--color-text-muted)' }}>Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredBySubject.map((n) => (
                                                    <tr key={n.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                                                        <td style={{ 
                                                            padding: '0.75rem', 
                                                            background: 'linear-gradient(135deg, #f43f5e 0%, #fb923c 100%)', 
                                                            WebkitBackgroundClip: 'text', 
                                                            WebkitTextFillColor: 'transparent',
                                                            fontWeight: '700',
                                                            letterSpacing: '0.5px'
                                                        }}>
                                                            {n.title}
                                                        </td>
                                                        <td style={{ padding: '0.75rem', maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                            {n.description || '-'}
                                                        </td>
                                                        <td style={{ padding: '0.75rem', fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>
                                                            {new Date(n.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                        </td>
                                                        <td style={{ padding: '0.75rem' }}>
                                                            <a 
                                                                href={n.file_url} 
                                                                target="_blank" 
                                                                rel="noreferrer" 
                                                                style={{ 
                                                                    background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', 
                                                                    color: '#ffffff', 
                                                                    padding: '0.4rem 0.8rem', 
                                                                    borderRadius: '6px', 
                                                                    marginRight: '0.75rem', 
                                                                    textDecoration: 'none', 
                                                                    fontWeight: '500',
                                                                    display: 'inline-block'
                                                                }}
                                                            >
                                                                View
                                                            </a>
                                                            <button 
                                                                onClick={() => handleDelete(n.id)} 
                                                                style={{ 
                                                                    background: 'rgba(239, 68, 68, 0.15)', 
                                                                    color: '#ef4444', 
                                                                    border: '1px solid rgba(239, 68, 68, 0.3)', 
                                                                    padding: '0.4rem 0.8rem', 
                                                                    borderRadius: '6px', 
                                                                    cursor: 'pointer', 
                                                                    fontWeight: '500'
                                                                }}
                                                            >
                                                                Delete
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>
        );
    }

    // ========================================================
    // ADD NOTE VIEW / FORM
    // ========================================================
    return (
        <div className={`glass-panel ${styles.tabContainer} animate-fade-in`}>
            {/* Header with prominent Back arrow button and Back to Folder button */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <button 
                        type="button" 
                        onClick={handleBackFromAdd} 
                        title={`Back to ${activeSubject || (activeClass ? 'Class ' + activeClass : 'Notes')}`}
                        style={{ 
                            background: 'rgba(255, 255, 255, 0.85)', 
                            border: '1px solid var(--color-border)', 
                            color: 'var(--color-primary)', 
                            cursor: 'pointer', 
                            fontSize: '1.4rem', 
                            width: '42px',
                            height: '42px',
                            borderRadius: '8px', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            transition: 'all 0.2s ease',
                            padding: 0
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.transform = 'translateX(-2px)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.85)'; e.currentTarget.style.transform = 'translateX(0)'; }}
                    >
                        ←
                    </button>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '500' }}>
                            {activeSubject 
                                ? `Upload Note to Class ${className} / ${activeSubject}` 
                                : activeClass 
                                    ? `Upload Note to Class ${className}` 
                                    : 'Upload Study Note'}
                        </h2>
                        <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                            Folder: <strong>{['6', '7', '8', '9', '10', '11', '12'].includes(className) ? `Class ${className}` : className}</strong> {activeSubject && `· ${activeSubject}`}
                        </span>
                    </div>
                </div>

                <button 
                    type="button" 
                    onClick={handleBackFromAdd} 
                    className={styles.cancelBtn}
                    style={{ padding: '0.5rem 1.2rem', borderRadius: '6px', fontSize: '0.9rem' }}
                >
                    Back to {activeSubject || 'Folder'}
                </button>
            </div>

            <form onSubmit={handleSubmit} className={styles.form}>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
                    <div className={styles.inputGroup} style={{ flex: 1, minWidth: '200px', marginBottom: 0 }}>
                        <label>Class Category</label>
                        <select required value={className} onChange={e => {
                            const newClass = e.target.value;
                            setClassName(newClass);
                            const subs = CLASS_SUBJECTS[newClass] || ['General Notes'];
                            setSubject(subs[0]);
                            setIsCustomSubject(false);
                            setCustomSubject('');
                        }}>
                            <option value="6">Class 6</option>
                            <option value="7">Class 7</option>
                            <option value="8">Class 8</option>
                            <option value="9">Class 9</option>
                            <option value="10">Class 10</option>
                            <option value="11">Class 11</option>
                            <option value="12">Class 12</option>
                            <option value="General">General</option>
                        </select>
                    </div>

                    <div className={styles.inputGroup} style={{ flex: 1, minWidth: '200px', marginBottom: 0 }}>
                        <label>Subject Folder</label>
                        {!isCustomSubject ? (
                            <select 
                                required 
                                value={subject} 
                                onChange={e => {
                                    if (e.target.value === '__custom__') {
                                        setIsCustomSubject(true);
                                        setCustomSubject('');
                                    } else {
                                        setSubject(e.target.value);
                                    }
                                }}
                            >
                                {(CLASS_SUBJECTS[className] || ['General Notes']).map(sub => (
                                    <option key={sub} value={sub}>{sub}</option>
                                ))}
                                <option value="__custom__">➕ Other (Type Custom Subject)...</option>
                            </select>
                        ) : (
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <input 
                                    type="text" 
                                    placeholder="Type Subject Name..." 
                                    value={customSubject} 
                                    onChange={e => setCustomSubject(e.target.value)} 
                                    required 
                                    style={{ flex: 1 }}
                                    autoFocus
                                />
                                <button 
                                    type="button" 
                                    onClick={() => {
                                        setIsCustomSubject(false);
                                        const subs = CLASS_SUBJECTS[className] || ['General Notes'];
                                        setSubject(subs[0]);
                                    }}
                                    style={{ 
                                        padding: '0 0.8rem', 
                                        background: 'var(--color-surface)', 
                                        border: '1px solid var(--color-border)', 
                                        color: 'var(--color-text-main)', 
                                        borderRadius: '4px', 
                                        cursor: 'pointer',
                                        fontSize: '0.85rem'
                                    }}
                                >
                                    Select List
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <div className={styles.inputGroup}>
                    <label>Note Title *</label>
                    <input required type="text" placeholder="e.g. Chapter 1 Electricity Notes" value={title} onChange={e => setTitle(e.target.value)} />
                </div>
                <div className={styles.inputGroup}>
                    <label>Short Description (Optional)</label>
                    <textarea value={description} onChange={e => setDescription(e.target.value)} rows="2" placeholder="Brief summary of notes..."></textarea>
                </div>
                <div className={styles.inputGroup}>
                    <label>PDF or Image File *</label>
                    <input required type="file" accept="application/pdf,image/*" onChange={e => {
                        const selectedFile = e.target.files && e.target.files[0];
                        setFile(selectedFile || null);
                        if (selectedFile) {
                            setPreviewUrl(URL.createObjectURL(selectedFile));
                        } else {
                            setPreviewUrl('');
                        }
                    }} className={styles.fileInput} />
                </div>

                {previewUrl && (
                    <div style={{ marginTop: '1rem', border: '1px solid var(--color-border)', borderRadius: '4px', padding: '0.5rem', background: 'rgba(0,0,0,0.2)' }}>
                        <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '0.5rem' }}>File Preview:</p>
                        {file && file.type.startsWith('image/') ? (
                            <img src={previewUrl} alt="Preview" style={{ maxWidth: '100%', maxHeight: '200px', objectFit: 'contain', borderRadius: '4px' }} />
                        ) : (
                            <iframe src={previewUrl} title="PDF Preview" style={{ width: '100%', height: '200px', border: 'none', borderRadius: '4px' }} />
                        )}
                    </div>
                )}

                {status.message && (
                    <div className={status.type === 'error' ? styles.errorMsg : styles.successMsg} style={{ marginTop: '1rem' }}>
                        {status.message}
                    </div>
                )}

                <button type="submit" disabled={status.type === 'loading'} className={styles.submitBtn} style={{ marginTop: '1.5rem' }}>
                    {status.type === 'loading' ? 'Uploading...' : 'Upload Note to Folder'}
                </button>
            </form>
        </div>
    );
};

export default NotesTab;
