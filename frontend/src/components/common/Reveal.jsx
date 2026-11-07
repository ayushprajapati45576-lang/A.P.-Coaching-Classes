import React, { useRef, useState, useEffect } from 'react';

const Reveal = ({ children, delay = 0, className = '', style = {}, threshold = 0.15 }) => {
  const [isVisible, setIsVisible] = useState(false);
  const domRef = useRef();

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            if (domRef.current) observer.unobserve(domRef.current);
          }
        });
      },
      { threshold }
    );

    const currentRef = domRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) observer.unobserve(currentRef);
    };
  }, [threshold]);

  const revealStyle = {
    opacity: isVisible ? 1 : 0,
    transform: isVisible ? 'translateY(0) scale(1)' : 'translateY(40px) scale(0.97)',
    filter: isVisible ? 'blur(0px)' : 'blur(6px)',
    transition: `opacity 0.9s cubic-bezier(0.2, 0.8, 0.2, 1), transform 0.9s cubic-bezier(0.2, 0.8, 0.2, 1), filter 0.9s cubic-bezier(0.2, 0.8, 0.2, 1)`,
    transitionDelay: `${delay}ms`,
    willChange: 'opacity, transform, filter',
    ...style,
  };

  return (
    <div ref={domRef} className={className} style={revealStyle}>
      {children}
    </div>
  );
};

export default Reveal;

