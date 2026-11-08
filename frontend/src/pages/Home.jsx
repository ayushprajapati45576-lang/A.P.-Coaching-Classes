import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Video, TrendingUp, Bell, ArrowRight, Activity, Users, Star, Menu, X, Check, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './Home.module.css';
import heroImage from '../assets/hero-image.jpg';
import Background3D from '../components/common/Background3D';
import Reveal from '../components/common/Reveal';
import Tilt from '../components/common/Tilt';

const Home = () => {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 768) {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.15 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.2, 0.8, 0.2, 1] } }
  };

  const marqueeSubjects = [
    'Mathematics',
    'Science',
    'English',
    'Social Studies',
    'Algebra',
    'Calculus',
    'NCERT',
    'Board Prep'
  ];

  return (
    <div className={styles.homeContainer}>
      {/* Fixed 3D Background (React Three Fiber) */}
      <Background3D />

      {/* Fixed 64px Grid Background with Radial Mask */}
      <div className={styles.fixedGridOverlay}></div>

      {/* Navbar */}
      <nav className={styles.navbar}>
        <div className={styles.navInner}>
          <div className={styles.logo} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <img src="/logo.jpeg" alt="A.P. Coaching Classes Logo" className={styles.logoImage} />
            <span className={styles.logoText}>
              <span className={styles.logoTextMain}>A.P. COACHING</span>{' '}
              <span className={styles.logoTextSuffix}>CLASSES</span>
            </span>
          </div>

          <div className={styles.navLinks}>
            <a href="#home">Home</a>
            <a href="#stats">Impact</a>
            <a href="#features">Features</a>
          </div>

          <div className={styles.navActions}>
            <button className={styles.loginBtn} onClick={() => navigate('/login')}>
              <span className={styles.desktopLoginText}>Login to Portal</span>
              <span className={styles.mobileLoginText}>Login</span>
            </button>

            <button 
              className={styles.menuToggleBtn} 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? 'Close Menu' : 'Open Menu'}
            >
              {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div 
              className={styles.mobileMenu}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
            >
              <div className={styles.mobileMenuLinks}>
                <a 
                  href="#home" 
                  onClick={() => setMobileMenuOpen(false)}
                  className={styles.mobileNavLink}
                >
                  Home
                </a>
                <a 
                  href="#stats" 
                  onClick={() => setMobileMenuOpen(false)}
                  className={styles.mobileNavLink}
                >
                  Impact
                </a>
                <a 
                  href="#features" 
                  onClick={() => setMobileMenuOpen(false)}
                  className={styles.mobileNavLink}
                >
                  Features
                </a>
                <button 
                  className={styles.mobileMenuLoginBtn} 
                  onClick={() => { setMobileMenuOpen(false); navigate('/login'); }}
                >
                  Login to Portal →
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* Main Content (z-index 10) */}
      <main className={styles.content}>

        {/* Hero Section (Centered 3D Layout matching Lovable design) */}
        <motion.section
          id="home"
          className={styles.hero}
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Subtle Soft Ambient Glow behind Hero */}
          <div className={styles.heroBlueGlow}></div>

          {/* Floating 3D Badge 1: Round Check Chip (Far-Left) */}
          <div className={`${styles.floatingBadge} ${styles.badgeFarLeft}`}>
            <div className={styles.roundChipBlue}>
              <Check size={26} color="#FFFFFF" strokeWidth={3.2} />
            </div>
          </div>

          {/* Floating 3D Badge 2: Round Sparkle Chip (Far-Right) */}
          <div className={`${styles.floatingBadge} ${styles.badgeFarRight}`}>
            <div className={styles.roundChipDeepBlue}>
              <Sparkles size={24} color="#FFFFFF" strokeWidth={2.5} />
            </div>
          </div>

          {/* Floating 3D Badge 3: Five Star Review Card (Bottom-Left) */}
          <div className={`${styles.floatingBadge} ${styles.badgeBottomLeft}`}>
            <div className={styles.glassReviewCard}>
              <div className={styles.starRow}>
                {[...Array(5)].map((_, i) => (
                  <Star key={i} size={15} fill="#E08A00" color="#E08A00" />
                ))}
              </div>
              <div className={styles.reviewTitle}>Five Star Parents' Choice</div>
            </div>
          </div>

          {/* Floating 3D Badge 4: Testimonial Pill (Bottom-Right) */}
          <div className={`${styles.floatingBadge} ${styles.badgeBottomRight}`}>
            <div className={styles.orangePillBadge}>
              <span>"My son topped Maths in boards!" 🎓</span>
            </div>
          </div>

          {/* Centered Hero Content */}
          <div className={styles.heroContentCentered}>
            {/* Admissions Open Glass Pill Badge */}
            <motion.div variants={itemVariants} className={styles.heroBadge}>
              <span className={styles.pulsingDot}></span>
              <span className={styles.badgeText}>🎓 Admissions Open for 2026-2027 Session</span>
            </motion.div>

            {/* Main Heading with Continuous Brand Gradient across A.P. Coaching Classes */}
            <motion.h1 variants={itemVariants} className={styles.heroTitle}>
              Excellence in Education<br />
              with <span className={styles.brandGradientText}>A.P. Coaching Classes</span>
            </motion.h1>

            <motion.p variants={itemVariants} className={styles.heroSubtitle}>
              Expert guidance for <strong>Class 6th to 10th (All Subjects)</strong> and Specialized <strong>Mathematics Coaching for Class 11th & 12th</strong>. We focus on conceptual clarity and board exam excellence.
            </motion.p>

            <motion.div variants={itemVariants} className={styles.ctaGroup}>
              <button className={styles.primaryCta} onClick={() => navigate('/login')}>
                <span>Get Started Now</span>
                <span className={styles.arrowIcon}>↗</span>
              </button>
              <button className={styles.secondaryCta} onClick={() => document.getElementById('features').scrollIntoView({ behavior: 'smooth' })}>
                Explore Features
              </button>
            </motion.div>
          </div>

          {/* Right side image commented out as per user request:
          <motion.div variants={itemVariants} className={styles.heroImageWrapper}>
            <div className={styles.imageInner}>
              <img src={heroImage} alt="Students studying together" className={styles.heroImg} />
              <div className={styles.heroImageGlow}></div>
            </div>
          </motion.div>
          */}
        </motion.section>

        {/* Extras: Infinite Subject Marquee Strip (30s linear loop) */}
        <div className={styles.marqueeSection}>
          <div className={styles.marqueeTrack}>
            {[...marqueeSubjects, ...marqueeSubjects, ...marqueeSubjects].map((subject, index) => (
              <div key={index} className={styles.marqueeItem}>
                <span className={styles.marqueeDot}>✦</span>
                <span className={styles.marqueeText}>{subject}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Stats Section with Scroll Reveal & 3D Tilt */}
        <Reveal threshold={0.15}>
          <section id="stats" className={styles.statsContainer}>
            <Tilt className={styles.tiltStatWrapper}>
              <div className={styles.statItem}>
                <div className={styles.statValue}>50,000+</div>
                <div className={styles.statLabel}>Students Guided</div>
              </div>
            </Tilt>

            <Tilt className={styles.tiltStatWrapper}>
              <div className={styles.statItem}>
                <div className={styles.statValue}>99%</div>
                <div className={styles.statLabel}>Board Success Rate</div>
              </div>
            </Tilt>

            <Tilt className={styles.tiltStatWrapper}>
              <div className={styles.statItem}>
                <div className={styles.statValue}>Top</div>
                <div className={styles.statLabel}>Results Every Year</div>
              </div>
            </Tilt>
          </section>
        </Reveal>

        {/* Features Section with Scroll Reveal & 3D Tilt Cards */}
        <section id="features" className={styles.featuresSection}>
          <Reveal threshold={0.15}>
            <h2 className={styles.sectionTitle}>What We Offer</h2>
            <p className={styles.sectionSubtitle}>Dedicated teaching methodology tailored for board exam success and strong fundamentals.</p>
          </Reveal>

          <div className={styles.featuresGrid}>
            {/* Feature 1 */}
            <Reveal delay={0} threshold={0.1}>
              <Tilt className={styles.tiltFeatureWrapper}>
                <div className={styles.featureCard}>
                  <div className={styles.cardHeader}>
                    <div className={styles.featureIcon}>
                      <BookOpen size={28} />
                    </div>
                    <span className={styles.featureNumber}>01</span>
                  </div>
                  <h3 className={styles.featureTitle}>Class 6th to 10th (All Subjects)</h3>
                  <p className={styles.featureDesc}>
                    Comprehensive coaching covering Mathematics, Science, English, and Social Studies to build a rock-solid foundation for board exams.
                  </p>
                </div>
              </Tilt>
            </Reveal>

            {/* Feature 2 */}
            <Reveal delay={120} threshold={0.1}>
              <Tilt className={styles.tiltFeatureWrapper}>
                <div className={styles.featureCard}>
                  <div className={styles.cardHeader}>
                    <div className={styles.featureIcon}>
                      <TrendingUp size={28} />
                    </div>
                    <span className={styles.featureNumber}>02</span>
                  </div>
                  <h3 className={styles.featureTitle}>Class 11th & 12th (Mathematics)</h3>
                  <p className={styles.featureDesc}>
                    Specialized Mathematics coaching focusing on NCERT syllabus, advanced problem-solving, and competitive exam readiness.
                  </p>
                </div>
              </Tilt>
            </Reveal>

            {/* Feature 3 */}
            <Reveal delay={240} threshold={0.1}>
              <Tilt className={styles.tiltFeatureWrapper}>
                <div className={styles.featureCard}>
                  <div className={styles.cardHeader}>
                    <div className={styles.featureIcon}>
                      <Users size={28} />
                    </div>
                    <span className={styles.featureNumber}>03</span>
                  </div>
                  <h3 className={styles.featureTitle}>Personalized Attention</h3>
                  <p className={styles.featureDesc}>
                    We maintain optimal batch sizes to ensure every student gets individual focus, doubt-solving sessions, and proper mentorship.
                  </p>
                </div>
              </Tilt>
            </Reveal>

            {/* Feature 4 */}
            <Reveal delay={0} threshold={0.1}>
              <Tilt className={styles.tiltFeatureWrapper}>
                <div className={styles.featureCard}>
                  <div className={styles.cardHeader}>
                    <div className={styles.featureIcon}>
                      <Activity size={28} />
                    </div>
                    <span className={styles.featureNumber}>04</span>
                  </div>
                  <h3 className={styles.featureTitle}>Weekly Mock Tests</h3>
                  <p className={styles.featureDesc}>
                    Regular weekly assessments and detailed performance tracking to keep students exam-ready and confident at all times.
                  </p>
                </div>
              </Tilt>
            </Reveal>

            {/* Feature 5 */}
            <Reveal delay={120} threshold={0.1}>
              <Tilt className={styles.tiltFeatureWrapper}>
                <div className={styles.featureCard}>
                  <div className={styles.cardHeader}>
                    <div className={styles.featureIcon}>
                      <Video size={28} />
                    </div>
                    <span className={styles.featureNumber}>05</span>
                  </div>
                  <h3 className={styles.featureTitle}>Smart Study Material</h3>
                  <p className={styles.featureDesc}>
                    Students receive curated handwritten notes, practice sheets, and previous year question banks to reinforce their learning.
                  </p>
                </div>
              </Tilt>
            </Reveal>

            {/* Feature 6 */}
            <Reveal delay={240} threshold={0.1}>
              <Tilt className={styles.tiltFeatureWrapper}>
                <div className={styles.featureCard}>
                  <div className={styles.cardHeader}>
                    <div className={styles.featureIcon}>
                      <Star size={28} />
                    </div>
                    <span className={styles.featureNumber}>06</span>
                  </div>
                  <h3 className={styles.featureTitle}>Proven Track Record</h3>
                  <p className={styles.featureDesc}>
                    Consistent toppers in local board exams year after year. Our results speak for our dedication and teaching quality.
                  </p>
                </div>
              </Tilt>
            </Reveal>
          </div>
        </section>

        {/* Pre-Footer CTA (Blue gradient card, white text, white pill button) */}
        <Reveal threshold={0.15}>
          <section className={styles.preFooter}>
            <Tilt className={styles.tiltCtaWrapper}>
              <div className={styles.preFooterCard}>
                <h2 className={styles.preFooterTitle}>Ready to start your journey?</h2>
                <p className={styles.preFooterSubtitle}>
                  Enroll today to secure your seat in our upcoming batches and take the first step towards academic excellence.
                </p>
                <div className={styles.preFooterBtns}>
                  <button className={styles.preFooterWhiteBtn} onClick={() => navigate('/login')}>
                    Login to Student Portal
                  </button>
                </div>
              </div>
            </Tilt>
          </section>
        </Reveal>

      </main>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.footerContent}>

          <div className={styles.footerBrand}>
            <div className={styles.footerLogo}>
              <img src="/logo.jpeg" alt="A.P. Coaching Logo" className={styles.logoImage} />
              <span>A.P. COACHING</span>
            </div>
            <p className={styles.footerTagline}>
              The smartest way to elevate your learning.<br />Beautifully designed. Powerfully simple.
            </p>
            <div className={styles.newsletter}>
              <span className={styles.footerHeading}>NEWSLETTER</span>
              <div className={styles.newsletterInputBox}>
                <input type="email" placeholder="your@email.com" className={styles.newsletterInput} />
                <button className={styles.newsletterBtn} aria-label="Subscribe">
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          </div>

          <div className={styles.footerCol}>
            <span className={styles.footerHeading}>EXPLORE</span>
            <a href="#">Study Material</a>
            <a href="#">Live Classes</a>
            <a href="#">Test Series</a>
            <a href="#">Results</a>
          </div>

          <div className={styles.footerCol}>
            <span className={styles.footerHeading}>COMPANY</span>
            <a href="#">About Us</a>
            <a href="#">Blog</a>
            <a href="#">Careers</a>
            <a href="#">Contact</a>
          </div>

          <div className={styles.footerCol}>
            <span className={styles.footerHeading}>LEGAL</span>
            <a href="#">Privacy Policy</a>
            <a href="#">Terms of Service</a>
            <a href="#">Cookie Policy</a>
            <a href="#">Security</a>
          </div>

        </div>

        <div className={styles.footerBottom}>
          <div className={styles.copyright}>
            &copy; {new Date().getFullYear()} A.P. Coaching Classes, Inc. All rights reserved.
          </div>
          <div className={styles.socialIcons}>
            <a href="#">Twitter</a>
            <a href="#">GitHub</a>
            <a href="#">Insta</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;
