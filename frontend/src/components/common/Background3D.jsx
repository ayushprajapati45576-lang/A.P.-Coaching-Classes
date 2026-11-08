import React, { useRef, useState, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Float, RoundedBox, Edges, Environment, Lightformer, Text } from '@react-three/drei';
import * as THREE from 'three';

// Glass Cube Component with Edges & Auto-rotation
const GlassCube = ({ position, color, size = 1, scale = 1, rotationSpeed = [0.005, 0.008, 0.004] }) => {
  const meshRef = useRef();

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.rotation.x += rotationSpeed[0];
      meshRef.current.rotation.y += rotationSpeed[1];
      meshRef.current.rotation.z += rotationSpeed[2];
    }
  });

  const finalSize = size * scale;

  return (
    <Float speed={2} rotationIntensity={0.8} floatIntensity={1.4}>
      <mesh ref={meshRef} position={position}>
        <RoundedBox args={[finalSize, finalSize, finalSize]} radius={0.12 * scale} smoothness={4}>
          <meshPhysicalMaterial
            color={color}
            transmission={0.6}
            roughness={0.1}
            opacity={0.8}
            transparent={true}
            ior={1.45}
            thickness={0.8}
            reflectivity={0.6}
            clearcoat={1}
            clearcoatRoughness={0.1}
          />
          <Edges color={color} threshold={15} />
        </RoundedBox>
      </mesh>
    </Float>
  );
};

// Golden Torus Knot Component
const GoldenTorusKnot = ({ position, scale = 1 }) => {
  const meshRef = useRef();

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.x += delta * 0.25;
      meshRef.current.rotation.y += delta * 0.35;
    }
  });

  return (
    <Float speed={1.8} rotationIntensity={1} floatIntensity={1.2}>
      <mesh ref={meshRef} position={position} scale={scale}>
        <torusKnotGeometry args={[0.75, 0.24, 100, 16]} />
        <meshStandardMaterial
          color="#FFB703"
          metalness={0.85}
          roughness={0.18}
        />
      </mesh>
    </Float>
  );
};

// Glossy Blue Sphere
const GlossySphere = ({ position, scale = 1 }) => {
  const meshRef = useRef();

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.2;
    }
  });

  return (
    <Float speed={2} rotationIntensity={0.6} floatIntensity={1.5}>
      <mesh ref={meshRef} position={position} scale={scale}>
        <sphereGeometry args={[1.0, 32, 32]} />
        <meshPhysicalMaterial
          color="#1F7FD1"
          roughness={0.1}
          metalness={0.15}
          clearcoat={1}
          clearcoatRoughness={0.1}
          reflectivity={0.9}
        />
      </mesh>
    </Float>
  );
};

// Floating Math Symbol
const MathSymbol = ({ char, position, color, size = 0.8 }) => {
  return (
    <Float speed={2.2} rotationIntensity={0.7} floatIntensity={1.6}>
      <Text
        position={position}
        fontSize={size}
        color={color}
        anchorX="center"
        anchorY="middle"
        characters="π∑√x²∫θ0123456789+-="
      >
        {char}
      </Text>
    </Float>
  );
};

// Rig Group with pointer lerp + scroll tracking
const Rig = ({ children }) => {
  const groupRef = useRef();
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY || 0);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useFrame((state) => {
    if (!groupRef.current) return;

    // Mouse tracking lerp
    const targetRotY = state.pointer.x * 0.3 + scrollY * 0.0008;
    const targetRotX = -state.pointer.y * 0.15;
    const targetPosY = scrollY * 0.004;

    groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, targetRotY, 0.05);
    groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, targetRotX, 0.05);
    groupRef.current.position.y = THREE.MathUtils.lerp(groupRef.current.position.y, targetPosY, 0.05);
  });

  return <group ref={groupRef}>{children}</group>;
};

// Responsive Scene Content (dynamically adapts to mobile and desktop viewports)
const Scene = () => {
  const { width } = useThree((state) => state.viewport);
  const isMobile = width < 7.5;

  // Responsive horizontal positioning:
  // On mobile (width ~ 4.8), objects are placed at ~ ±1.75 so they stay on-screen.
  // On desktop (width ~ 16), objects are placed at ~ ±4.8.
  const leftX = isMobile ? -width * 0.36 : Math.max(-5.2, -width * 0.32);
  const rightX = isMobile ? width * 0.36 : Math.min(5.2, width * 0.32);

  const topY = isMobile ? 3.6 : 2.8;
  const bottomY = isMobile ? -3.6 : -2.3;
  const scaleFactor = isMobile ? 0.65 : 1;

  return (
    <>
      <ambientLight intensity={0.8} />
      <directionalLight position={[10, 10, 5]} intensity={1.3} />

      {/* Drei Environment with Lightformers */}
      <Environment resolution={256}>
        <group rotation={[-Math.PI / 3, 0, 1]}>
          <Lightformer form="circle" color="#FFFFFF" intensity={2} scale={10} position={[0, 5, -9]} />
          <Lightformer form="circle" color="#80caff" intensity={1.5} scale={5} position={[-5, 1, -1]} />
          <Lightformer form="circle" color="#ffbe76" intensity={1.8} scale={8} position={[10, 1, 0]} />
        </group>
      </Environment>

      <Rig>
        {/* 1. Golden Metallic TorusKnot (Top-Left, framed neatly outside text) */}
        <GoldenTorusKnot position={[leftX, topY, -0.2]} scale={scaleFactor * 0.95} />

        {/* 2. Big Light-Blue Glass Cube (Top-Right) */}
        <GlassCube
          position={[rightX, topY, -0.2]}
          color="#90d5ff"
          size={1.35}
          scale={scaleFactor}
          rotationSpeed={[0.005, 0.007, 0.004]}
        />

        {/* 3. Amber Glass Cube (Bottom-Left) */}
        <GlassCube
          position={[leftX, bottomY, -0.2]}
          color="#E08A00"
          size={1.25}
          scale={scaleFactor}
          rotationSpeed={[0.006, 0.005, 0.004]}
        />

        {/* 4. Glossy Blue Sphere (Bottom-Right) */}
        <GlossySphere position={[rightX, bottomY + 0.3, 0]} scale={scaleFactor * 0.85} />

        {/* 5. Small Amber Glass Cube (Bottom-Right behind Sphere) */}
        <GlassCube
          position={[rightX * 0.72, bottomY - 0.7, -0.3]}
          color="#E08A00"
          size={0.7}
          scale={scaleFactor}
          rotationSpeed={[0.005, 0.008, 0.004]}
        />

        {/* 6. Floating Math Symbols placed adaptively */}
        {isMobile ? (
          <>
            <MathSymbol char="π" position={[leftX * 0.95, topY - 1.1, 0]} color="#E08A00" size={0.6} />
            <MathSymbol char="x²" position={[rightX * 0.95, topY - 1.1, 0]} color="#E08A00" size={0.55} />
            <MathSymbol char="√x" position={[leftX * 0.95, bottomY + 1.1, 0]} color="#1F7FD1" size={0.6} />
            <MathSymbol char="∑" position={[rightX * 0.95, bottomY + 1.1, 0]} color="#1F7FD1" size={0.6} />
          </>
        ) : (
          <>
            <MathSymbol char="θ" position={[-0.6, 3.8, 0]} color="#1F7FD1" size={0.85} />
            <MathSymbol char="x²" position={[3.2, 3.2, 0]} color="#E08A00" size={0.75} />
            <MathSymbol char="π" position={[-4.5, 1.2, 0]} color="#E08A00" size={0.8} />
            <MathSymbol char="√x" position={[-4.2, -1.4, 0]} color="#1F7FD1" size={0.8} />
            <MathSymbol char="∑" position={[4.6, -2.5, 0]} color="#1F7FD1" size={0.85} />
          </>
        )}
      </Rig>
    </>
  );
};

// Safe WebGL Canvas Component
const Background3D = () => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        width: '100vw',
        height: '100dvh',
        overflow: 'hidden',
      }}
    >
      <Canvas
        camera={{ position: [0, 0, 11], fov: 50 }}
        dpr={[1, 2]}
        eventSource={typeof document !== 'undefined' ? document.body : undefined}
        style={{ pointerEvents: 'none', width: '100%', height: '100%' }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      >
        <Scene />
      </Canvas>
    </div>
  );
};

export default Background3D;
