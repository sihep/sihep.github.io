import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

const SCAN_URL =
  'https://raw.githubusercontent.com/sihep/sihep.github.io/main/assets/000008.bin';

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
  const a = RAMP[i],
    b = RAMP[i + 1];
  const localT = (t - a.t) / (b.t - a.t || 1);
  out.copy(a.c).lerp(b.c, localT);
  return out;
}

/* ------------------------------------------------------------------ */
/* Real scan loader — KITTI-style Velodyne .bin                       */
/* ------------------------------------------------------------------ */
async function fetchScanBuffer(url) {
  const res = await fetch(url);
  if (!res.ok)
    throw new Error(`Failed to fetch scan (${res.status} ${res.statusText})`);
  return res.arrayBuffer();
}

function parseVelodyneBin(buffer) {
  const floats = new Float32Array(buffer);
  const n = floats.length;
  const count = Math.floor(n / 4);

  const positions = new Float32Array(count * 3);
  const rawIntensity = new Float32Array(count);

  let minX = Infinity,
    maxX = -Infinity;
  let minY = Infinity,
    maxY = -Infinity;
  let minZ = Infinity,
    maxZ = -Infinity;

  for (let idx = 0; idx < count; idx++) {
    const rx = floats[idx * 4];
    const ry = floats[idx * 4 + 1];
    const rz = floats[idx * 4 + 2];
    let iv = floats[idx * 4 + 3];
    if (!Number.isFinite(iv)) iv = 0;
    iv = iv > 1 ? Math.min(1, iv / 255) : Math.max(0, iv);

    // sensor frame z-up -> three.js y-up
    const x = rx,
      y = rz,
      z = -ry;

    positions[idx * 3] = x;
    positions[idx * 3 + 1] = y;
    positions[idx * 3 + 2] = z;
    rawIntensity[idx] = iv;

    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }

  return {
    positions,
    rawIntensity,
    count,
    bounds: { minX, maxX, minY, maxY, minZ, maxZ },
  };
}

/* ------------------------------------------------------------------ */
/* Text Parsers (Ported from HTML/JS version)                         */
/* ------------------------------------------------------------------ */
function tryFloat(s) { const v = parseFloat(s); return Number.isFinite(v) ? v : null; }

function parseDelimited(text, limit) {
  const pts = [];
  const lines = text.split(/\r?\n/);
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li].trim();
    if (!line) continue;
    const tokens = line.split(/[\s,;]+/);
    const x = tryFloat(tokens[0]), y = tryFloat(tokens[1]), z = tryFloat(tokens[2]);
    if (x === null || y === null || z === null) continue;
    let i = null;
    if (tokens.length >= 4) {
      const iv = tryFloat(tokens[3]);
      if (iv !== null) i = iv > 1 ? Math.min(1, iv / 255) : iv;
    }
    pts.push({ x, y, z, i });
    if (limit && pts.length >= limit) break;
  }
  return pts;
}

function parsePCD(text) {
  const lines = text.split(/\r?\n/);
  let dataIdx = -1, fields = ['x', 'y', 'z'];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim();
    if (l.toUpperCase().startsWith('FIELDS')) fields = l.split(/\s+/).slice(1).map(s => s.toLowerCase());
    if (l.toUpperCase().startsWith('DATA')) { dataIdx = i + 1; break; }
  }
  if (dataIdx === -1) return parseDelimited(text);
  const xi = fields.indexOf('x'), yi = fields.indexOf('y'), zi = fields.indexOf('z');
  let ii = fields.indexOf('intensity');
  const pts = [];
  for (let i = dataIdx; i < lines.length; i++) {
    const l = lines[i].trim();
    if (!l) continue;
    const tk = l.split(/\s+/);
    const x = tryFloat(tk[xi]), y = tryFloat(tk[yi]), z = tryFloat(tk[zi]);
    if (x === null || y === null || z === null) continue;
    let iv = null;
    if (ii >= 0) { const raw = tryFloat(tk[ii]); if (raw !== null) iv = raw > 1 ? Math.min(1, raw / 255) : raw; }
    pts.push({ x, y, z, i: iv });
  }
  return pts;
}

function parsePLY(text) {
  const lines = text.split(/\r?\n/);
  let headerEnd = -1, props = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim();
    if (l.startsWith('property')) props.push(l.split(/\s+/).pop().toLowerCase());
    if (l === 'end_header') { headerEnd = i + 1; break; }
  }
  if (headerEnd === -1) return parseDelimited(text);
  const xi = props.indexOf('x'), yi = props.indexOf('y'), zi = props.indexOf('z');
  let ii = props.indexOf('intensity');
  const pts = [];
  for (let i = headerEnd; i < lines.length; i++) {
    const l = lines[i].trim();
    if (!l) continue;
    const tk = l.split(/\s+/);
    const x = tryFloat(tk[xi]), y = tryFloat(tk[yi]), z = tryFloat(tk[zi]);
    if (x === null || y === null || z === null) continue;
    let iv = null;
    if (ii >= 0) { const raw = tryFloat(tk[ii]); if (raw !== null) iv = raw > 1 ? Math.min(1, raw / 255) : raw; }
    pts.push({ x, y, z, i: iv });
  }
  return pts;
}

function parseJSONPoints(text) {
  const data = JSON.parse(text);
  const arr = Array.isArray(data) ? data : (data.points || []);
  const pts = [];
  for (const p of arr) {
    if (Array.isArray(p)) {
      if (p.length >= 3) pts.push({ x: p[0], y: p[1], z: p[2], i: p.length >= 4 ? (p[3] > 1 ? p[3] / 255 : p[3]) : null });
    } else if (p && typeof p === 'object') {
      if (p.x !== undefined && p.y !== undefined && p.z !== undefined) {
        let iv = p.intensity !== undefined ? p.intensity : (p.i !== undefined ? p.i : null);
        if (iv !== null && iv > 1) iv = iv / 255;
        pts.push({ x: p.x, y: p.y, z: p.z, i: iv });
      }
    }
  }
  return pts;
}

function ptsToScan(pts) {
  const count = pts.length;
  const positions = new Float32Array(count * 3);
  const rawIntensity = new Float32Array(count);
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;

  for (let i = 0; i < count; i++) {
    const p = pts[i];
    positions[i * 3] = p.x;
    positions[i * 3 + 1] = p.y;
    positions[i * 3 + 2] = p.z;
    rawIntensity[i] = p.i || 0;
    if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
    if (p.z < minZ) minZ = p.z; if (p.z > maxZ) maxZ = p.z;
  }
  return { positions, rawIntensity, count, bounds: { minX, maxX, minY, maxY, minZ, maxZ } };
}

function generateDemoScan() {
  const pts = [];
  // ground plane, gentle undulation
  for (let i = 0; i < 38000; i++) {
    const x = (Math.random() - 0.5) * 180;
    const z = (Math.random() - 0.5) * 180;
    const y = Math.sin(x * 0.05) * 0.6 + Math.cos(z * 0.05) * 0.4 + (Math.random() - 0.5) * 0.15;
    pts.push({ x, y, z, i: 0.15 + Math.random() * 0.1 });
  }
  // a curving "road" strip
  for (let i = 0; i < 9000; i++) {
    const t = Math.random() * 160 - 80;
    const curve = Math.sin(t * 0.03) * 10;
    const x = curve + (Math.random() - 0.5) * 7;
    const z = t;
    pts.push({ x, y: 0.02 + Math.random() * 0.03, z, i: 0.5 + Math.random() * 0.2 });
  }
  // buildings
  const buildings = [
    { x: -30, z: -20, w: 14, d: 10, h: 22 },
    { x: -30, z: 5, w: 10, d: 16, h: 14 },
    { x: 25, z: -15, w: 16, d: 12, h: 30 },
    { x: 34, z: 20, w: 9, d: 9, h: 11 },
    { x: -10, z: -45, w: 20, d: 8, h: 9 },
  ];
  for (const b of buildings) {
    for (let i = 0; i < 3200; i++) {
      const face = Math.floor(Math.random() * 4);
      let x, z;
      const h = Math.random() * b.h;
      if (face === 0) { x = b.x - b.w / 2; z = b.z + (Math.random() - 0.5) * b.d; }
      else if (face === 1) { x = b.x + b.w / 2; z = b.z + (Math.random() - 0.5) * b.d; }
      else if (face === 2) { x = b.x + (Math.random() - 0.5) * b.w; z = b.z - b.d / 2; }
      else { x = b.x + (Math.random() - 0.5) * b.w; z = b.z + b.d / 2; }
      pts.push({ x, y: h, z, i: 0.35 + (h / b.h) * 0.35 });
    }
    for (let i = 0; i < 400; i++) {
      const x = b.x + (Math.random() - 0.5) * b.w;
      const z = b.z + (Math.random() - 0.5) * b.d;
      pts.push({ x, y: b.h, z, i: 0.6 });
    }
  }
  return ptsToScan(pts);
}

function buildSceneDataFromScan(scan) {
  const { positions, rawIntensity, count, bounds } = scan;
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const tmp = new THREE.Color();

  const yRange = Math.max(1e-6, bounds.maxY - bounds.minY);

  for (let i = 0; i < count; i++) {
    const y = positions[i * 3 + 1];
    const t = (y - bounds.minY) / yRange;
    sampleHeightColor(t, tmp);
    colors[i * 3] = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;
    sizes[i] = 1.0 + rawIntensity[i] * 0.8;
  }

  const cx = (bounds.minX + bounds.maxX) / 2;
  const cz = (bounds.minZ + bounds.maxZ) / 2;
  const spanX = bounds.maxX - bounds.minX;
  const spanZ = bounds.maxZ - bounds.minZ;
  const R = Math.max(spanX, spanZ) / 2 * 1.05;
  const maxH = bounds.maxY - bounds.minY;

  return {
    positions,
    colors,
    sizes,
    R,
    maxH,
    minY: bounds.minY,
    maxY: bounds.maxY,
    cx,
    cz,
    count,
    rawIntensity,
    bounds,
  };
}

/* ------------------------------------------------------------------ */
/* Rasterize the cloud into a smoothed grid -> "hazy mesh"            */
/* ------------------------------------------------------------------ */
function buildHazyGrid(sceneData, gridRes = 56) {
  const { positions, R, maxH, minY, cx, cz, count } = sceneData;
  const size = gridRes;
  const cell = (2 * R) / (size - 1);
  const originX = cx - R;
  const originZ = cz - R;
  const heights = new Float32Array(size * size).fill(-Infinity);

  for (let i = 0; i < count; i++) {
    const x = positions[i * 3],
      y = positions[i * 3 + 1],
      z = positions[i * 3 + 2];
    const gx = Math.min(size - 1, Math.max(0, Math.round((x - originX) / cell)));
    const gz = Math.min(size - 1, Math.max(0, Math.round((z - originZ) / cell)));
    const key = gz * size + gx;
    if (y > heights[key]) heights[key] = y;
  }
  for (let i = 0; i < heights.length; i++) {
    if (!Number.isFinite(heights[i])) heights[i] = minY;
  }

  function blur(src) {
    const out = new Float32Array(src.length);
    for (let gz = 0; gz < size; gz++) {
      for (let gx = 0; gx < size; gx++) {
        let sum = 0,
          cnt = 0;
        for (let dz = -1; dz <= 1; dz++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = gx + dx,
              nz = gz + dz;
            if (nx >= 0 && nx < size && nz >= 0 && nz < size) {
              sum += src[nz * size + nx];
              cnt++;
            }
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
      const x = originX + gx * cell,
        z = originZ + gz * cell,
        y = smoothed[key];
      gridPositions[key * 3] = x;
      gridPositions[key * 3 + 1] = y;
      gridPositions[key * 3 + 2] = z;
      sampleHeightColor(Math.max(0, y - minY) / (maxH || 1), tmp);
      gridColors[key * 3] = tmp.r;
      gridColors[key * 3 + 1] = tmp.g;
      gridColors[key * 3 + 2] = tmp.b;
    }
  }

  const indices = [];
  for (let gz = 0; gz < size - 1; gz++) {
    for (let gx = 0; gx < size - 1; gx++) {
      const a = gz * size + gx,
        b = gz * size + gx + 1,
        c = (gz + 1) * size + gx,
        d = (gz + 1) * size + gx + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  return { gridPositions, gridColors, indices };
}

/* ------------------------------------------------------------------ */
/* Shader for points with uniform scale control                       */
/* ------------------------------------------------------------------ */
const POINT_VERT = `
  uniform float uScale;
  attribute float size;
  attribute vec3 color;
  varying vec3 vColor;
  void main() {
    vColor = color;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size * uScale * (280.0 / -mvPosition.z);
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
/* UI helpers                                                         */
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
/* Main component                                                     */
/* ------------------------------------------------------------------ */
export default function LidarPointCloud({ height = '100vh' }) {
  const mountRef = useRef(null);
  const objRef = useRef({});
  const hudAngleRef = useRef(null);
  const fpsRef = useRef(null);
  const fileInputRef = useRef(null);
  const [showPoints, setShowPoints] = useState(true);
  const [showMesh, setShowMesh] = useState(false);
  const [autoRotate, setAutoRotate] = useState(false);
  const [ready, setReady] = useState(false);
  const [pointCount, setPointCount] = useState(0);
  const [loadState, setLoadState] = useState('loading');
  const [loadError, setLoadError] = useState('');
  const [pointScale, setPointScale] = useState(0.3);
  const [colorMode, setColorMode] = useState('height');
  const [isDragOver, setIsDragOver] = useState(false);
  const autoRotateRef = useRef(autoRotate);

  useEffect(() => {
    autoRotateRef.current = autoRotate;
  }, [autoRotate]);

  // Rebuild colors on colorMode change
  const rebuildColorsRef = useRef(null);

  useEffect(() => {
    if (rebuildColorsRef.current) rebuildColorsRef.current();
  }, [colorMode]);

  useEffect(() => {
    const mountEl = mountRef.current;
    if (!mountEl) return;
    let cancelled = false;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0a0e13');
    scene.fog = new THREE.FogExp2('#0a0e13', 0.012);

    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 500);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.touchAction = 'none';
    mountEl.style.touchAction = 'none';
    mountEl.appendChild(renderer.domElement);

    const target = new THREE.Vector3(0, 3, 0);
    let azimuth = 0.75,
      polar = 0.95,
      radius = 58;
    let initial = { azimuth, polar, radius, target: target.clone() };
    const POLAR_MIN = 0.15,
      POLAR_MAX = 1.48;
    let RADIUS_MIN = 8,
      RADIUS_MAX = 160;

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
      azimuth = initial.azimuth;
      polar = initial.polar;
      radius = initial.radius;
      target.copy(initial.target);
      updateCamera();
    };

    // Pointer controls (same as original)
    const pointers = new Map();
    let mode = null,
      lastX = 0,
      lastY = 0,
      lastPinchDist = 0,
      lastMidX = 0,
      lastMidY = 0;

    function screenRight() {
      const fwd = new THREE.Vector3().subVectors(target, camera.position);
      fwd.y = 0;
      fwd.normalize();
      return new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();
    }

    function screenForward() {
      const fwd = new THREE.Vector3().subVectors(target, camera.position);
      fwd.y = 0;
      fwd.normalize();
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

    function dist(a, b) {
      return Math.hypot(a.x - b.x, a.y - b.y);
    }

    function onPointerDown(e) {
      mountEl.setPointerCapture && mountEl.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 1) {
        mode = e.button === 2 || e.shiftKey ? 'rotate' : 'pan';
        lastX = e.clientX;
        lastY = e.clientY;
        mountEl.style.cursor = mode === 'rotate' ? 'crosshair' : 'grabbing';
      } else if (pointers.size === 2) {
        mode = 'multi';
        const pts = [...pointers.values()];
        lastPinchDist = dist(pts[0], pts[1]);
        lastMidX = (pts[0].x + pts[1].x) / 2;
        lastMidY = (pts[0].y + pts[1].y) / 2;
      }
    }

    function onPointerMove(e) {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (mode === 'pan' && pointers.size === 1) {
        pan(e.clientX - lastX, e.clientY - lastY);
        lastX = e.clientX;
        lastY = e.clientY;
      } else if (mode === 'rotate' && pointers.size === 1) {
        orbit(e.clientX - lastX, e.clientY - lastY);
        lastX = e.clientX;
        lastY = e.clientY;
      } else if (mode === 'multi' && pointers.size === 2) {
        const pts = [...pointers.values()];
        const d = dist(pts[0], pts[1]);
        const midX = (pts[0].x + pts[1].x) / 2,
          midY = (pts[0].y + pts[1].y) / 2;
        if (lastPinchDist > 0)
          radius = Math.min(RADIUS_MAX, Math.max(RADIUS_MIN, radius * (lastPinchDist / d)));
        orbit(midX - lastMidX, midY - lastMidY);
        lastPinchDist = d;
        lastMidX = midX;
        lastMidY = midY;
      }
    }

    function onPointerUp(e) {
      pointers.delete(e.pointerId);
      if (pointers.size === 0) {
        mode = null;
        mountEl.style.cursor = 'grab';
      } else if (pointers.size === 1) {
        mode = 'pan';
        const p = [...pointers.values()][0];
        lastX = p.x;
        lastY = p.y;
      }
    }

    function onWheel(e) {
      e.preventDefault();
      radius = Math.min(RADIUS_MAX, Math.max(RADIUS_MIN, radius * (1 + e.deltaY * 0.0012)));
    }

    function onContextMenu(e) {
      e.preventDefault();
    }

    mountEl.style.cursor = 'grab';
    mountEl.style.userSelect = 'none';
    mountEl.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    mountEl.addEventListener('wheel', onWheel, { passive: false });
    mountEl.addEventListener('contextmenu', onContextMenu);

    // ---- Keyboard controls ----
    const keyMap = {
      w: false,
      a: false,
      s: false,
      d: false,
      q: false,
      e: false,
      arrowup: false,
      arrowdown: false,
      arrowleft: false,
      arrowright: false,
      shift: false,
    };

    const onKeyDown = (e) => {
      const key = e.key.toLowerCase();
      // Ignore if typing in input/select/textarea
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA')) {
        return;
      }
      // Map arrow keys
      let mappedKey = key;
      if (e.key.startsWith('Arrow')) {
        mappedKey = e.key.toLowerCase();
      }
      if (mappedKey in keyMap) {
        e.preventDefault();
        keyMap[mappedKey] = true;
      }
      // Shift
      if (e.key === 'Shift') {
        keyMap.shift = true;
        e.preventDefault();
      }
    };

    const onKeyUp = (e) => {
      const key = e.key.toLowerCase();
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA')) {
        return;
      }
      let mappedKey = key;
      if (e.key.startsWith('Arrow')) {
        mappedKey = e.key.toLowerCase();
      }
      if (mappedKey in keyMap) {
        e.preventDefault();
        keyMap[mappedKey] = false;
      }
      if (e.key === 'Shift') {
        keyMap.shift = false;
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    // ---- Resize ----
    function resize() {
      const w = mountEl.clientWidth,
        h = mountEl.clientHeight;
      if (w === 0 || h === 0) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(mountEl);

    // ---- Animation loop ----
    let raf;
    let lastTime = performance.now();
    let frameCount = 0,
      fpsAccum = 0;

    function animate(now) {
      raf = requestAnimationFrame(animate);
      const delta = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      // Auto-rotate
      if (autoRotateRef.current) azimuth += delta * 0.14;

      // ---- Keyboard pan (WASD + Q/E) ----
      const fwd = screenForward();
      const right = screenRight();
      const speed = radius * 0.08;
      const shift = keyMap.shift ? 2.5 : 1.0;
      const s = speed * shift;

      // WASD panning
      if (keyMap.w) target.addScaledVector(fwd, s * delta);
      if (keyMap.s) target.addScaledVector(fwd, -s * delta);
      if (keyMap.d) target.addScaledVector(right, s * delta);
      if (keyMap.a) target.addScaledVector(right, -s * delta);
      if (keyMap.q) target.y += s * delta;
      if (keyMap.e) target.y -= s * delta;

    // ---- Arrow keys: Look around (First-person turn) ----
      let didLook = false;
      let dAzimuth = 0;
      let dPolar = 0;
      const turnSpeed = 1.8;

      if (keyMap.arrowleft) { dAzimuth += turnSpeed * delta; didLook = true; }
      if (keyMap.arrowright) { dAzimuth -= turnSpeed * delta; didLook = true; }
      if (keyMap.arrowup) { dPolar += turnSpeed * delta; didLook = true; }
      if (keyMap.arrowdown) { dPolar -= turnSpeed * delta; didLook = true; }

      if (didLook) {
        // 1. Capture current camera position before changing angles
        const cx = target.x + radius * Math.sin(polar) * Math.sin(azimuth);
        const cy = target.y + radius * Math.cos(polar);
        const cz = target.z + radius * Math.sin(polar) * Math.cos(azimuth);

        // 2. Update the view angles
        azimuth += dAzimuth;
        polar = Math.min(POLAR_MAX, Math.max(POLAR_MIN, polar + dPolar));

        // 3. Shift the target to match the new look direction while keeping the camera pinned
        target.x = cx - radius * Math.sin(polar) * Math.sin(azimuth);
        target.y = cy - radius * Math.cos(polar);
        target.z = cz - radius * Math.sin(polar) * Math.cos(azimuth);
      }

      updateCamera();

      renderer.render(scene, camera);

      frameCount++;
      fpsAccum += delta;
      if (fpsAccum >= 0.5) {
        if (fpsRef.current) fpsRef.current.textContent = String(Math.round(frameCount / fpsAccum));
        frameCount = 0;
        fpsAccum = 0;
      }
      if (hudAngleRef.current) {
        const deg = ((azimuth * 180) / Math.PI) % 360;
        const tilt = (polar * 180) / Math.PI;
        hudAngleRef.current.textContent = `AZ ${deg.toFixed(0).padStart(3, '0')}\u00B0  \u00B7  TILT ${tilt.toFixed(0)}\u00B0  \u00B7  DIST ${radius.toFixed(1)}M`;
      }
    }
    raf = requestAnimationFrame(animate);
    setReady(true);

    const disposables = [];
    let pointsObj = null,
      meshGroup = null,
      pointMaterial = null,
      floorObj = null;

    objRef.current.updateScene = (scan) => {
      const sceneData = buildSceneDataFromScan(scan);
      objRef.current.sceneData = sceneData;
      
      // Points Update
      if (objRef.current.pointGeometry) {
        objRef.current.pointGeometry.setAttribute('position', new THREE.BufferAttribute(sceneData.positions, 3));
        objRef.current.pointGeometry.setAttribute('size', new THREE.BufferAttribute(sceneData.sizes, 1));
      }
      
      // Hazy Mesh Update
      if (objRef.current.meshGroup) {
        const grid = buildHazyGrid(sceneData, 56);
        const mGeo = objRef.current.meshGroup.children[0].geometry;
        mGeo.setAttribute('position', new THREE.BufferAttribute(grid.gridPositions, 3));
        mGeo.setAttribute('color', new THREE.BufferAttribute(grid.gridColors, 3));
        mGeo.setIndex(grid.indices);
      }

      // Floor Update
      if (floorObj) {
        floorObj.position.set(sceneData.cx, sceneData.minY - 0.05, sceneData.cz);
      }

      // Camera Reframe
      target.set(sceneData.cx, sceneData.minY + sceneData.maxH * 0.35, sceneData.cz);
      radius = Math.max(24, sceneData.R * 1.15);
      RADIUS_MIN = 8;
      RADIUS_MAX = Math.max(160, sceneData.R * 3);
      initial = { azimuth, polar, radius, target: target.clone() };
      objRef.current.reset();

      if (rebuildColorsRef.current) rebuildColorsRef.current();
      setPointCount(sceneData.count);
    };

    // ---- Fetch initial scan and build scene ----
    (async () => {
      try {
        const buffer = await fetchScanBuffer(SCAN_URL);
        if (cancelled) return;

        const scan = parseVelodyneBin(buffer);
        const sceneData = buildSceneDataFromScan(scan);
        const grid = buildHazyGrid(sceneData, 56);

        // ---- points ----
        const pGeo = new THREE.BufferGeometry();
        pGeo.setAttribute('position', new THREE.BufferAttribute(sceneData.positions, 3));
        const colors = new Float32Array(sceneData.count * 3);
        const tmp = new THREE.Color();
        const yRange = Math.max(1e-6, sceneData.bounds.maxY - sceneData.bounds.minY);
        for (let i = 0; i < sceneData.count; i++) {
          const y = sceneData.positions[i * 3 + 1];
          const t = (y - sceneData.bounds.minY) / yRange;
          sampleHeightColor(t, tmp);
          colors[i * 3] = tmp.r;
          colors[i * 3 + 1] = tmp.g;
          colors[i * 3 + 2] = tmp.b;
        }
        pGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        pGeo.setAttribute('size', new THREE.BufferAttribute(sceneData.sizes, 1));

        const pMat = new THREE.ShaderMaterial({
          vertexShader: POINT_VERT,
          fragmentShader: POINT_FRAG,
          transparent: true,
          depthWrite: false,
          uniforms: {
            uScale: { value: pointScale },
          },
        });
        pointMaterial = pMat;
        pointsObj = new THREE.Points(pGeo, pMat);
        pointsObj.visible = showPoints;
        scene.add(pointsObj);
        disposables.push(pGeo, pMat);

        // ---- hazy mesh ----
        const mGeo = new THREE.BufferGeometry();
        mGeo.setAttribute('position', new THREE.BufferAttribute(grid.gridPositions, 3));
        mGeo.setAttribute('color', new THREE.BufferAttribute(grid.gridColors, 3));
        mGeo.setIndex(grid.indices);
        const fillMat = new THREE.MeshBasicMaterial({
          vertexColors: true,
          transparent: true,
          opacity: 0.15,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
        });
        const fillMesh = new THREE.Mesh(mGeo, fillMat);
        const wireMat = new THREE.MeshBasicMaterial({
          color: 0x6fe3d6,
          wireframe: true,
          transparent: true,
          opacity: 0.22,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        const wireMesh = new THREE.Mesh(mGeo, wireMat);
        wireMesh.position.y += 0.015;
        meshGroup = new THREE.Group();
        meshGroup.add(fillMesh, wireMesh);
        meshGroup.visible = showMesh;
        scene.add(meshGroup);
        disposables.push(mGeo, fillMat, wireMat);

        // ---- floor grid ----
        const floorSize = Math.max(40, sceneData.R * 2.2);
        floorObj = new THREE.GridHelper(floorSize, 24, 0x22404a, 0x152128);
        floorObj.position.set(sceneData.cx, sceneData.minY - 0.05, sceneData.cz);
        floorObj.material.transparent = true;
        floorObj.material.opacity = 0.45;
        scene.add(floorObj);
        disposables.push(floorObj.geometry, floorObj.material);

        // ---- reframe camera ----
        target.set(sceneData.cx, sceneData.minY + sceneData.maxH * 0.35, sceneData.cz);
        radius = Math.max(24, sceneData.R * 1.15);
        RADIUS_MIN = 8;
        RADIUS_MAX = Math.max(160, sceneData.R * 3);
        initial = { azimuth, polar, radius, target: target.clone() };
        objRef.current.reset();

        setPointCount(sceneData.count);
        setLoadState('loaded');

        objRef.current.points = pointsObj;
        objRef.current.meshGroup = meshGroup;
        objRef.current.renderer = renderer;
        objRef.current.camera = camera;
        objRef.current.sceneData = sceneData;
        objRef.current.pointMaterial = pMat;
        objRef.current.pointGeometry = pGeo;

        // ---- rebuild colors function ----
        rebuildColorsRef.current = () => {
          if (!pointsObj || !objRef.current.sceneData) return;
          const geo = pointsObj.geometry;
          const { positions, rawIntensity, bounds, count } = objRef.current.sceneData;
          const newColors = new Float32Array(count * 3);
          const tmp = new THREE.Color();
          const yRange = Math.max(1e-6, bounds.maxY - bounds.minY);
          const hasIntensity = rawIntensity && rawIntensity.length > 0;

          for (let i = 0; i < count; i++) {
            let t;
            if (colorMode === 'intensity' && hasIntensity) {
              t = Math.min(1, Math.max(0, rawIntensity[i] || 0));
            } else if (colorMode === 'flat') {
              t = 0.55;
            } else {
              const y = positions[i * 3 + 1];
              t = (y - bounds.minY) / yRange;
            }
            sampleHeightColor(t, tmp);
            newColors[i * 3] = tmp.r;
            newColors[i * 3 + 1] = tmp.g;
            newColors[i * 3 + 2] = tmp.b;
          }
          geo.setAttribute('color', new THREE.BufferAttribute(newColors, 3));
          geo.attributes.color.needsUpdate = true;
        };
        rebuildColorsRef.current();

      } catch (err) {
        if (cancelled) return;
        setLoadState('error');
        setLoadError(err && err.message ? err.message : 'Failed to load scan');
      }
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      mountEl.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      mountEl.removeEventListener('wheel', onWheel);
      mountEl.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      disposables.forEach((d) => d.dispose && d.dispose());
      renderer.dispose();
      if (renderer.domElement.parentNode === mountEl) mountEl.removeChild(renderer.domElement);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update point scale uniform
  useEffect(() => {
    const mat = objRef.current.pointMaterial;
    if (mat && mat.uniforms) {
      mat.uniforms.uScale.value = pointScale;
    }
  }, [pointScale]);

  useEffect(() => {
    if (objRef.current.points) objRef.current.points.visible = showPoints;
  }, [showPoints]);

  useEffect(() => {
    if (objRef.current.meshGroup) objRef.current.meshGroup.visible = showMesh;
  }, [showMesh]);

  const handleDragOver = (e) => { e.preventDefault(); setIsDragOver(true); };
  const handleDragLeave = (e) => { e.preventDefault(); setIsDragOver(false); };
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) processFile(file);
  };

  const processFile = (file) => {
    setLoadState('loading');
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    const reader = new FileReader();
    reader.onerror = () => { setLoadState('error'); setLoadError('Failed to read file'); };
    if (ext === 'bin') {
      reader.onload = () => {
        try {
          const scan = parseVelodyneBin(reader.result);
          objRef.current.updateScene(scan);
          setLoadState('loaded');
        } catch (err) {
          setLoadState('error'); setLoadError(err.message);
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      reader.onload = () => {
        try {
          let pts = [];
          if (ext === 'pcd') pts = parsePCD(reader.result);
          else if (ext === 'ply') pts = parsePLY(reader.result);
          else if (ext === 'json') pts = parseJSONPoints(reader.result);
          else pts = parseDelimited(reader.result);
          const scan = ptsToScan(pts);
          objRef.current.updateScene(scan);
          setLoadState('loaded');
        } catch (err) {
          setLoadState('error'); setLoadError(err.message);
        }
      };
      reader.readAsText(file);
    }
  };

  const loadDemo = () => {
    setLoadState('loading');
    setTimeout(() => {
      try {
        const scan = generateDemoScan();
        objRef.current.updateScene(scan);
        setLoadState('loaded');
      } catch(err) {
        setLoadState('error'); setLoadError(err.message);
      }
    }, 50);
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        position: 'relative',
        width: '100%',
        height: height,
        background: '#0a0e13',
        overflow: 'hidden',
        fontFamily: "'JetBrains Mono','Space Mono',ui-monospace,SFMono-Regular,Menlo,monospace",
      }}
    >
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
        input[type="range"] {
          -webkit-appearance: none;
          appearance: none;
          width: 100%;
          height: 2px;
          background: rgba(140,190,200,0.25);
          outline: none;
          border-radius: 2px;
        }
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: #8fe9df;
          cursor: pointer;
          border: 2px solid #0a0e13;
          box-shadow: 0 0 8px rgba(143,233,223,0.3);
        }
        input[type="range"]::-moz-range-thumb {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: #8fe9df;
          cursor: pointer;
          border: 2px solid #0a0e13;
        }
        select {
          background: rgba(12,17,23,0.8);
          border: 1px solid rgba(140,190,200,0.18);
          color: #c9d3d9;
          font-family: inherit;
          font-size: 10px;
          letter-spacing: 0.06em;
          padding: 5px 8px;
          border-radius: 2px;
          outline: none;
          cursor: pointer;
          width: 100%;
        }
        select:focus {
          border-color: rgba(143,233,223,0.4);
        }
        .control-group {
          display: flex;
          flex-direction: column;
          gap: 4px;
          margin-top: 4px;
        }
        .control-label {
          display: flex;
          justify-content: space-between;
          font-size: 10px;
          color: #5c6b73;
          letter-spacing: 0.06em;
        }
        .control-label span:last-child {
          color: #8fe9df;
        }
        .drop-zone {
          border: 1px dashed rgba(140,190,200,0.4);
          border-radius: 2px;
          padding: 14px 10px;
          text-align: center;
          cursor: pointer;
          transition: all 0.15s;
        }
        .drop-zone:hover, .drop-zone.dragover {
          border-color: #8fe9df;
          background: rgba(143,233,223,0.14);
        }
        .drop-zone .lbl {
          font-size: 11px;
          color: #c9d3d9;
          letter-spacing: 0.02em;
        }
        .drop-zone .hint {
          font-size: 9.5px;
          color: #5c6b73;
          margin-top: 3px;
        }
        .section-label {
          font-size: 9.5px;
          letter-spacing: 0.14em;
          color: #5c6b73;
          margin-bottom: 6px;
          text-transform: uppercase;
        }
        .btn-primary {
          background: rgba(143,233,223,0.1);
          border: 1px solid rgba(143,233,223,0.4);
          color: #8fe9df;
          cursor: pointer;
          padding: 7px 10px;
          font-size: 10px;
          text-transform: uppercase;
          width: 100%;
          transition: all 0.15s;
          font-family: inherit;
        }
        .btn-primary:hover {
          background: rgba(143,233,223,0.2);
        }
      `}</style>

      <div ref={mountRef} style={{ position: 'absolute', inset: 0 }} />
      <div className="lidar-scanlines" />
      <div className="lidar-vignette" />

      {/* top-left: title / status */}
      <div style={{ position: 'absolute', top: 16, left: 16, ...panel, minWidth: 210 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: '#8fe9df',
              boxShadow: '0 0 6px #8fe9df',
              animation: 'lidar-pulse 1.6s ease-in-out infinite',
            }}
          />
          <span style={{ color: '#e7edf0', fontSize: 12, fontWeight: 600, letterSpacing: '0.12em' }}>
            LIDAR SCAN VIEWER
          </span>
        </div>
        <div style={{ color: '#5c6b73' }}>
          POINTS &nbsp;<span style={{ color: '#c9d3d9' }}>{pointCount.toLocaleString()}</span>
        </div>
        <div style={{ color: '#5c6b73' }}>
          FPS &nbsp;&nbsp;&nbsp;&nbsp;<span ref={fpsRef} style={{ color: '#c9d3d9' }}>--</span>
        </div>
        <div style={{ color: '#5c6b73' }}>
          STATUS &nbsp;
          <span style={{ color: loadState === 'error' ? '#e8a39c' : '#8fe9df' }}>
            {loadState === 'loading'
              ? 'FETCHING SCAN…'
              : loadState === 'error'
              ? 'LOAD FAILED'
              : ready
              ? 'ACTIVE'
              : 'INIT'}
          </span>
        </div>
        {loadState === 'error' && (
          <div style={{ color: '#e8a39c', marginTop: 4, fontSize: 9.5, maxWidth: 190, lineHeight: 1.5 }}>
            {loadError || 'Could not fetch data'}
          </div>
        )}
        <div ref={hudAngleRef} style={{ color: '#455158', marginTop: 6, fontSize: 10 }}>
          AZ 000° · TILT 0° · DIST 0M
        </div>
      </div>

      {/* top-right: controls + legend */}
      <div
        style={{
          position: 'absolute',
          top: 16,
          right: 16,
          ...panel,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          minWidth: 200,
        }}
      >
        {/* Dataset Panel Ported from HTML */}
        <div>
          <div className="section-label">Dataset</div>
          <div 
            className={`drop-zone ${isDragOver ? 'dragover' : ''}`}
            onClick={() => fileInputRef.current && fileInputRef.current.click()}
          >
            <div className="lbl">Drop file or click to browse</div>
            <div className="hint">.bin · .xyz · .csv · .txt · .pcd · .ply · .json</div>
          </div>
          <input 
            type="file" 
            ref={fileInputRef}
            style={{ display: 'none' }} 
            accept=".xyz,.csv,.txt,.pcd,.ply,.json,.bin"
            onChange={handleFileChange}
          />
          <div style={{ marginTop: 8 }}>
            <button className="btn-primary" onClick={loadDemo}>Load demo scan</button>
          </div>
        </div>

        <div style={{ height: 1, background: 'rgba(140,190,200,0.1)' }}></div>

        {/* Legend */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <span style={{ color: '#5c6b73', fontSize: 9 }}>HIGH</span>
          <div
            style={{
              width: 10,
              height: 80,
              margin: '4px 0',
              background: `linear-gradient(to top, ${RAMP_HEX[0]}, ${RAMP_HEX[1]}, ${RAMP_HEX[2]}, ${RAMP_HEX[3]})`,
              border: '1px solid rgba(140,190,200,0.25)',
            }}
          />
          <span style={{ color: '#5c6b73', fontSize: 9 }}>LOW</span>
          <span style={{ color: '#455158', fontSize: 8, marginTop: 4 }}>
            {colorMode === 'height' ? 'ELEV.' : colorMode === 'intensity' ? 'INTENS.' : 'FLAT'}
          </span>
        </div>

        {/* Controls */}
        <div style={{ borderTop: '1px solid rgba(140,190,200,0.1)', paddingTop: 8 }}>
          <div className="section-label" style={{ marginBottom: 4 }}>Display</div>
          <div className="control-group">
            <div className="control-label">
              <span>Point Size</span>
              <span>{pointScale.toFixed(2)}×</span>
            </div>
            <input
              type="range"
              min="0.04"
              max="2.0"
              step="0.01"
              value={pointScale}
              onChange={(e) => setPointScale(parseFloat(e.target.value))}
            />
          </div>
          <div className="control-group">
            <div className="control-label">
              <span>Color By</span>
            </div>
            <select value={colorMode} onChange={(e) => setColorMode(e.target.value)}>
              <option value="height">Height</option>
              <option value="intensity">Intensity</option>
              <option value="flat">Flat</option>
            </select>
          </div>
        </div>
      </div>

      {/* bottom-left: controls legend (updated) */}
      <div style={{ position: 'absolute', bottom: 16, left: 16, ...panel }}>
        <div style={{ color: '#5c6b73', marginBottom: 2 }}>
          DRAG &nbsp;<span style={{ color: '#8a9aa2' }}>— PAN</span>
        </div>
        <div style={{ color: '#5c6b73', marginBottom: 2 }}>
          SHIFT+DRAG / R-CLICK &nbsp;<span style={{ color: '#8a9aa2' }}>— ORBIT</span>
        </div>
        <div style={{ color: '#5c6b73', marginBottom: 2 }}>
          SCROLL / PINCH &nbsp;<span style={{ color: '#8a9aa2' }}>— ZOOM</span>
        </div>
        <div style={{ color: '#5c6b73', marginBottom: 2 }}>
          WASD &nbsp;<span style={{ color: '#8a9aa2' }}>— PAN (FAST)</span>
        </div>
        <div style={{ color: '#5c6b73', marginBottom: 2 }}>
          Q / E &nbsp;<span style={{ color: '#8a9aa2' }}>— UP / DOWN</span>
        </div>
        <div style={{ color: '#5c6b73', marginBottom: 2 }}>
          ARROWS &nbsp;<span style={{ color: '#8a9aa2' }}>— ORBIT (TURN)</span>
        </div>
        <div style={{ color: '#5c6b73' }}>
          SHIFT &nbsp;<span style={{ color: '#8a9aa2' }}>— SPRINT (2.5× speed)</span>
        </div>
      </div>

      {/* bottom-right: toggles */}
      <div
        style={{
          position: 'absolute',
          bottom: 16,
          right: 16,
          display: 'flex',
          gap: 6,
          flexWrap: 'wrap',
          justifyContent: 'flex-end',
          maxWidth: 260,
        }}
      >
        <ToggleBtn active={showPoints} onClick={() => setShowPoints((v) => !v)}>
          Points
        </ToggleBtn>
        <ToggleBtn active={showMesh} onClick={() => setShowMesh((v) => !v)}>
          Mesh
        </ToggleBtn>
        <ToggleBtn active={autoRotate} onClick={() => setAutoRotate((v) => !v)}>
          Auto-Rotate
        </ToggleBtn>
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