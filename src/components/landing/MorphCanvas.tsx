import { useEffect, useRef } from "react";
import * as THREE from "three";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export default function MorphCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || !triggerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // 1. Scene Setup
    const scene = new THREE.Scene();

    // 2. Camera Setup
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.z = 5.0;

    // 3. Renderer Setup
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    container.appendChild(renderer.domElement);

    // 4. Geometry (Subdivided Sphere to allow clean mathematical morphing)
    const geometry = new THREE.SphereGeometry(1.2, 48, 48);

    // 5. Shader Material
    const material = new THREE.ShaderMaterial({
      vertexShader: `
        uniform float uTime;
        uniform float uMorphProgress;
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        
        void main() {
          vNormal = normalize(normalMatrix * normal);
          
          // Original Sphere Position
          vec3 spherePos = position;
          
          // Mathematical Cube Projection
          float maxCoord = max(max(abs(position.x), abs(position.y)), abs(position.z));
          // Map sphere vertices to a rounded cube surface
          vec3 cubePos = position * (1.1 / (maxCoord + 0.001));
          
          // Mathematical Torus Projection
          float len = length(position);
          float theta = atan(position.y, position.x);
          float phi = asin(position.z / (len + 0.001));
          
          float R_torus = 1.25;
          float r_torus = 0.45;
          vec3 torusPos = vec3(
            (R_torus + r_torus * cos(phi)) * cos(theta),
            (R_torus + r_torus * cos(phi)) * sin(theta),
            r_torus * sin(phi)
          );
          
          // Morph Interpolation based on uMorphProgress (0.0 to 2.0)
          vec3 morphedPosition;
          if (uMorphProgress <= 1.0) {
            // Morph from Sphere (0.0) to Cube (1.0)
            morphedPosition = mix(spherePos, cubePos, uMorphProgress);
          } else {
            // Morph from Cube (1.0) to Torus (2.0)
            morphedPosition = mix(cubePos, torusPos, uMorphProgress - 1.0);
          }
          
          vec4 mvPosition = modelViewMatrix * vec4(morphedPosition, 1.0);
          vViewPosition = -mvPosition.xyz;
          
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        uniform float uTime;
        
        void main() {
          vec3 normal = normalize(vNormal);
          vec3 viewDir = normalize(vViewPosition);
          
          // Fresnel glow
          float fresnel = pow(1.0 - max(dot(viewDir, normal), 0.0), 3.0);
          
          // Luxury gradient colors (rose-to-amber)
          vec3 colorRose = vec3(0.98, 0.16, 0.46);  // rose
          vec3 colorAmber = vec3(0.98, 0.62, 0.12); // amber-gold
          
          float t = sin(uTime * 0.4) * 0.5 + 0.5;
          vec3 baseColor = mix(colorRose, colorAmber, t);
          
          vec3 finalColor = baseColor * (0.4 + fresnel * 2.0) + vec3(fresnel * 0.6);
          
          gl_FragColor = vec4(finalColor, 0.7);
        }
      `,
      uniforms: {
        uTime: { value: 0 },
        uMorphProgress: { value: 0.0 },
      },
      transparent: true,
      depthWrite: true,
      depthTest: true,
    });

    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    // Create wireframe overlay for tech detail
    const wireframeMaterial = new THREE.MeshBasicMaterial({
      color: 0xff4b7a,
      wireframe: true,
      transparent: true,
      opacity: 0.12,
    });

    // Create a custom wireframe shader to match morphing
    const wireframeShaderMaterial = new THREE.ShaderMaterial({
      vertexShader: material.vertexShader,
      fragmentShader: `
        uniform float uTime;
        void main() {
          // Glow wireframe color matching rose-amber
          vec3 color = mix(vec3(0.98, 0.16, 0.46), vec3(0.98, 0.62, 0.12), sin(uTime * 0.4) * 0.5 + 0.5);
          gl_FragColor = vec4(color, 0.15);
        }
      `,
      uniforms: material.uniforms,
      wireframe: true,
      transparent: true,
    });

    const wireframeMesh = new THREE.Mesh(geometry, wireframeShaderMaterial);
    scene.add(wireframeMesh);

    // 6. GSAP ScrollTrigger Integration
    const scrollObj = { progress: 0.0 };

    const triggerInstance = ScrollTrigger.create({
      trigger: triggerRef.current,
      start: "top bottom",
      end: "bottom top",
      scrub: 1.0, // Smooth scrubbing
      onUpdate: (self) => {
        // Map scroll progress (0.0 to 1.0) to morph range (0.0 to 2.0)
        gsap.to(scrollObj, {
          progress: self.progress * 2.0,
          duration: 0.2,
          overwrite: "auto",
          onUpdate: () => {
            material.uniforms.uMorphProgress.value = scrollObj.progress;
          },
        });
      },
    });

    // 7. Responsive Resizing
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: w, height: h } = entry.contentRect;
        renderer.setSize(w, h);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      }
    });
    resizeObserver.observe(container);

    // 8. Animation & Render Loop
    let animationFrameId: number;
    const clock = new THREE.Clock();
    let isVisible = true;

    const io = new IntersectionObserver(
      ([entry]) => {
        isVisible = entry.isIntersecting;
      },
      { threshold: 0.05 }
    );
    io.observe(container);

    const tick = () => {
      animationFrameId = requestAnimationFrame(tick);
      if (!isVisible) return;

      const elapsedTime = clock.getElapsedTime();

      // Update shader uniform time
      material.uniforms.uTime.value = elapsedTime;

      // Slow constant rotations
      mesh.rotation.y = elapsedTime * 0.1;
      mesh.rotation.x = elapsedTime * 0.05;
      wireframeMesh.rotation.y = elapsedTime * 0.1;
      wireframeMesh.rotation.x = elapsedTime * 0.05;

      renderer.render(scene, camera);
    };

    tick();

    // 9. Cleanup
    return () => {
      triggerInstance.kill();
      resizeObserver.disconnect();
      io.disconnect();
      cancelAnimationFrame(animationFrameId);

      geometry.dispose();
      material.dispose();
      wireframeShaderMaterial.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div ref={triggerRef} className="w-full h-full relative flex items-center justify-center py-12">
      <div
        ref={containerRef}
        className="w-80 h-80 md:w-96 md:h-96 relative pointer-events-none"
        style={{ mixBlendMode: "screen" }}
      />
    </div>
  );
}
