import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import styles from './Login.module.css';

const Register = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
      fullName: '',
      fatherName: '',
      phone: '',
      class_name: '10',
      email: '',
      password: '',
      confirmPassword: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setError('');
    setSuccess('');
    setIsLoading(true);
    
    try {
        const { confirmPassword, ...registerData } = formData;
        const res = await fetch((import.meta.env.VITE_BACKEND_URL || '') + '/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(registerData)
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
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input 
                  type={showPassword ? "text" : "password"} 
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  required
                  placeholder="Create a password"
                  style={{ width: '100%', paddingRight: '2.5rem' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ position: 'absolute', right: '0.75rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className={styles.inputGroup}>
              <label>Confirm Password</label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input 
                  type={showConfirmPassword ? "text" : "password"} 
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                  required
                  placeholder="Confirm your password"
                  style={{ width: '100%', paddingRight: '2.5rem' }}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={{ position: 'absolute', right: '0.75rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
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
