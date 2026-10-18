import { useEffect, useRef } from 'react';
import * as THREE from 'three';

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Crystal-clear organic liquid caustic & fluid light shader
// Never draws dirty grey solid pixels — only generates delicate iridescent fluid reflections
const fragmentShader = `
  uniform float uTime;
  uniform float uFoldProgress; // 0 = flat top bar, 1 = compact folded capsule
  uniform vec2  uResolution;

  varying vec2 vUv;

  vec2 hash2(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = dot(hash2(i),              f);
    float b = dot(hash2(i + vec2(1,0)),  f - vec2(1,0));
    float c = dot(hash2(i + vec2(0,1)),  f - vec2(0,1));
    float d = dot(hash2(i + vec2(1,1)),  f - vec2(1,1));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  float fbm(vec2 p) {
    float v = 0.0, a = 0.52;
    mat2 R = mat2(cos(0.55), sin(0.55), -sin(0.55), cos(0.55));
    for (int i = 0; i < 5; i++) {
      v += a * noise(p);
      p = R * p * 2.08;
      a *= 0.48;
    }
    return v;
  }

  void main() {
    vec2 uv = vUv;
    float t = uTime * 0.35;

    // Aspect ratio correction for fluid flow
    float aspect = uResolution.x / max(uResolution.y, 1.0);
    vec2 p = vec2(uv.x * aspect * 0.35, uv.y * 1.2);

    // Dynamic wave disturbance modulated by fold progress
    float waveSpeed = 0.4 + uFoldProgress * 0.3;
    float n1 = fbm(p + vec2(t * waveSpeed * 0.4, t * 0.25));
    float n2 = fbm(p * 1.8 + vec2(-t * 0.3, t * 0.35) + vec2(4.2, 1.9));
    float n3 = fbm(p * 3.2 + vec2(t * 0.2, -t * 0.4) + vec2(1.5, 7.8));

    // Liquid caustic light lines
    float caustic = pow(clamp(abs(n1 - n2) * 1.8, 0.0, 1.0), 3.0) * 0.45;
    caustic += pow(clamp(abs(n2 - n3) * 1.5, 0.0, 1.0), 4.0) * 0.35;

    // Prismatic sheen: ITPLN Cyan/Teal (#009bb9), Crisp Ice Blue, and Pure Pearl White
    vec3 colCyan  = vec3(0.00, 0.61, 0.73);
    vec3 colIce   = vec3(0.70, 0.88, 0.98);
    vec3 colPearl = vec3(1.00, 1.00, 1.00);

    // Flowing color gradient
    vec3 fluidColor = mix(colIce, colCyan, clamp(n2 * 0.6 + 0.3, 0.0, 1.0));
    fluidColor = mix(fluidColor, colPearl, caustic * 1.2);

    // Bevel & Top specular reflection catching ambient overhead light
    float topGleam = smoothstep(0.68, 1.0, uv.y) * 0.55;
    topGleam += smoothstep(0.92, 1.0, uv.y) * 0.65;

    // Subtle edge highlight
    float edgeGlow = (pow(1.0 - uv.y, 4.0) + pow(uv.y, 4.0)) * 0.15;

    // Resulting color
    vec3 finalRgb = fluidColor * (caustic * 0.85 + 0.05) + colPearl * topGleam;

    // Soft, crystal-clear alpha (never opaque sludge, always ethereal luxury glass)
    float alpha = clamp(caustic * 0.25 + topGleam * 0.35 + edgeGlow * 0.20, 0.0, 0.55);

    gl_FragColor = vec4(finalRgb, alpha);
  }
`;

export default function LiquidGlassCanvas({ navbarRef, isFolded }) {
  const mountRef = useRef(null);
  const refsR = useRef({});
  const frameR = useRef(null);
  const clockR = useRef(new THREE.Clock());
  const foldProgressRef = useRef(0);

  // Smoothly interpolate fold progress for shader
  useEffect(() => {
    const target = isFolded ? 1.0 : 0.0;
    let animId;
    const step = () => {
      foldProgressRef.current += (target - foldProgressRef.current) * 0.08;
      if (Math.abs(target - foldProgressRef.current) > 0.001) {
        animId = requestAnimationFrame(step);
      } else {
        foldProgressRef.current = target;
      }
    };
    step();
    return () => cancelAnimationFrame(animId);
  }, [isFolded]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || 72;

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    camera.position.z = 1;

    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uFoldProgress: { value: 0 },
        uResolution: { value: new THREE.Vector2(w, h) },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });

    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    scene.add(mesh);
    refsR.current = { renderer, scene, camera, material, geo: mesh.geometry };

    const onResize = () => {
      if (!container) return;
      const nw = container.clientWidth || window.innerWidth;
      const nh = container.clientHeight || 72;
      renderer.setSize(nw, nh);
      material.uniforms.uResolution.value.set(nw, nh);
    };

    window.addEventListener('resize', onResize);

    const animate = () => {
      frameR.current = requestAnimationFrame(animate);
      material.uniforms.uTime.value = clockR.current.getElapsedTime();
      material.uniforms.uFoldProgress.value = foldProgressRef.current;
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(frameR.current);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      material.dispose();
      mesh.geometry.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={mountRef}
      style={{
        position: 'absolute',
        inset: 0,
        borderRadius: 'inherit',
        overflow: 'hidden',
        zIndex: 0,
        pointerEvents: 'none',
        opacity: 0.9,
      }}
    />
  );
}
