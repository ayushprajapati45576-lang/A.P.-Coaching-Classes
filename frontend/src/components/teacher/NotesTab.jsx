import React, { useState, useEffect } from 'react';
import styles from './Tabs.module.css';

const NotesTab = () => {
    const [view, setView] = useState('list'); // 'list' or 'add'
    
    // Navigation State
    const [activeClass, setActiveClass] = useState(null); // '10', '12', 'General'
    const [activeSubject, setActiveSubject] = useState(null); // e.g., 'Maths', 'Science'

    // List State
    const [notes, setNotes] = useState([]);
    const [loading, setLoading] = useState(true);

    // Form State
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [className, setClassName] = useState('10');
    const [subject, setSubject] = useState('');
    const [file, setFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState('');
    const [status, setStatus] = useState({ type: '', message: '' });

    useEffect(() => {
        if (view === 'list') {
            fetchNotes();
        }
    }, [view]);

    const fetchNotes = async () => {
        setLoading(true);
        try {
            const res = await fetch((import.meta.env.VITE_BACKEND_URL || '') + '/api/notes', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            const data = await res.json();
            if (res.ok) setNotes(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure you want to delete this note?")) return;
        try {
            const res = await fetch(`${import.meta.env.VITE_BACKEND_URL || ''}/api/notes/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            if (res.ok) {
                setNotes(notes.filter(n => n.id !== id));
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!file || !subject) {
            setStatus({ type: 'error', message: 'Please select a file and enter a subject' });
            return;
        }

        setStatus({ type: 'loading', message: 'Uploading note...' });

        const formData = new FormData();
        formData.append('title', title);
        formData.append('description', description);
        formData.append('class_name', className);
        formData.append('subject', subject);
        formData.append('file', file);

        try {
            const res = await fetch((import.meta.env.VITE_BACKEND_URL || '') + '/api/notes', {
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
                setTimeout(() => setView('list'), 1500);
            } else {
                setStatus({ type: 'error', message: data.error || 'Failed to upload note' });
            }
        } catch (err) {
            setStatus({ type: 'error', message: err.message });
        }
    };

    const handleUploadClick = () => {
        setClassName(activeClass || '10');
        setSubject(activeSubject || '');
        setView('add');
    };

    const FolderCard = ({ title, count, onClick, color, emoji = '📁' }) => (
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
            <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>{emoji}</div>
            <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--color-text-main)', fontSize: '1.4rem', fontWeight: '500' }}>{title}</h3>
            {count !== undefined && <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>{count} Items</p>}
        </div>
    );

    if (view === 'list') {
        const filteredByClass = activeClass ? notes.filter(n => n.class_name === activeClass) : [];
        const uniqueSubjects = [...new Set(filteredByClass.map(n => n.subject))].filter(Boolean);
        const filteredBySubject = activeSubject ? filteredByClass.filter(n => n.subject === activeSubject) : [];

        return (
            <div className={`glass-panel animate-fade-in`} style={{ padding: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
                    <h2 style={{ color: 'var(--color-text-main)', margin: 0, fontSize: '1.8rem', fontWeight: '300' }}>
                        {activeSubject ? (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <button onClick={() => setActiveSubject(null)} style={{ background: 'transparent', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', fontSize: '1.5rem', padding: 0 }}>←</button>
                                {['8', '9', '10', '11', '12'].includes(activeClass) ? `Class ${activeClass}` : activeClass} / {activeSubject}
                            </span>
                        ) : activeClass ? (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <button onClick={() => setActiveClass(null)} style={{ background: 'transparent', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', fontSize: '1.5rem', padding: 0 }}>←</button>
                                {['8', '9', '10', '11', '12'].includes(activeClass) ? `Class ${activeClass}` : activeClass} Subjects
                            </span>
                        ) : (
                            'Study Notes Folders'
                        )}
                    </h2>
                    
                    <button onClick={handleUploadClick} className={styles.submitBtn} style={{ margin: 0, padding: '0.6rem 1.2rem', borderRadius: '6px' }}>
                        + Upload Note
                    </button>
                </div>

                {loading ? <p style={{ color: 'var(--color-text-muted)' }}>Loading notes...</p> : (
                    <>
                        {/* Level 1: Classes */}
                        {!activeClass && (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem' }}>
                                <FolderCard title="Class 8" count={notes.filter(n => n.class_name === '8').length} onClick={() => setActiveClass('8')} color="#a78bfa" emoji="📐" />
                                <FolderCard title="Class 9" count={notes.filter(n => n.class_name === '9').length} onClick={() => setActiveClass('9')} color="#fb923c" emoji="🔬" />
                                <FolderCard title="Class 10" count={notes.filter(n => n.class_name === '10').length} onClick={() => setActiveClass('10')} color="#60a5fa" emoji="🎒" />
                                <FolderCard title="Class 11" count={notes.filter(n => n.class_name === '11').length} onClick={() => setActiveClass('11')} color="#fcd34d" emoji="🏫" />
                                <FolderCard title="Class 12" count={notes.filter(n => n.class_name === '12').length} onClick={() => setActiveClass('12')} color="#34d399" emoji="🎓" />
                                <FolderCard title="General" count={notes.filter(n => n.class_name === 'General').length} onClick={() => setActiveClass('General')} color="#f472b6" emoji="📚" />
                            </div>
                        )}

                        {/* Level 2: Subjects */}
                        {activeClass && !activeSubject && (
                            uniqueSubjects.length === 0 ? <p style={{ color: 'var(--color-text-muted)' }}>No subjects found in {['8', '9', '10', '11', '12'].includes(activeClass) ? `Class ${activeClass}` : activeClass}. Upload a note to create a subject folder.</p> :
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem' }}>
                                {uniqueSubjects.map(sub => (
                                    <FolderCard key={sub} title={sub} count={filteredByClass.filter(n => n.subject === sub).length} onClick={() => setActiveSubject(sub)} color="#fbbf24" emoji="📘" />
                                ))}
                            </div>
                        )}

                        {/* Level 3: Notes List */}
                        {activeSubject && (
                            filteredBySubject.length === 0 ? <p style={{ color: 'var(--color-text-muted)' }}>No notes in this subject.</p> :
                            <div style={{ overflowX: 'auto', background: 'var(--color-surface-hover)', borderRadius: '8px', padding: '1rem' }}>
                                <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                                            <th style={{ padding: '0.75rem', color: 'var(--color-text-muted)' }}>Title</th>
                                            <th style={{ padding: '0.75rem', color: 'var(--color-text-muted)' }}>Description</th>
                                            <th style={{ padding: '0.75rem', color: 'var(--color-text-muted)' }}>Date</th>
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
                                                }}>{n.title}</td>
                                                <td style={{ padding: '0.75rem', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.description}</td>
                                                <td style={{ padding: '0.75rem', fontSize: '0.9rem' }}>{new Date(n.created_at).toLocaleDateString()}</td>
                                                <td style={{ padding: '0.75rem' }}>
                                                    <a href={n.file_url} target="_blank" rel="noreferrer" style={{ 
                                                        background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', 
                                                        color: '#ffffff', 
                                                        padding: '0.4rem 0.8rem', 
                                                        borderRadius: '6px', 
                                                        marginRight: '0.75rem', 
                                                        textDecoration: 'none', 
                                                        fontWeight: '500',
                                                        display: 'inline-block'
                                                    }}>View</a>
                                                    <button onClick={() => handleDelete(n.id)} style={{ 
                                                        background: 'rgba(239, 68, 68, 0.15)', 
                                                        color: '#ef4444', 
                                                        border: '1px solid rgba(239, 68, 68, 0.3)', 
                                                        padding: '0.4rem 0.8rem', 
                                                        borderRadius: '6px',
                                                        cursor: 'pointer',
                                                        fontWeight: '500'
                                                    }}>Delete</button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </>
                )}
            </div>
        );
    }

    return (
        <div className={`glass-panel ${styles.tabContainer} animate-fade-in`}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <h2 style={{ margin: 0 }}>Upload Study Note</h2>
                <button onClick={() => setView('list')} className={styles.cancelBtn}>Cancel</button>
            </div>

            <form onSubmit={handleSubmit} className={styles.form}>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
                    <div className={styles.inputGroup} style={{ flex: 1, minWidth: '200px', marginBottom: 0 }}>
                        <label>Class Category</label>
                        <select required value={className} onChange={e => {
                            const newClass = e.target.value;
                            setClassName(newClass);
                            if (['8', '9', '10'].includes(newClass)) setSubject('Maths');
                            else if (newClass === '12') setSubject('Physics');
                            else setSubject('General Notes');
                        }}>
                            <option value="8">Class 8</option>
                            <option value="9">Class 9</option>
                            <option value="10">Class 10</option>
                            <option value="11">Class 11</option>
                            <option value="12">Class 12</option>
                            <option value="General">General</option>
                        </select>
                    </div>
                    <div className={styles.inputGroup} style={{ flex: 1, minWidth: '200px', marginBottom: 0 }}>
                        <label>Subject Folder Name</label>
                        <select required value={subject} onChange={e => setSubject(e.target.value)}>
                            {['8', '9', '10'].includes(className) && (
                                <>
                                    <option value="Maths">Maths</option>
                                    <option value="Science">Science</option>
                                    <option value="Social Science">Social Science</option>
                                    <option value="English">English</option>
                                    <option value="Hindi">Hindi</option>
                                    <option value="Sanskrit">Sanskrit</option>
                                </>
                            )}
                            {className === '12' && (
                                <>
                                    <option value="Physics">Physics</option>
                                    <option value="Chemistry">Chemistry</option>
                                    <option value="Mathematics">Mathematics</option>
                                    <option value="Biology">Biology</option>
                                    <option value="English">English</option>
                                    <option value="Physical Education">Physical Education</option>
                                    <option value="Computer Science">Computer Science</option>
                                </>
                            )}
                            {className === 'General' && (
                                <option value="General Notes">General Notes</option>
                            )}
                        </select>
                    </div>
                </div>

                <div className={styles.inputGroup}>
                    <label>Note Title</label>
                    <input required type="text" placeholder="e.g. Chapter 1 Electricity Notes" value={title} onChange={e => setTitle(e.target.value)} />
                </div>
                <div className={styles.inputGroup}>
                    <label>Short Description (Optional)</label>
                    <textarea value={description} onChange={e => setDescription(e.target.value)} rows="2"></textarea>
                </div>
                <div className={styles.inputGroup}>
                    <label>PDF or Image File</label>
                    <input required type="file" accept="application/pdf,image/*" onChange={e => {
                        const selectedFile = e.target.files[0];
                        setFile(selectedFile);
                        if (selectedFile) {
                            setPreviewUrl(URL.createObjectURL(selectedFile));
                        } else {
                            setPreviewUrl('');
                        }
                    }} className={styles.fileInput} />
                </div>

                {previewUrl && (
                    <div style={{ marginTop: '1rem', border: '1px solid var(--color-border)', borderRadius: '4px', padding: '0.5rem', background: 'rgba(0,0,0,0.2)' }}>
                        <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '0.5rem' }}>Preview:</p>
                        {file && file.type.startsWith('image/') ? (
                            <img src={previewUrl} alt="Preview" style={{ maxWidth: '100%', maxHeight: '200px', objectFit: 'contain', borderRadius: '4px' }} />
                        ) : (
                            <iframe src={previewUrl} title="PDF Preview" style={{ width: '100%', height: '200px', border: 'none', borderRadius: '4px' }} />
                        )}
                    </div>
                )}

                {status.message && (
                    <div className={status.type === 'error' ? styles.errorMsg : styles.successMsg}>
                        {status.message}
                    </div>
                )}

                <button type="submit" disabled={status.type === 'loading'} className={styles.submitBtn} style={{ marginTop: '1rem' }}>
                    Upload Note to Folder
                </button>
            </form>
        </div>
    );
};

export default NotesTab;
