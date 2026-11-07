import React, { useRef, useState } from 'react';

const Tilt = ({ children, className = '', style = {}, maxRotation = 14, translateZ = 10 }) => {
  const [transform, setTransform] = useState('perspective(900px) rotateX(0deg) rotateY(0deg) translateZ(0px)');
  const [transition, setTransition] = useState('transform 0.25s ease-out');
  const cardRef = useRef(null);

  const handleMouseMove = (e) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;

    const rotateY = (x * maxRotation).toFixed(2);
    const rotateX = (-y * maxRotation).toFixed(2);

    setTransition('transform 0.1s ease-out');
    setTransform(`perspective(900px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(${translateZ}px)`);
  };

  const handleMouseLeave = () => {
    setTransition('transform 0.25s ease-out');
    setTransform('perspective(900px) rotateX(0deg) rotateY(0deg) translateZ(0px)');
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={className}
      style={{
        transform,
        transition,
        transformStyle: 'preserve-3d',
        willChange: 'transform',
        ...style,
      }}
    >
      {children}
    </div>
  );
};

export default Tilt;

