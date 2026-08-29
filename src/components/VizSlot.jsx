import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

/* ------------------------------------------------------------------ */
/* Color ramp — deep steel -> teal -> mint -> amber (elevation-mapped) */
/* ------------------------------------------------------------------ */
const RAMP_HEX = ['#12222f', '#1f6f72', '#5fd0b8', '#f2c14e'];
const RAMP = [
  { t: 0.0, c: new THREE.Color(RAMP_HEX[0]) },
  { t: 0.35, c: new THREE.Color(RAMP_HEX[1]) },
  { t: 0.7, c: new THREE.Color(RAMP_HEX[2]) },
  { t: 1.0, c: new THREE.Color(RAMP_HEX[3]) },
];

function sampleHeightColor(t, out) {
  t = Math.min(1, Math.max(0, t));
  let i = 0;
  while (i < RAMP.length - 2 && t > RAMP[i + 1].t) i++;
  const a = RAMP[i], b = RAMP[i + 1];
  const localT = (t - a.t) / (b.t - a.t || 1);
  out.copy(a.c).lerp(b.c, localT);
  return out;
}

/* ------------------------------------------------------------------ */
/* Procedural "scan" — ground haze + scanned building facades + silos */
/* (optimised: fewer points, fewer structures)                       */
/* ------------------------------------------------------------------ */
function generateSceneData(count) {
  const R = 42;
  const maxH = 16;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const tmp = new THREE.Color();
  let idx = 0;

  function push(x, y, z, base) {
    if (idx >= count) return;
    positions[idx * 3] = x;
    positions[idx * 3 + 1] = y;
    positions[idx * 3 + 2] = z;
    sampleHeightColor(Math.max(0, y) / maxH, tmp);
    colors[idx * 3] = tmp.r;
    colors[idx * 3 + 1] = tmp.g;
    colors[idx * 3 + 2] = tmp.b;
    sizes[idx] = base * (0.6 + Math.random() * 0.6);
    idx++;
  }

  // ground haze (reduced ratio)
  const groundCount = Math.floor(count * 0.30);
  for (let i = 0; i < groundCount; i++) {
    const r = Math.sqrt(Math.random()) * R;
    const a = Math.random() * Math.PI * 2;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const y = Math.sin(x * 0.15) * 0.35 + Math.cos(z * 0.18) * 0.35 + (Math.random() - 0.5) * 0.15;
    push(x, Math.max(y, 0), z, 1.4);
  }

  // scanned structures (fewer buildings, lower per-building budget)
  const buildings = [];
  for (let b = 0; b < 4; b++) { // was 6
    buildings.push({
      bx: (Math.random() - 0.5) * R * 1.3,
      bz: (Math.random() - 0.5) * R * 1.3,
      bw: 4 + Math.random() * 6,
      bd: 4 + Math.random() * 6,
      bh: 4 + Math.random() * 12,
    });
  }
  buildings.push({ bx: 2, bz: -4, bw: 5, bd: 5, bh: 16 }); // landmark tower

  const buildingBudget = Math.floor(count * 0.45);
  const perBuilding = Math.floor(buildingBudget / buildings.length);
  buildings.forEach(({ bx, bz, bw, bd, bh }) => {
    for (let i = 0; i < perBuilding; i++) {
      const face = Math.floor(Math.random() * 5);
      let x, y, z;
      if (face === 4) { x = bx + (Math.random() - 0.5) * bw; z = bz + (Math.random() - 0.5) * bd; y = bh + (Math.random() - 0.5) * 0.1; }
      else if (face === 0) { x = bx - bw / 2; z = bz + (Math.random() - 0.5) * bd; y = Math.random() * bh; }
      else if (face === 1) { x = bx + bw / 2; z = bz + (Math.random() - 0.5) * bd; y = Math.random() * bh; }
      else if (face === 2) { x = bx + (Math.random() - 0.5) * bw; z = bz - bd / 2; y = Math.random() * bh; }
      else { x = bx + (Math.random() - 0.5) * bw; z = bz + bd / 2; y = Math.random() * bh; }
      push(x, y, z, 1.2);
    }
  });

  // silos / tanks (fewer)
  const silos = [];
  for (let s = 0; s < 2; s++) { // was 3
    silos.push({
      cx: (Math.random() - 0.5) * R * 1.4,
      cz: (Math.random() - 0.5) * R * 1.4,
      rad: 1.2 + Math.random() * 1.3,
      h: 3 + Math.random() * 6,
    });
  }
  const siloBudget = Math.max(0, count - idx);
  const perSilo = Math.floor(siloBudget / silos.length);
  silos.forEach(({ cx, cz, rad, h }) => {
    for (let i = 0; i < perSilo; i++) {
      const a = Math.random() * Math.PI * 2;
      const y = Math.random() * h;
      push(cx + Math.cos(a) * rad, y, cz + Math.sin(a) * rad, 1.2);
    }
  });

  while (idx < count) {
    const r = Math.sqrt(Math.random()) * R;
    const a = Math.random() * Math.PI * 2;
    push(Math.cos(a) * r, 0, Math.sin(a) * r, 1.0);
  }

  return { positions, colors, sizes, R, maxH };
}

/* ------------------------------------------------------------------ */
/* Rasterize the cloud into a smoothed grid -> the "hazy mesh" haze   */
/* (grid resolution reduced)                                          */
/* ------------------------------------------------------------------ */
function buildHazyGrid(sceneData, gridRes = 48) { // was 70
  const { positions, R, maxH } = sceneData;
  const size = gridRes;
  const cell = (2 * R) / (size - 1);
  const heights = new Float32Array(size * size);

  const n = positions.length / 3;
  for (let i = 0; i < n; i++) {
    const x = positions[i * 3], y = positions[i * 3 + 1], z = positions[i * 3 + 2];
    const gx = Math.min(size - 1, Math.max(0, Math.round((x + R) / cell)));
    const gz = Math.min(size - 1, Math.max(0, Math.round((z + R) / cell)));
    const key = gz * size + gx;
    if (y > heights[key]) heights[key] = y;
  }

  function blur(src) {
    const out = new Float32Array(src.length);
    for (let gz = 0; gz < size; gz++) {
      for (let gx = 0; gx < size; gx++) {
        let sum = 0, cnt = 0;
        for (let dz = -1; dz <= 1; dz++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = gx + dx, nz = gz + dz;
            if (nx >= 0 && nx < size && nz >= 0 && nz < size) { sum += src[nz * size + nx]; cnt++; }
          }
        }
        out[gz * size + gx] = sum / cnt;
      }
    }
    return out;
  }
  let smoothed = blur(heights);
  smoothed = blur(smoothed);

  const gridPositions = new Float32Array(size * size * 3);
  const gridColors = new Float32Array(size * size * 3);
  const tmp = new THREE.Color();
  for (let gz = 0; gz < size; gz++) {
    for (let gx = 0; gx < size; gx++) {
      const key = gz * size + gx;
      const x = -R + gx * cell, z = -R + gz * cell, y = smoothed[key];
      gridPositions[key * 3] = x; gridPositions[key * 3 + 1] = y; gridPositions[key * 3 + 2] = z;
      sampleHeightColor(Math.max(0, y) / maxH, tmp);
      gridColors[key * 3] = tmp.r; gridColors[key * 3 + 1] = tmp.g; gridColors[key * 3 + 2] = tmp.b;
    }
  }

  const indices = [];
  for (let gz = 0; gz < size - 1; gz++) {
    for (let gx = 0; gx < size - 1; gx++) {
      const a = gz * size + gx, b = gz * size + gx + 1, c = (gz + 1) * size + gx, d = (gz + 1) * size + gx + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  return { gridPositions, gridColors, indices };
}

function buildSweepGeometry(radius, segments, angleWidth) {
  // reduced segments
  segments = Math.min(segments, 32); // cap
  const positions = [];
  const colors = [];
  const lead = new THREE.Color('#8fe9df');
  const trail = new THREE.Color('#0a0e13');
  for (let i = 0; i < segments; i++) {
    const a0 = -angleWidth * (i / segments);
    const a1 = -angleWidth * ((i + 1) / segments);
    const p0 = [Math.cos(a0) * radius, 0.02, Math.sin(a0) * radius];
    const p1 = [Math.cos(a1) * radius, 0.02, Math.sin(a1) * radius];
    positions.push(0, 0.02, 0, p0[0], p0[1], p0[2], p1[0], p1[1], p1[2]);
    const cc = lead.clone().lerp(trail, (i / segments) * 0.35);
    const c0 = lead.clone().lerp(trail, i / segments);
    const c1 = lead.clone().lerp(trail, (i + 1) / segments);
    colors.push(cc.r, cc.g, cc.b, c0.r, c0.g, c0.b, c1.r, c1.g, c1.b);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return geo;
}

const POINT_VERT = `
  attribute float size;
  attribute vec3 color;
  varying vec3 vColor;
  void main() {
    vColor = color;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size * (240.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;
const POINT_FRAG = `
  varying vec3 vColor;
  void main() {
    vec2 uv = gl_PointCoord - vec2(0.5);
    float d = length(uv);
    float alpha = smoothstep(0.5, 0.05, d);
    if (alpha < 0.03) discard;
    gl_FragColor = vec4(vColor, alpha);
  }
`;

/* ------------------------------------------------------------------ */
/* UI helpers                                                          */
/* ------------------------------------------------------------------ */
const panel = {
  background: 'rgba(12,17,23,0.6)',
  backdropFilter: 'blur(10px)',
  WebkitBackdropFilter: 'blur(10px)',
  border: '1px solid rgba(140,190,200,0.16)',
  color: '#c9d3d9',
  fontSize: 11,
  letterSpacing: '0.06em',
  padding: '10px 13px',
  lineHeight: 1.7,
  pointerEvents: 'auto',
};

const btnBase = {
  background: 'rgba(12,17,23,0.6)',
  border: '1px solid rgba(140,190,200,0.18)',
  color: '#8fa2ab',
  fontFamily: 'inherit',
  fontSize: 10,
  letterSpacing: '0.08em',
  padding: '7px 10px',
  cursor: 'pointer',
  textTransform: 'uppercase',
  transition: 'all 120ms ease',
};

function ToggleBtn({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        ...btnBase,
        color: active ? '#8fe9df' : '#5c6b73',
        borderColor: active ? 'rgba(143,233,223,0.45)' : 'rgba(140,190,200,0.18)',
        background: active ? 'rgba(143,233,223,0.08)' : 'rgba(12,17,23,0.6)',
      }}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Main component                                                      */
/* ------------------------------------------------------------------ */
export default function LidarPointCloud({
  pointCount = 18000,   // reduced from 45000
  height = '100vh',
}) {
  const mountRef = useRef(null);
  const objRef = useRef({});
  const hudAngleRef = useRef(null);
  const fpsRef = useRef(null);
  const [showPoints, setShowPoints] = useState(true);
  const [showMesh, setShowMesh] = useState(true);
  const [showSweep, setShowSweep] = useState(true);
  const [autoRotate, setAutoRotate] = useState(false);
  const [ready, setReady] = useState(false);
  const autoRotateRef = useRef(autoRotate);
  useEffect(() => { autoRotateRef.current = autoRotate; }, [autoRotate]);

  useEffect(() => {
    const mountEl = mountRef.current;
    if (!mountEl) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0a0e13');
    scene.fog = new THREE.FogExp2('#0a0e13', 0.012);

    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 500);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5)); // cap at 1.5
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.touchAction = 'none';
    mountEl.style.touchAction = 'none';
    mountEl.appendChild(renderer.domElement);

    // ---- data ----
    const sceneData = generateSceneData(pointCount);
    const grid = buildHazyGrid(sceneData, 48); // reduced resolution

    // ---- points ----
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(sceneData.positions, 3));
    pGeo.setAttribute('color', new THREE.BufferAttribute(sceneData.colors, 3));
    pGeo.setAttribute('size', new THREE.BufferAttribute(sceneData.sizes, 1));
    const pMat = new THREE.ShaderMaterial({
      vertexShader: POINT_VERT,
      fragmentShader: POINT_FRAG,
      transparent: true,
      depthWrite: false,
    });
    const points = new THREE.Points(pGeo, pMat);
    scene.add(points);

    // ---- hazy derived mesh ----
    const mGeo = new THREE.BufferGeometry();
    mGeo.setAttribute('position', new THREE.BufferAttribute(grid.gridPositions, 3));
    mGeo.setAttribute('color', new THREE.BufferAttribute(grid.gridColors, 3));
    mGeo.setIndex(grid.indices);
    const fillMat = new THREE.MeshBasicMaterial({
      vertexColors: true, transparent: true, opacity: 0.15,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    });
    const fillMesh = new THREE.Mesh(mGeo, fillMat);
    const wireMat = new THREE.MeshBasicMaterial({
      color: 0x6fe3d6, wireframe: true, transparent: true, opacity: 0.22,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const wireMesh = new THREE.Mesh(mGeo, wireMat);
    wireMesh.position.y += 0.015;
    const meshGroup = new THREE.Group();
    meshGroup.add(fillMesh, wireMesh);
    scene.add(meshGroup);

    // ---- floor grid (reduced divisions) ----
    const floor = new THREE.GridHelper(96, 24, 0x22404a, 0x152128); // was 48
    floor.position.y = -0.05;
    floor.material.transparent = true;
    floor.material.opacity = 0.45;
    scene.add(floor);

    // ---- radar sweep (reduced segments) ----
    const sweepGeo = buildSweepGeometry(sceneData.R * 1.05, 32, Math.PI / 4.2); // was 48
    const sweepMat = new THREE.MeshBasicMaterial({
      vertexColors: true, transparent: true, opacity: 0.5,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    });
    const sweepMesh = new THREE.Mesh(sweepGeo, sweepMat);
    scene.add(sweepMesh);

    objRef.current = { points, meshGroup, sweepMesh, renderer, camera };

    // ---- custom Google-Maps-style controls (drag pan, right/shift-drag orbit, wheel zoom, pinch) ----
    const target = new THREE.Vector3(0, 3, 0);
    let azimuth = 0.75, polar = 0.95, radius = 58;
    const initial = { azimuth, polar, radius, target: target.clone() };
    const POLAR_MIN = 0.15, POLAR_MAX = 1.48;
    const RADIUS_MIN = 8, RADIUS_MAX = 150;

    function updateCamera() {
      camera.position.set(
        target.x + radius * Math.sin(polar) * Math.sin(azimuth),
        target.y + radius * Math.cos(polar),
        target.z + radius * Math.sin(polar) * Math.cos(azimuth)
      );
      camera.lookAt(target);
    }
    updateCamera();

    objRef.current.reset = () => {
      azimuth = initial.azimuth; polar = initial.polar; radius = initial.radius;
      target.copy(initial.target);
      updateCamera();
    };

    const pointers = new Map();
    let mode = null, lastX = 0, lastY = 0, lastPinchDist = 0, lastMidX = 0, lastMidY = 0;

    function screenRight() {
      const fwd = new THREE.Vector3().subVectors(target, camera.position); fwd.y = 0; fwd.normalize();
      return new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();
    }
    function screenForward() {
      const fwd = new THREE.Vector3().subVectors(target, camera.position); fwd.y = 0; fwd.normalize();
      return fwd;
    }
    function pan(dx, dy) {
      const scale = radius * 0.0016;
      const right = screenRight();
      const fwd = screenForward();
      target.addScaledVector(right, -dx * scale);
      target.addScaledVector(fwd, dy * scale);
    }
    function orbit(dx, dy) {
      azimuth -= dx * 0.0055;
      polar = Math.min(POLAR_MAX, Math.max(POLAR_MIN, polar - dy * 0.0055));
    }
    function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

    function onPointerDown(e) {
      mountEl.setPointerCapture && mountEl.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 1) {
        mode = (e.button === 2 || e.shiftKey) ? 'rotate' : 'pan';
        lastX = e.clientX; lastY = e.clientY;
        mountEl.style.cursor = mode === 'rotate' ? 'crosshair' : 'grabbing';
      } else if (pointers.size === 2) {
        mode = 'multi';
        const pts = [...pointers.values()];
        lastPinchDist = dist(pts[0], pts[1]);
        lastMidX = (pts[0].x + pts[1].x) / 2; lastMidY = (pts[0].y + pts[1].y) / 2;
      }
    }
    function onPointerMove(e) {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (mode === 'pan' && pointers.size === 1) {
        pan(e.clientX - lastX, e.clientY - lastY);
        lastX = e.clientX; lastY = e.clientY;
      } else if (mode === 'rotate' && pointers.size === 1) {
        orbit(e.clientX - lastX, e.clientY - lastY);
        lastX = e.clientX; lastY = e.clientY;
      } else if (mode === 'multi' && pointers.size === 2) {
        const pts = [...pointers.values()];
        const d = dist(pts[0], pts[1]);
        const midX = (pts[0].x + pts[1].x) / 2, midY = (pts[0].y + pts[1].y) / 2;
        if (lastPinchDist > 0) radius = Math.min(RADIUS_MAX, Math.max(RADIUS_MIN, radius * (lastPinchDist / d)));
        orbit(midX - lastMidX, midY - lastMidY);
        lastPinchDist = d; lastMidX = midX; lastMidY = midY;
      }
    }
    function onPointerUp(e) {
      pointers.delete(e.pointerId);
      if (pointers.size === 0) { mode = null; mountEl.style.cursor = 'grab'; }
      else if (pointers.size === 1) {
        mode = 'pan';
        const p = [...pointers.values()][0];
        lastX = p.x; lastY = p.y;
      }
    }
    function onWheel(e) {
      e.preventDefault();
      radius = Math.min(RADIUS_MAX, Math.max(RADIUS_MIN, radius * (1 + e.deltaY * 0.0012)));
    }
    function onContextMenu(e) { e.preventDefault(); }

    mountEl.style.cursor = 'grab';
    mountEl.style.userSelect = 'none';
    mountEl.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    mountEl.addEventListener('wheel', onWheel, { passive: false });
    mountEl.addEventListener('contextmenu', onContextMenu);

    // ---- resize ----
    function resize() {
      const w = mountEl.clientWidth, h = mountEl.clientHeight;
      if (w === 0 || h === 0) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(mountEl);

    // ---- animation loop ----
    let raf;
    let lastTime = performance.now();
    let frameCount = 0, fpsAccum = 0;
    function animate(now) {
      raf = requestAnimationFrame(animate);
      const delta = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      if (autoRotateRef.current) azimuth += delta * 0.14;
      updateCamera();

      if (sweepMesh.visible) sweepMesh.rotation.y -= delta * 0.55;

      renderer.render(scene, camera);

      frameCount++; fpsAccum += delta;
      if (fpsAccum >= 0.5) {
        if (fpsRef.current) fpsRef.current.textContent = String(Math.round(frameCount / fpsAccum));
        frameCount = 0; fpsAccum = 0;
      }
      if (hudAngleRef.current) {
        const deg = ((azimuth * 180) / Math.PI) % 360;
        const tilt = (polar * 180) / Math.PI;
        hudAngleRef.current.textContent = `AZ ${deg.toFixed(0).padStart(3, '0')}\u00B0  \u00B7  TILT ${tilt.toFixed(0)}\u00B0  \u00B7  DIST ${radius.toFixed(1)}M`;
      }
    }
    raf = requestAnimationFrame(animate);
    setReady(true);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      mountEl.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      mountEl.removeEventListener('wheel', onWheel);
      mountEl.removeEventListener('contextmenu', onContextMenu);
      pGeo.dispose(); pMat.dispose(); mGeo.dispose(); fillMat.dispose(); wireMat.dispose();
      sweepGeo.dispose(); sweepMat.dispose();
      floor.geometry.dispose(); floor.material.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mountEl) mountEl.removeChild(renderer.domElement);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pointCount]);

  useEffect(() => { if (objRef.current.points) objRef.current.points.visible = showPoints; }, [showPoints]);
  useEffect(() => { if (objRef.current.meshGroup) objRef.current.meshGroup.visible = showMesh; }, [showMesh]);
  useEffect(() => { if (objRef.current.sweepMesh) objRef.current.sweepMesh.visible = showSweep; }, [showSweep]);

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      height: height,
      background: '#0a0e13',
      overflow: 'hidden',
      fontFamily: "'JetBrains Mono','Space Mono',ui-monospace,SFMono-Regular,Menlo,monospace",
    }}>
      <style>{`
        @keyframes lidar-pulse { 0%,100% { opacity:1; } 50% { opacity:0.25; } }
        .lidar-scanlines {
          position:absolute; inset:0; pointer-events:none; mix-blend-mode:overlay; opacity:0.05;
          background-image: repeating-linear-gradient(to bottom, rgba(255,255,255,0.6) 0px, rgba(255,255,255,0.6) 1px, transparent 1px, transparent 3px);
        }
        .lidar-vignette {
          position:absolute; inset:0; pointer-events:none;
          background: radial-gradient(circle at 50% 50%, transparent 45%, rgba(6,9,12,0.65) 100%);
        }
      `}</style>

      <div ref={mountRef} style={{ position: 'absolute', inset: 0 }} />
      <div className="lidar-scanlines" />
      <div className="lidar-vignette" />

      {/* top-left: title / status */}
      <div style={{ position: 'absolute', top: 16, left: 16, ...panel, minWidth: 210 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%', background: '#8fe9df',
            boxShadow: '0 0 6px #8fe9df', animation: 'lidar-pulse 1.6s ease-in-out infinite',
          }} />
          <span style={{ color: '#e7edf0', fontSize: 12, fontWeight: 600, letterSpacing: '0.12em' }}>
            LIDAR SCAN // SECTOR-07
          </span>
        </div>
        <div style={{ color: '#5c6b73' }}>POINTS &nbsp;<span style={{ color: '#c9d3d9' }}>{pointCount.toLocaleString()}</span></div>
        <div style={{ color: '#5c6b73' }}>FPS &nbsp;&nbsp;&nbsp;&nbsp;<span ref={fpsRef} style={{ color: '#c9d3d9' }}>--</span></div>
        <div style={{ color: '#5c6b73' }}>STATUS &nbsp;<span style={{ color: '#8fe9df' }}>{ready ? 'ACTIVE' : 'INIT'}</span></div>
        <div ref={hudAngleRef} style={{ color: '#455158', marginTop: 6, fontSize: 10 }}>AZ 000\u00B0 \u00B7 TILT 0\u00B0 \u00B7 DIST 0M</div>
      </div>

      {/* top-right: elevation legend */}
      <div style={{ position: 'absolute', top: 16, right: 16, ...panel, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px 12px' }}>
        <span style={{ color: '#5c6b73', fontSize: 9 }}>HIGH</span>
        <div style={{
          width: 10, height: 110, margin: '6px 0',
          background: `linear-gradient(to top, ${RAMP_HEX[0]}, ${RAMP_HEX[1]}, ${RAMP_HEX[2]}, ${RAMP_HEX[3]})`,
          border: '1px solid rgba(140,190,200,0.25)',
        }} />
        <span style={{ color: '#5c6b73', fontSize: 9 }}>LOW</span>
        <span style={{ color: '#455158', fontSize: 8, marginTop: 6 }}>ELEV.</span>
      </div>

      {/* bottom-left: controls legend */}
      <div style={{ position: 'absolute', bottom: 16, left: 16, ...panel }}>
        <div style={{ color: '#5c6b73', marginBottom: 2 }}>DRAG &nbsp;<span style={{ color: '#8a9aa2' }}>— PAN</span></div>
        <div style={{ color: '#5c6b73', marginBottom: 2 }}>SHIFT+DRAG / R-CLICK &nbsp;<span style={{ color: '#8a9aa2' }}>— ORBIT</span></div>
        <div style={{ color: '#5c6b73' }}>SCROLL / PINCH &nbsp;<span style={{ color: '#8a9aa2' }}>— ZOOM</span></div>
      </div>

      {/* bottom-right: toggles */}
      <div style={{ position: 'absolute', bottom: 16, right: 16, display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: 260 }}>
        <ToggleBtn active={showPoints} onClick={() => setShowPoints(v => !v)}>Points</ToggleBtn>
        <ToggleBtn active={showMesh} onClick={() => setShowMesh(v => !v)}>Mesh</ToggleBtn>
        <ToggleBtn active={showSweep} onClick={() => setShowSweep(v => !v)}>Sweep</ToggleBtn>
        <ToggleBtn active={autoRotate} onClick={() => setAutoRotate(v => !v)}>Auto-Rotate</ToggleBtn>
        <button
          onClick={() => objRef.current.reset && objRef.current.reset()}
          style={{ ...btnBase, color: '#8a9aa2' }}
        >
          Reset View
        </button>
      </div>
    </div>
  );
}