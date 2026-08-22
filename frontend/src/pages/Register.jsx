import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import styles from './Login.module.css';

const Register = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
      fullName: '',
      fatherName: '',
      phone: '',
      class_name: '10',
      email: '',
      password: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);
    
    try {
        const res = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });
        
        const data = await res.json();
        
        if (!res.ok) {
            throw new Error(data.error || 'Registration failed');
        }
        
        setSuccess('Registration successful! Please wait for teacher approval before logging in.');
        setTimeout(() => {
            navigate('/login');
        }, 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.loginContainer}>
      <div className={styles.formSection} style={{ overflowY: 'auto' }}>
        <div className={`animate-fade-in ${styles.formContent}`}>
          <div className={styles.header}>
            <div className={styles.logo}>C</div>
            <h2>Create an Account</h2>
            <p>Welcome! Please enter your details to register.</p>
          </div>
          
          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.inputGroup}>
              <label>Full Name</label>
              <input 
                type="text" 
                value={formData.fullName}
                onChange={(e) => setFormData({...formData, fullName: e.target.value})}
                required
                placeholder="Enter your full name"
              />
            </div>

            <div className={styles.inputGroup}>
              <label>Father's Name</label>
              <input 
                type="text" 
                value={formData.fatherName}
                onChange={(e) => setFormData({...formData, fatherName: e.target.value})}
                required
                placeholder="Enter your father's name"
              />
            </div>

            <div className={styles.inputGroup}>
              <label>Phone Number</label>
              <input 
                type="text" 
                value={formData.phone}
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
                required
                placeholder="Enter your phone number"
              />
            </div>

            <div className={styles.inputGroup}>
              <label>Class</label>
              <select 
                value={formData.class_name} 
                onChange={(e) => setFormData({...formData, class_name: e.target.value})}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg-secondary)', color: 'var(--color-text-main)' }}
              >
                <option value="8">Class 8</option>
                <option value="9">Class 9</option>
                <option value="10">Class 10</option>
                <option value="12">Class 12</option>
                <option value="General">General / Other</option>
              </select>
            </div>
            
            <div className={styles.inputGroup}>
              <label>Email</label>
              <input 
                type="email" 
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                required
                placeholder="Enter your email"
              />
            </div>
            
            <div className={styles.inputGroup}>
              <label>Password</label>
              <input 
                type="password" 
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
                required
                placeholder="Create a password"
              />
            </div>

            {error && <div className={styles.error}>{error}</div>}
            {success && <div style={{ color: '#10b981', padding: '0.75rem', backgroundColor: 'rgba(16, 185, 129, 0.1)', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.875rem' }}>{success}</div>}

            <button type="submit" disabled={isLoading} className={styles.submitBtn}>
              {isLoading ? 'Registering...' : 'Register'}
            </button>
          </form>

          <p className={styles.signupText}>
            Already have an account? <Link to="/login">Log in</Link>
          </p>
        </div>
      </div>
      
      <div className={styles.imageSection}>
        <div className={styles.imageOverlay}></div>
      </div>
    </div>
  );
};

export default Register;
