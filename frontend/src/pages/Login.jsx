import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import loginImage from '../assets/login-right-image.jpg';
import styles from './Login.module.css';

// Reusable 3D Rotating Cube Component with 6 Faces
const Cube = ({ className }) => (
  <div className={`${styles.cube} ${className || ''}`}>
    <i></i><i></i><i></i><i></i><i></i><i></i>
  </div>
);

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();

  // Prevent browser window scrollbar jumping on desktop (mobile keeps native smooth scroll)
  useEffect(() => {
    const isDesktop = window.innerWidth >= 900;
    const originalHtmlOverflow = document.documentElement.style.overflow;
    const originalBodyOverflow = document.body.style.overflow;
    
    if (isDesktop) {
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.documentElement.style.overflow = originalHtmlOverflow;
      document.body.style.overflow = originalBodyOverflow;
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    
    try {
      await login(email, password);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.loginContainer}>
      {/* Back to Home Button (Top-Left of Page) */}
      <Link to="/" className={styles.backHomeBtn}>
        <ArrowLeft size={18} />
        <span>Back to Home</span>
      </Link>

      {/* Main Unified Single Page Flex Wrapper (z-index 5, strictly in front of cubes) */}
      <div className={styles.mainWrapper}>
        {/* Left: Coaching Media Showcase Card (Clean display, no cubes) */}
        <div className={styles.imageSection}>
          <div className={styles.imageCard}>
            <img 
              src={loginImage} 
              alt="A.P. Coaching Classes by Anil Sir" 
              className={styles.showcaseImg} 
            />
          </div>
        </div>

        {/* Right: Floating Glass Login Card */}
        <div className={styles.formSection}>
          <div className={styles.cardContainer}>
            {/* Non-overlapping 3D Cubes strictly BEHIND the login card */}
            <div className={styles.cubePerspective}>
              <Cube className={styles.cubeA} />
              <Cube className={styles.cubeB} />
            </div>

            <div className={styles.floatingCard}>
              <div className={styles.header}>
                <img src="/logo.jpeg" alt="A.P. Coaching Logo" className={styles.logoImg} />
                <h2>Welcome back</h2>
                <p>Welcome back! Please enter your details.</p>
              </div>
              
              <form onSubmit={handleSubmit} className={styles.form}>
                <div className={styles.inputGroup}>
                  <label htmlFor="email">Email</label>
                  <input 
                    type="email" 
                    id="email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="Enter your email"
                  />
                </div>
                
                <div className={styles.inputGroup}>
                  <label htmlFor="password">Password</label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <input 
                      type={showPassword ? "text" : "password"} 
                      id="password" 
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      placeholder="Enter your password"
                      style={{ width: '100%', paddingRight: '2.5rem' }}
                    />
                    <button 
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{ 
                        position: 'absolute', 
                        right: '10px', 
                        background: 'transparent', 
                        border: 'none', 
                        cursor: 'pointer',
                        color: '#cbd5e1',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '0'
                      }}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div className={styles.formOptions}>
                  <label className={styles.checkboxLabel}>
                    <input type="checkbox" />
                    <span>Remember for 30 days</span>
                  </label>
                  <a href="#" className={styles.forgotLink}>Forgot password?</a>
                </div>

                {error && <div className={styles.error}>{error}</div>}

                <button type="submit" disabled={isLoading} className={styles.submitBtn}>
                  {isLoading ? 'Signing in...' : 'Sign in'}
                </button>
              </form>

              <p className={styles.signupText}>
                Don't have an account? <Link to="/register">Sign up</Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
