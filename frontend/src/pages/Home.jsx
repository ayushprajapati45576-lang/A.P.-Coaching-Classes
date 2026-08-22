import React from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Video, TrendingUp, Bell, ArrowRight, Activity, Users, Star } from 'lucide-react';
import { motion } from 'framer-motion';
import styles from './Home.module.css';
import heroImage from '../assets/hero-image.jpg';

const Home = () => {
  const navigate = useNavigate();

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.2 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } }
  };

  return (
    <div className={styles.homeContainer}>
      {/* Ambient Background Elements */}
      <div className={styles.orb1}></div>
      <div className={styles.orb2}></div>

      {/* Navbar */}
      <nav className={styles.navbar}>
        <div className={styles.logo}>
          <Activity className={styles.logoIcon} size={28} />
          A.P. COACHING CLASSES
        </div>
        <div className={styles.navLinks}>
          <a href="#home">Home</a>
          <a href="#features">Features</a>
          <a href="#stats">Impact</a>
        </div>
        <button className={styles.loginBtn} onClick={() => navigate('/login')}>
          Login to Portal
        </button>
      </nav>

      {/* Main Content */}
      <main className={styles.content}>

        {/* Hero Section */}
        <motion.section
          id="home"
          className={styles.hero}
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <div className={styles.heroContent}>
            <motion.div variants={itemVariants} className={styles.heroBadge}>
              🎓 Admissions Open for 2026-2027 Session
            </motion.div>
            <motion.h1 variants={itemVariants} className={styles.heroTitle}>
              Excellence in Education<br />with A.P. COACHING
            </motion.h1>
            <motion.p variants={itemVariants} className={styles.heroSubtitle}>
              Expert guidance for <strong>Class 8th to 10th (All Subjects)</strong> and Specialized <strong>Mathematics Coaching for Class 11th & 12th</strong>. We focus on conceptual clarity and board exam excellence.
            </motion.p>
            <motion.div variants={itemVariants} className={styles.ctaGroup}>
              <button className={styles.primaryCta} onClick={() => navigate('/login')}>
                Get Started Now <ArrowRight size={20} style={{ display: 'inline', verticalAlign: 'middle', marginLeft: '8px', }} />
              </button>
              <button className={styles.secondaryCta} onClick={() => document.getElementById('features').scrollIntoView({ behavior: 'smooth' })}>
                Explore Features
              </button>
            </motion.div>
          </div>
          
          <motion.div variants={itemVariants} className={styles.heroImageWrapper}>
            <img src={heroImage} alt="Students studying together" className={styles.heroImg} />
            <div className={styles.heroImageGlow}></div>
          </motion.div>
        </motion.section>

        {/* Stats Section */}
        <motion.section
          id="stats"
          className={styles.statsContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.5 }}
          variants={containerVariants}
        >
          <motion.div variants={itemVariants} className={styles.statItem}>
            <div className={styles.statValue}>500+</div>
            <div className={styles.statLabel}>Students Guided</div>
          </motion.div>
          <motion.div variants={itemVariants} className={styles.statItem}>
            <div className={styles.statValue}>99%</div>
            <div className={styles.statLabel}>Board Success Rate</div>
          </motion.div>
          <motion.div variants={itemVariants} className={styles.statItem}>
            <div className={styles.statValue}>Top</div>
            <div className={styles.statLabel}>Results Every Year</div>
          </motion.div>
        </motion.section>

        {/* Features Section */}
        <motion.section
          id="features"
          className={styles.featuresSection}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={containerVariants}
        >
          <motion.h2 variants={itemVariants} className={styles.sectionTitle}>What We Offer</motion.h2>
          <motion.p variants={itemVariants} className={styles.sectionSubtitle}>Dedicated teaching methodology tailored for board exam success and strong fundamentals.</motion.p>

          <div className={styles.featuresGrid}>
            <motion.div variants={itemVariants} className={styles.featureCard}>
              <div className={`${styles.featureIcon} ${styles.blue}`}>
                <BookOpen size={32} />
              </div>
              <h3 className={styles.featureTitle}>Class 8th to 10th (All Subjects)</h3>
              <p className={styles.featureDesc}>
                Comprehensive coaching covering Mathematics, Science, English, and Social Studies to build a rock-solid foundation for board exams.
              </p>
            </motion.div>

            <motion.div variants={itemVariants} className={styles.featureCard}>
              <div className={`${styles.featureIcon} ${styles.green}`}>
                <TrendingUp size={32} />
              </div>
              <h3 className={styles.featureTitle}>Class 11th & 12th (Mathematics)</h3>
              <p className={styles.featureDesc}>
                Specialized Mathematics coaching focusing on NCERT syllabus, advanced problem-solving, and competitive exam readiness.
              </p>
            </motion.div>

            <motion.div variants={itemVariants} className={styles.featureCard}>
              <div className={`${styles.featureIcon} ${styles.orange}`}>
                <Users size={32} />
              </div>
              <h3 className={styles.featureTitle}>Personalized Attention</h3>
              <p className={styles.featureDesc}>
                We maintain optimal batch sizes to ensure every student gets individual focus, doubt-solving sessions, and proper mentorship.
              </p>
            </motion.div>

            <motion.div variants={itemVariants} className={styles.featureCard}>
              <div className={`${styles.featureIcon} ${styles.blue}`}>
                <Activity size={32} />
              </div>
              <h3 className={styles.featureTitle}>Weekly Mock Tests</h3>
              <p className={styles.featureDesc}>
                Regular weekly assessments and detailed performance tracking to keep students exam-ready and confident at all times.
              </p>
            </motion.div>

            <motion.div variants={itemVariants} className={styles.featureCard}>
              <div className={`${styles.featureIcon} ${styles.orange}`}>
                <Video size={32} />
              </div>
              <h3 className={styles.featureTitle}>Smart Study Material</h3>
              <p className={styles.featureDesc}>
                Students receive curated handwritten notes, practice sheets, and previous year question banks to reinforce their learning.
              </p>
            </motion.div>

            <motion.div variants={itemVariants} className={styles.featureCard}>
              <div className={`${styles.featureIcon} ${styles.green}`}>
                <Star size={32} />
              </div>
              <h3 className={styles.featureTitle}>Proven Track Record</h3>
              <p className={styles.featureDesc}>
                Consistent toppers in local board exams year after year. Our results speak for our dedication and teaching quality.
              </p>
            </motion.div>
          </div>
        </motion.section>

        {/* Pre-Footer CTA */}
        <motion.section 
          className={styles.preFooter}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={containerVariants}
        >
          <motion.h2 variants={itemVariants} className={styles.preFooterTitle}>Ready to start your journey?</motion.h2>
          <motion.p variants={itemVariants} className={styles.preFooterSubtitle}>Enroll today to secure your seat in our upcoming batches and take the first step towards academic excellence.</motion.p>
          <motion.div variants={itemVariants} className={styles.preFooterBtns}>
            <button className={styles.primaryCta} onClick={() => navigate('/login')}>Login to Student Portal</button>
          </motion.div>
        </motion.section>

      </main>


      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.footerContent}>

          <div className={styles.footerBrand}>
            <div className={styles.footerLogo}>
              <Activity className={styles.logoIcon} size={24} />
              A.P. COACHING
            </div>
            <p className={styles.footerTagline}>
              The smartest way to elevate your learning.<br />Beautifully designed. Powerfully simple.
            </p>
            <div className={styles.newsletter}>
              <span className={styles.footerHeading}>NEWSLETTER</span>
              <div className={styles.newsletterInputBox}>
                <input type="email" placeholder="your@email.com" className={styles.newsletterInput} />
                <button className={styles.newsletterBtn}>
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
