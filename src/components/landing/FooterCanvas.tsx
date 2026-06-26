import { useEffect, useRef } from "react";
import * as THREE from "three";

export default function FooterCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mouseRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // 1. Scene Setup
    const scene = new THREE.Scene();

    // 2. Camera Setup
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.z = 4.5;

    // 3. Renderer Setup
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);

    // 4. Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
    dirLight.position.set(2, 4, 3);
    scene.add(dirLight);

    // Point lights for colored luxury reflections
    const pLight1 = new THREE.PointLight(0xc2410c, 6.0, 8); // Warm burnt orange glow
    pLight1.position.set(-2, 2, 1);
    scene.add(pLight1);

    const pLight2 = new THREE.PointLight(0xf59e0b, 4.0, 8); // Warm amber glow
    pLight2.position.set(2, -2, 1);
    scene.add(pLight2);

    // 5. Geometry & Warm Metal Material
    const geometry = new THREE.TorusKnotGeometry(0.8, 0.26, 150, 20);

    const material = new THREE.MeshStandardMaterial({
      color: 0x7c2d12,
      metalness: 0.92,
      roughness: 0.18,
      flatShading: false,
    });

    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    // 6. Interaction: Track cursor coordinates relative to container center
    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      
      // Distance from center normalized between -1 and 1
      mouseRef.current.targetX = (e.clientX - centerX) / (window.innerWidth / 2);
      mouseRef.current.targetY = -(e.clientY - centerY) / (window.innerHeight / 2);
    };
    window.addEventListener("mousemove", handleMouseMove);

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
    let clock = new THREE.Clock();
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

      // Lerp mouse variables for smoothness
      const mouse = mouseRef.current;
      mouse.x += (mouse.targetX - mouse.x) * 0.08;
      mouse.y += (mouse.targetY - mouse.y) * 0.08;

      // Base rotation + interactive cursor tilt
      mesh.rotation.y = elapsedTime * 0.22 + mouse.x * 0.8;
      mesh.rotation.x = elapsedTime * 0.11 + mouse.y * 0.8;
      
      // Floating motion
      mesh.position.y = Math.sin(elapsedTime * 1.5) * 0.06;

      renderer.render(scene, camera);
    };

    tick();

    // 9. Cleanup
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      resizeObserver.disconnect();
      io.disconnect();
      cancelAnimationFrame(animationFrameId);
      
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div 
      ref={containerRef} 
      className="w-full h-full min-h-[300px] relative pointer-events-none"
    />
  );
}
