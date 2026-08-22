import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import styles from './Tabs.module.css';

const QuizzesTab = () => {
    const { user } = useAuth();
    const [view, setView] = useState('list'); // 'list' or 'add'
    const [quizzes, setQuizzes] = useState([]);
    const [loading, setLoading] = useState(true);

    // Form State
    const [title, setTitle] = useState('');
    const [className, setClassName] = useState('10');
    const [questions, setQuestions] = useState([{ question: '', option_a: '', option_b: '', option_c: '', option_d: '', correct_option: 'A' }]);
    const [status, setStatus] = useState({ type: '', message: '' });

    useEffect(() => {
        if (view === 'list') {
            fetchQuizzes();
        }
    }, [view]);

    const fetchQuizzes = async () => {
        setLoading(true);
        try {
            const res = await fetch((import.meta.env.VITE_BACKEND_URL || '') + '/api/quizzes', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            const data = await res.json();
            if (res.ok) setQuizzes(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this quiz?')) return;
        try {
            const res = await fetch(`${import.meta.env.VITE_BACKEND_URL || ''}/api/quizzes/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            if (res.ok) {
                setQuizzes(quizzes.filter(q => q.id !== id));
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleAddQuestion = () => {
        setQuestions([...questions, { question: '', option_a: '', option_b: '', option_c: '', option_d: '', correct_option: 'A' }]);
    };

    const handleQuestionChange = (index, field, value) => {
        const newQuestions = [...questions];
        newQuestions[index][field] = value;
        setQuestions(newQuestions);
    };

    const handleRemoveQuestion = (index) => {
        if (questions.length === 1) return;
        const newQuestions = questions.filter((_, i) => i !== index);
        setQuestions(newQuestions);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setStatus({ type: 'loading', message: 'Creating quiz...' });
        try {
            const res = await fetch((import.meta.env.VITE_BACKEND_URL || '') + '/api/quizzes', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ title, class_name: className, questions })
            });
            if (res.ok) {
                setStatus({ type: 'success', message: 'Quiz created successfully!' });
                setTitle('');
                setQuestions([{ question: '', option_a: '', option_b: '', option_c: '', option_d: '', correct_option: 'A' }]);
                setTimeout(() => setView('list'), 1500);
            } else {
                setStatus({ type: 'error', message: 'Failed to create quiz' });
            }
        } catch (err) {
            setStatus({ type: 'error', message: err.message });
        }
    };

    if (view === 'list') {
        return (
            <div className={`glass-panel animate-fade-in`} style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h2 style={{ color: 'var(--color-primary)', margin: 0 }}>Manage Quizzes</h2>
                    <button onClick={() => setView('add')} className={styles.submitBtn} style={{ margin: 0 }}>
                        + Create Quiz
                    </button>
                </div>

                {loading ? <p>Loading...</p> : quizzes.length === 0 ? <p>No quizzes found.</p> : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
                        {quizzes.map((q) => (
                            <div key={q.id} className={styles.card} style={{ padding: '1.5rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--color-text-main)' }}>{q.title}</h3>
                                    <span style={{ background: 'var(--color-bg-secondary)', padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.8rem' }}>
                                        Class {q.class_name}
                                    </span>
                                </div>
                                <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>Created on {new Date(q.created_at).toLocaleDateString()}</p>
                                <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
                                    <button 
                                        onClick={() => handleDelete(q.id)}
                                        style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', flex: 1 }}
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className={`glass-panel ${styles.tabContainer} animate-fade-in`} style={{ maxWidth: '800px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ margin: 0 }}>Create New Quiz</h2>
                <button onClick={() => setView('list')} style={{ background: 'transparent', color: 'var(--color-text-muted)', border: 'none', cursor: 'pointer' }}>Cancel</button>
            </div>

            <form onSubmit={handleSubmit} className={styles.form}>
                <div className={styles.inputGroup}>
                    <label>Quiz Title</label>
                    <input required type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Science Chapter 1 Test" />
                </div>
                <div className={styles.inputGroup}>
                    <label>Target Class</label>
                    <select value={className} onChange={e => setClassName(e.target.value)} className={styles.selectInput}>
                        <option value="8">Class 8</option>
                        <option value="9">Class 9</option>
                        <option value="10">Class 10</option>
                        <option value="12">Class 12</option>
                        <option value="General">General / Other</option>
                    </select>
                </div>

                <div style={{ marginTop: '2rem' }}>
                    <h3 style={{ color: 'var(--color-primary)', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem' }}>Questions</h3>
                    
                    {questions.map((q, index) => (
                        <div key={index} style={{ background: 'var(--color-bg-secondary)', padding: '1.5rem', borderRadius: '8px', marginBottom: '1rem', position: 'relative' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                <strong>Question {index + 1}</strong>
                                {questions.length > 1 && (
                                    <button type="button" onClick={() => handleRemoveQuestion(index)} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}>Remove</button>
                                )}
                            </div>
                            
                            <div className={styles.inputGroup}>
                                <input required type="text" value={q.question} onChange={e => handleQuestionChange(index, 'question', e.target.value)} placeholder="Enter question text..." />
                            </div>
                            
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
                                <div className={styles.inputGroup}>
                                    <label>Option A</label>
                                    <input required type="text" value={q.option_a} onChange={e => handleQuestionChange(index, 'option_a', e.target.value)} />
                                </div>
                                <div className={styles.inputGroup}>
                                    <label>Option B</label>
                                    <input required type="text" value={q.option_b} onChange={e => handleQuestionChange(index, 'option_b', e.target.value)} />
                                </div>
                                <div className={styles.inputGroup}>
                                    <label>Option C</label>
                                    <input required type="text" value={q.option_c} onChange={e => handleQuestionChange(index, 'option_c', e.target.value)} />
                                </div>
                                <div className={styles.inputGroup}>
                                    <label>Option D</label>
                                    <input required type="text" value={q.option_d} onChange={e => handleQuestionChange(index, 'option_d', e.target.value)} />
                                </div>
                            </div>
                            
                            <div className={styles.inputGroup} style={{ marginTop: '1rem' }}>
                                <label>Correct Answer</label>
                                <select value={q.correct_option} onChange={e => handleQuestionChange(index, 'correct_option', e.target.value)} className={styles.selectInput}>
                                    <option value="A">Option A</option>
                                    <option value="B">Option B</option>
                                    <option value="C">Option C</option>
                                    <option value="D">Option D</option>
                                </select>
                            </div>
                        </div>
                    ))}
                    
                    <button type="button" onClick={handleAddQuestion} style={{ background: 'transparent', color: 'var(--color-primary)', border: '1px dashed var(--color-primary)', padding: '0.75rem', borderRadius: '8px', width: '100%', cursor: 'pointer', fontWeight: 'bold' }}>
                        + Add Another Question
                    </button>
                </div>

                {status.message && (
                    <div className={status.type === 'error' ? styles.errorMsg : styles.successMsg} style={{ marginTop: '1.5rem' }}>
                        {status.message}
                    </div>
                )}

                <button type="submit" disabled={status.type === 'loading'} className={styles.submitBtn} style={{ marginTop: '1.5rem' }}>
                    {status.type === 'loading' ? 'Saving...' : 'Save Quiz'}
                </button>
            </form>
        </div>
    );
};

export default QuizzesTab;
