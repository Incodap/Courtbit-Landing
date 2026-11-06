// Cancha de pádel 3D de CourtBit: arma la cancha con bits, juega puntos sola,
// responde al dedo y tiene un minijuego ("Devuélvela").
// Medidas reales: 10 m x 20 m, red al centro, vidrio en el fondo.
import * as THREE from './vendor/three-0.169.0.module.min.js';

const LIME = 0xb8f02b;
const G = 7.6; // gravedad un poco lenta: se lee como render en cámara lenta
const INTRO_END = 3.3;
const AZ_REST = 3.74;
const EL_REST = 0.6;
const EL_GAME = 0.84;
const TAU = Math.PI * 2;

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
const outCubic = (t) => 1 - Math.pow(1 - t, 3);
const outBack = (t) => { const c1 = 1.5, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
const inOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const smooth = (t) => t * t * (3 - 2 * t);
const inQuad = (t) => t * t;
const rand = (a, b) => a + Math.random() * (b - a);
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

function canvasTexture(w, h, draw, { srgb = true, repeat = false } = {}) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function radialTexture(inner, outer, size = 128) {
  return canvasTexture(size, size, (g, w) => {
    const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    r.addColorStop(0, inner);
    r.addColorStop(1, outer);
    g.fillStyle = r;
    g.fillRect(0, 0, w, w);
  });
}

export function mountCourt(host, ui = {}) {
  const reduce = !!ui.reduce;
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  let dirty = true, visible = true, raf = 0, last = performance.now();
  let mode = 'show';

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  let dpr = Math.min(window.devicePixelRatio || 1, 1.75);
  renderer.setPixelRatio(dpr);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  const canvas = renderer.domElement;
  canvas.className = 'stage-canvas';
  canvas.style.opacity = '0';
  host.prepend(canvas);
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.5, 220);
  const TARGET_SHOW = V(0, 1.1, 0);
  const TARGET_GAME = V(0, 0.3, 0.6);
  const target = TARGET_SHOW.clone();

  // ---------- Luz ----------
  scene.add(new THREE.HemisphereLight(0xd4f0e2, 0x0a1d17, 0.75));
  const sun = new THREE.DirectionalLight(0xffffff, 1.9);
  sun.position.set(-9, 17, -6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 2, far: 45 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xbfe8ff, 0.35);
  fill.position.set(10, 6, 12);
  scene.add(fill);

  // ---------- Piso del estudio: cuadrícula que se pierde ----------
  const gridTex = canvasTexture(128, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.strokeStyle = 'rgba(196, 238, 176, 0.9)';
    g.lineWidth = 2;
    g.strokeRect(0, 0, w, h);
  }, { repeat: true });
  gridTex.repeat.set(36, 36);
  gridTex.anisotropy = aniso;
  const fadeTex = canvasTexture(256, 256, (g, w) => {
    const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    r.addColorStop(0, '#fff');
    r.addColorStop(0.35, '#777');
    r.addColorStop(1, '#000');
    g.fillStyle = r;
    g.fillRect(0, 0, w, w);
  }, { srgb: false });
  const floorMat = new THREE.MeshBasicMaterial({ map: gridTex, alphaMap: fadeTex, transparent: true, opacity: 0.16, depthWrite: false });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(72, 72), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.5;
  scene.add(floor);

  // Sombra de contacto y resplandor LED bajo la plataforma
  const PX = 5.8, PZ = 10.8;
  const halo = (draw, opacity, blending) => {
    const tex = canvasTexture(352, 552, draw);
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(17.6, 27.6),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity, depthWrite: false, blending })
    );
    m.rotation.x = -Math.PI / 2;
    m.position.y = -0.495;
    scene.add(m);
    return m;
  };
  const contact = halo((g) => {
    g.filter = 'blur(22px)';
    g.fillStyle = 'rgba(0,0,0,0.85)';
    g.fillRect(52, 52, 248, 448);
  }, 0.75, THREE.NormalBlending);
  const ledGlow = halo((g) => {
    g.filter = 'blur(14px)';
    g.strokeStyle = 'rgba(184,240,43,0.9)';
    g.lineWidth = 10;
    g.strokeRect(60, 60, 232, 432);
    g.filter = 'blur(3px)';
    g.lineWidth = 3;
    g.strokeRect(60, 60, 232, 432);
  }, 0.0, THREE.AdditiveBlending);

  // ---------- Plataforma ----------
  const platform = new THREE.Mesh(
    new THREE.BoxGeometry(PX * 2, 0.5, PZ * 2).translate(0, -0.25, 0),
    new THREE.MeshStandardMaterial({ color: 0x111b18, roughness: 0.72, metalness: 0.25 })
  );
  platform.receiveShadow = true;
  scene.add(platform);

  // Tira LED perimetral: se dibuja alrededor de la base
  const ledMat = new THREE.MeshBasicMaterial({ color: LIME });
  const leds = [
    { L: PX * 2, x: -PX, z: -PZ, r: 0 },
    { L: PZ * 2, x: PX, z: -PZ, r: -Math.PI / 2 },
    { L: PX * 2, x: PX, z: PZ, r: Math.PI },
    { L: PZ * 2, x: -PX, z: PZ, r: Math.PI / 2 },
  ].map((d) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(d.L, 0.05, 0.05).translate(d.L / 2, 0, 0), ledMat);
    m.position.set(d.x, -0.47, d.z);
    m.rotation.y = d.r;
    scene.add(m);
    return m;
  });

  // ---------- Pasto ----------
  const turfTex = canvasTexture(512, 1024, (g, w, h) => {
    g.fillStyle = '#2f7a43';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 10; i++) {
      g.fillStyle = i % 2 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.035)';
      g.fillRect(0, (i * h) / 10, w, h / 10);
    }
    const img = g.getImageData(0, 0, w, h);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = (Math.random() - 0.5) * 30;
      d[i] += n * 0.55;
      d[i + 1] += n;
      d[i + 2] += n * 0.45;
    }
    g.putImageData(img, 0, 0);
  });
  turfTex.anisotropy = aniso;
  const turfMat = new THREE.MeshStandardMaterial({ map: turfTex, roughness: 0.95, metalness: 0, transparent: true, opacity: 1 });
  const turf = new THREE.Mesh(new THREE.PlaneGeometry(10, 20), turfMat);
  turf.rotation.x = -Math.PI / 2;
  turf.position.y = 0.004;
  turf.receiveShadow = true;
  turf.renderOrder = -1;
  scene.add(turf);

  // Líneas: servicio a 6.95 m de la red y central con 20 cm de extensión
  const lineMat = new THREE.MeshStandardMaterial({ color: 0xf1f6f2, roughness: 0.6 });
  const lines = [];
  const addLine = (w, d, x, z, axis) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.012, d), lineMat);
    m.position.set(x, 0.012, z);
    m.receiveShadow = true;
    m.userData.axis = axis;
    scene.add(m);
    lines.push(m);
  };
  addLine(10, 0.09, 0, -6.95, 'x');
  addLine(10, 0.09, 0, 6.95, 'x');
  addLine(0.09, 14.3, 0, 0, 'z');

  // ---------- Paredes: vidrio, malla y estructura ----------
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x0c1311, roughness: 0.42, metalness: 0.65 });
  const limeFrameMat = new THREE.MeshStandardMaterial({ color: LIME, emissive: LIME, emissiveIntensity: 0.55, roughness: 0.4 });
  const meshTex = canvasTexture(64, 64, (g, w, h) => {
    g.fillStyle = '#000';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#fff';
    g.lineWidth = 5;
    g.strokeRect(0, 0, w, h);
  }, { srgb: false, repeat: true });
  const fenceMat = new THREE.MeshStandardMaterial({ color: 0x24302c, alphaMap: meshTex, transparent: true, opacity: 0.95, depthWrite: false, side: THREE.DoubleSide, metalness: 0.45, roughness: 0.5 });
  const glassTex = canvasTexture(128, 256, (g, w, h) => {
    const l = g.createLinearGradient(0, 0, w, h);
    l.addColorStop(0, '#ffffff');
    l.addColorStop(0.42, '#9fd6c2');
    l.addColorStop(0.5, '#e9fff6');
    l.addColorStop(0.58, '#9fd6c2');
    l.addColorStop(1, '#7fbfa8');
    g.fillStyle = l;
    g.fillRect(0, 0, w, h);
  });
  const glassEdgeMat = new THREE.MeshBasicMaterial({ color: 0xd9f7ea, transparent: true, opacity: 0.55, depthWrite: false });
  const glass = [];
  const wallGroups = [];

  function plane(w, h, cell) {
    const geo = new THREE.PlaneGeometry(w, h);
    if (cell) {
      const uv = geo.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * w) / cell, (uv.getY(i) * h) / cell);
    }
    return geo;
  }

  function addGlass(group, w, h, x, z, rotY) {
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff, map: glassTex, transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0.2,
      side: THREE.DoubleSide, depthWrite: false, emissive: LIME, emissiveIntensity: 0,
    });
    const m = new THREE.Mesh(plane(w, h).translate(0, h / 2, 0), mat);
    m.position.set(x, 0, z);
    m.rotation.y = rotY;
    m.renderOrder = 3;
    group.add(m);
    // Canto del vidrio: una línea clara que dibuja el panel
    const edge = new THREE.Mesh(new THREE.BoxGeometry(w - 0.06, 0.035, 0.035), glassEdgeMat);
    edge.position.set(x, h - 0.02, z);
    edge.rotation.y = rotY;
    edge.renderOrder = 4;
    group.add(edge);
    glass.push({ mat, x, z, flash: 0 });
  }

  function addFence(group, w, h, y0, x, z, rotY) {
    const m = new THREE.Mesh(plane(w, h, 0.22).translate(0, y0 + h / 2, 0), fenceMat);
    m.position.set(x, 0, z);
    m.rotation.y = rotY;
    m.renderOrder = 2;
    group.add(m);
  }

  function addPost(group, x, z, h, mat) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.09, h, 0.09).translate(0, h / 2, 0), mat);
    m.position.set(x, 0, z);
    m.castShadow = true;
    group.add(m);
  }

  function addRail(group, x1, z1, x2, z2, y, mat) {
    const len = Math.hypot(x2 - x1, z2 - z1);
    const m = new THREE.Mesh(new THREE.BoxGeometry(len, 0.07, 0.07), mat);
    m.position.set((x1 + x2) / 2, y, (z1 + z2) / 2);
    m.rotation.y = -Math.atan2(z2 - z1, x2 - x1);
    m.castShadow = true;
    group.add(m);
  }

  function backWall(sign, mat) {
    const g = new THREE.Group();
    const z = sign * 10;
    for (let i = 0; i < 5; i++) addGlass(g, 2, 3, -4 + i * 2, z, 0);
    addFence(g, 10, 1, 3, 0, z, 0);
    for (let i = 0; i <= 5; i++) addPost(g, -5 + i * 2, z, 4, mat);
    addRail(g, -5, z, 5, z, 3, mat);
    addRail(g, -5, z, 5, z, 4, mat);
    scene.add(g);
    return g;
  }

  function sideWall(sign) {
    const g = new THREE.Group();
    const x = sign * 5;
    const r = Math.PI / 2;
    for (const s of [-1, 1]) {
      addGlass(g, 2, 3, x, s * 9, r);
      addFence(g, 2, 1, 3, x, s * 9, r);
      addGlass(g, 2, 2, x, s * 7, r);
      addFence(g, 2, 1, 2, x, s * 7, r);
      addRail(g, x, s * 10, x, s * 8, 4, frameMat);
      addRail(g, x, s * 10, x, s * 8, 3, frameMat);
      addRail(g, x, s * 8, x, s * 6, 3, frameMat);
      addRail(g, x, s * 8, x, s * 6, 2, frameMat);
      addPost(g, x, s * 8, 4, frameMat);
    }
    addFence(g, 12, 3, 0, x, 0, r);
    addRail(g, x, -6, x, 6, 3, frameMat);
    for (let z = -6; z <= 6; z += 2) addPost(g, x, z, 3, frameMat);
    scene.add(g);
    return g;
  }

  wallGroups.push(
    { g: backWall(-1, limeFrameMat), at: 1.85 },
    { g: sideWall(-1), at: 2.0 },
    { g: sideWall(1), at: 2.0 },
    { g: backWall(1, frameMat), at: 2.15 }
  );

  // Red
  const net = new THREE.Group();
  const netMesh = new THREE.Mesh(
    plane(10, 0.86, 0.09).translate(0, 0.45, 0),
    new THREE.MeshStandardMaterial({ color: 0x2a3632, alphaMap: meshTex, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide, roughness: 0.8 })
  );
  net.add(netMesh);
  const tape = new THREE.Mesh(new THREE.BoxGeometry(10, 0.06, 0.03), new THREE.MeshStandardMaterial({ color: 0xf4f8f6, roughness: 0.5 }));
  tape.position.y = 0.88;
  tape.castShadow = true;
  net.add(tape);
  scene.add(net);

  // ---------- Postes de luz ----------
  const glareTex = radialTexture('rgba(255,250,230,1)', 'rgba(255,250,230,0)');
  const coneTex = canvasTexture(4, 128, (g, w, h) => {
    const l = g.createLinearGradient(0, 0, 0, h);
    l.addColorStop(0, 'rgba(255,250,228,1)');
    l.addColorStop(1, 'rgba(255,250,228,0)');
    g.fillStyle = l;
    g.fillRect(0, 0, w, h);
  });
  const lampFaceMat = new THREE.MeshBasicMaterial({ color: 0xfff6dc });
  const glareMat = new THREE.SpriteMaterial({ map: glareTex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const coneMat = new THREE.MeshBasicMaterial({ map: coneTex, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
  const poles = [];
  for (const [sx, sz] of [[1, -1], [-1, 1]]) {
    const g = new THREE.Group();
    const base = V(sx * 5.5, 0, sz * 10.5);
    const H = 6.3;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, H, 10).translate(0, H / 2, 0), frameMat);
    pole.position.copy(base);
    pole.castShadow = true;
    g.add(pole);
    const aim = V(sx * 2.2, 0, sz * 5.2);
    const head = new THREE.Group();
    head.position.set(base.x - sx * 0.45, H + 0.05, base.z - sz * 0.45);
    head.lookAt(aim);
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.42, 0.16), frameMat);
    head.add(box);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.74, 0.32), lampFaceMat);
    face.position.z = 0.085;
    head.add(face);
    g.add(head);
    const glare = new THREE.Sprite(glareMat);
    glare.scale.set(1.7, 1.7, 1);
    glare.position.copy(head.position);
    g.add(glare);
    const dir = aim.clone().sub(head.position);
    const len = dir.length() * 0.92;
    dir.normalize();
    const cone = new THREE.Mesh(new THREE.ConeGeometry(2.6, len, 28, 1, true), coneMat);
    cone.quaternion.setFromUnitVectors(V(0, -1, 0), dir);
    cone.position.copy(head.position).addScaledVector(dir, len / 2);
    g.add(cone);
    g.userData = { near: sz > 0, s: 1 };
    scene.add(g);
    poles.push(g);
  }

  // ---------- Bits: arman la cancha y luego flotan ----------
  const PALETTE = [0xb8f02b, 0xb8f02b, 0xb8f02b, 0xa7cd50, 0x63af5a, 0xf4f8f6].map((c) => new THREE.Color(c));
  const turfColor = new THREE.Color(0x2f7a43);
  const tileMesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.94, 0.94, 0.94),
    new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0.1 }),
    200
  );
  const tiles = [];
  for (let j = 0; j < 20; j++) {
    for (let i = 0; i < 10; i++) {
      tiles.push({
        x: -4.5 + i, z: -9.5 + j,
        sx: rand(-1.4, 1.4), sy: rand(7, 11), sz: rand(-1.4, 1.4),
        rx: rand(-2, 2), ry: rand(-2, 2),
        delay: 0.35 + ((i / 9) * 0.35 + (j / 19) * 0.65) * 0.75 + rand(0, 0.12),
        color: PALETTE[(Math.random() * PALETTE.length) | 0].clone(),
      });
    }
  }
  scene.add(tileMesh);

  const PCOUNT = 72;
  const bitMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial(), PCOUNT);
  bitMesh.frustumCulled = false;
  const bits = Array.from({ length: PCOUNT }, () => ({ on: false, p: V(), v: V(), life: 0, max: 1, size: 0.2, rot: V(), spin: V(), grav: 0 }));
  const hidden = new THREE.Matrix4().makeScale(0, 0, 0);
  for (let i = 0; i < PCOUNT; i++) {
    bitMesh.setMatrixAt(i, hidden);
    bitMesh.setColorAt(i, PALETTE[0]);
  }
  scene.add(bitMesh);

  function spawnBit(p, v, life, size, grav) {
    const i = bits.findIndex((x) => !x.on);
    if (i < 0) return;
    const b = bits[i];
    b.on = true;
    b.p.copy(p);
    b.v.copy(v);
    b.life = 0;
    b.max = life;
    b.size = size;
    b.grav = grav;
    b.rot.set(rand(0, 3), rand(0, 3), 0);
    b.spin.set(rand(-2, 2), rand(-2, 2), 0);
    bitMesh.setColorAt(i, PALETTE[(Math.random() * PALETTE.length) | 0]);
    bitMesh.instanceColor.needsUpdate = true;
  }

  function burst(p, n = 12) {
    for (let i = 0; i < n; i++) {
      spawnBit(V(p.x, Math.max(0.15, p.y), p.z), V(rand(-1.7, 1.7), rand(2.6, 4.4), rand(-1.7, 1.7)), rand(0.9, 1.3), rand(0.16, 0.3), G * 0.6);
    }
  }

  // ---------- Bola, estela, sombra y ondas ----------
  const ball = new THREE.Mesh(
    new THREE.SphereGeometry(0.17, 24, 16),
    new THREE.MeshStandardMaterial({ color: LIME, emissive: 0x8fbf16, emissiveIntensity: 0.35, roughness: 0.45 })
  );
  ball.visible = false;
  scene.add(ball);
  let ballScale = 0;
  const TRAIL = 10;
  const trail = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.17, 12, 8),
    new THREE.MeshBasicMaterial({ color: LIME, transparent: true, opacity: 0.2, depthWrite: false, blending: THREE.AdditiveBlending }),
    TRAIL
  );
  trail.frustumCulled = false;
  for (let i = 0; i < TRAIL; i++) trail.setMatrixAt(i, hidden);
  scene.add(trail);
  const history = [];
  const blob = new THREE.Mesh(
    new THREE.PlaneGeometry(0.9, 0.9),
    new THREE.MeshBasicMaterial({ map: radialTexture('rgba(0,0,0,0.75)', 'rgba(0,0,0,0)'), transparent: true, depthWrite: false })
  );
  blob.rotation.x = -Math.PI / 2;
  blob.visible = false;
  scene.add(blob);

  const ringGeo = new THREE.RingGeometry(0.82, 1, 48);
  const ringMat = () => new THREE.MeshBasicMaterial({ color: LIME, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
  const rings = Array.from({ length: 8 }, () => {
    const m = new THREE.Mesh(ringGeo, ringMat());
    m.visible = false;
    m.userData = { life: 1, size: 1 };
    scene.add(m);
    return m;
  });
  function ring(p, normal, size = 1) {
    const m = rings.find((r) => !r.visible) || rings[0];
    m.visible = true;
    m.userData.life = 0;
    m.userData.size = size;
    m.userData.k = mode === 'game' ? 0.9 : 0.4;
    m.position.copy(p);
    m.rotation.set(0, 0, 0);
    if (normal === 'y') m.rotation.x = -Math.PI / 2;
    if (normal === 'x') m.rotation.y = Math.PI / 2;
  }

  function flashGlass(p) {
    let best = null, bd = Infinity;
    for (const g of glass) {
      const d = Math.hypot(g.x - p.x, g.z - p.z);
      if (d < bd) { bd = d; best = g; }
    }
    if (best && bd < 1.6) best.flash = mode === 'game' ? 1 : 0.45;
  }

  // ---------- Trayectorias ----------
  function arc(p0, p1, T, ev) {
    const v = p1.clone().sub(p0).divideScalar(T);
    v.y += 0.5 * G * T;
    return { p0: p0.clone(), v, T, ev };
  }
  function overNet(p0, p1, T, ev) {
    let s = arc(p0, p1, T, ev);
    if (Math.sign(p0.z) === Math.sign(p1.z)) return s;
    for (let k = 0; k < 14; k++) {
      const tc = -p0.z / s.v.z;
      if (p0.y + s.v.y * tc - 0.5 * G * tc * tc > 1.3) break;
      T += 0.08;
      s = arc(p0, p1, T, ev);
    }
    return s;
  }
  const cx = (x) => clamp(x, -4.3, 4.3);

  // Avanza la bola por una cola de tramos; onEv devuelve false para detenerse
  function runSegs(st, dt, onEv) {
    let left = dt;
    while (left > 0) {
      if (!st.cur) {
        st.cur = st.segs.shift();
        st.t = 0;
        if (!st.cur) return;
      }
      const c = st.cur;
      const step = Math.min(left, c.T - st.t);
      st.t += step;
      left -= step;
      const t = st.t;
      ball.position.set(c.p0.x + c.v.x * t, c.p0.y + c.v.y * t - 0.5 * G * t * t, c.p0.z + c.v.z * t);
      if (st.t >= c.T - 1e-6) {
        st.cur = null;
        if (onEv(c.ev, ball.position) === false) return;
      }
    }
  }

  // ---------- Peloteo de exhibición ----------
  const score = { a: 1, b: 2 }; // arranca con un partido ya en juego: 15-30
  const rally = { segs: [], cur: null, t: 0, wait: 0.2, server: 1 };

  function receive(segs, b, recv) {
    const r = Math.random();
    let h;
    if (r < 0.45) {
      const w = V(cx(b.x + rand(-1.4, 1.4)), rand(0.8, 1.7), recv * 9.85);
      segs.push(arc(b, w, 0.55, { type: 'glass', n: 'z' }));
      h = V(cx(w.x + rand(-1.2, 1.2)), rand(0.75, 1.05), recv * rand(6.8, 8));
      segs.push(arc(w, h, 0.5, { type: 'hit' }));
    } else if (r < 0.65) {
      const sx = (b.x >= 0 ? 1 : -1) * 4.85;
      const w = V(sx, rand(0.8, 1.5), recv * rand(7.2, 9.3));
      segs.push(arc(b, w, 0.5, { type: 'glass', n: 'x' }));
      h = V(cx(sx * 0.5), rand(0.8, 1.05), recv * rand(6.5, 8));
      segs.push(arc(w, h, 0.45, { type: 'hit' }));
    } else {
      h = V(cx(b.x + rand(-1, 1)), rand(0.8, 1.05), recv * rand(7.2, 8.8));
      segs.push(arc(b, h, 0.55, { type: 'hit' }));
    }
    return h;
  }

  function winner(segs, p, b, side) {
    const d = V(b.x - p.x, 0, b.z - p.z).normalize();
    const b2 = V(cx(b.x + d.x * 2.4), 0, clamp(b.z + d.z * 2.4, -9.4, 9.4));
    const b3 = V(cx(b2.x + d.x * 1.1), 0, clamp(b2.z + d.z * 1.1, -9.5, 9.5));
    const b4 = V(cx(b3.x + d.x * 0.5), 0, clamp(b3.z + d.z * 0.5, -9.6, 9.6));
    segs.push(arc(b, b2, 0.62, { type: 'floor' }));
    segs.push(arc(b2, b3, 0.36, { type: 'floor', soft: true }));
    segs.push(arc(b3, b4, 0.22, { type: 'end', side }));
  }

  function plan(from, side, firstBounce, T0) {
    const segs = [];
    const shots = 2 + ((Math.random() * 4) | 0);
    let p = from.clone(), s = side;
    for (let k = 0; k < shots; k++) {
      let b;
      if (k === 0 && firstBounce) b = firstBounce.clone();
      else if (k === 0) b = V(-Math.sign(p.x || 1) * rand(1.4, 3.4), 0, -s * rand(3.2, 6.2));
      else b = V(rand(-3.8, 3.8), 0, -s * rand(2.6, 8.4));
      segs.push(overNet(p, b, k === 0 && T0 ? T0 : rand(0.95, 1.2), { type: 'floor', burst: k === 0 && !!firstBounce }));
      if (k === shots - 1) { winner(segs, p, b, s); break; }
      p = receive(segs, b, -s);
      s = -s;
    }
    return segs;
  }

  function startPoint() {
    rally.server = -rally.server;
    const from = V((Math.random() < 0.5 ? -1 : 1) * rand(1.4, 3), 0.95, rally.server * 8.9);
    rally.segs = plan(from, rally.server);
    rally.cur = null;
    ballScale = 0;
    ball.position.copy(from);
    history.length = 0;
  }

  function serveTo(q) {
    const side = q.z > 0 ? -1 : 1;
    const from = V(clamp(-q.x * 0.4, -3, 3), 1.0, side * 8.9);
    const T0 = clamp(from.distanceTo(q) / 11, 0.7, 1.2);
    rally.segs = plan(from, side, q, T0);
    rally.cur = null;
    rally.wait = 0;
    ballScale = 0;
    ball.position.copy(from);
    history.length = 0;
    ring(V(q.x, 0.03, q.z), 'y', 0.55);
  }

  const LABELS = ['0', '15', '30', '40'];
  function scoreText() {
    const { a, b } = score;
    if (a >= 3 && b >= 3) {
      if (a === b) return ['40', '40'];
      return a > b ? ['AD', '40'] : ['40', 'AD'];
    }
    return [LABELS[Math.min(a, 3)], LABELS[Math.min(b, 3)]];
  }
  function award(side) {
    if (side > 0) score.a++; else score.b++;
    const { a, b } = score;
    if ((a >= 4 || b >= 4) && Math.abs(a - b) >= 2) { score.a = 0; score.b = 0; }
    if (ui.onScore) ui.onScore(scoreText());
  }

  function onRallyEvent(ev, p) {
    if (ev.type === 'floor') {
      ring(V(p.x, 0.03, p.z), 'y', ev.soft ? 0.5 : 0.8);
      if (ev.burst) burst(p);
    } else if (ev.type === 'glass') {
      ring(p.clone(), ev.n, 0.75);
      flashGlass(p);
    } else if (ev.type === 'end') {
      award(ev.side);
      rally.wait = 1.1;
      rally.segs = [];
      return false;
    }
    return true;
  }

  function stepRally(dt) {
    if (rally.wait > 0) {
      rally.wait -= dt;
      ballScale = Math.max(0, ballScale - dt * 5);
      if (rally.wait <= 0 && rally.segs.length === 0) startPoint();
      return;
    }
    ballScale = Math.min(1, ballScale + dt * 6);
    runSegs(rally, dt, onRallyEvent);
  }

  // ---------- Cámara (estado) ----------
  let orbit = AZ_REST, spin = 0, dragVel = 0, distSmooth = 0, gameAz = 0, camBlend = 0;
  let down = null, lastInput = -1e9, lastPointer = null;
  const hover = { x: 0, y: 0 }, hoverS = { x: 0, y: 0 };
  const ray = new THREE.Raycaster();
  const ground = new THREE.Plane(V(0, 1, 0), 0);

  // ---------- Minijuego: "Devuélvela" ----------
  // El rival (lado de la pared lima) te tira; deja que bote y toca su cancha
  // cuando el aro se cierre: el momento da la calidad, el lugar da la dirección.
  // Contrarreloj: 60 s y una sola vida. Se pega después del bote cuando el aro se
  // cierra, o de aire en la zona junto a la red. Perfectos y voleas hacen racha; cada
  // 3 de racha sube el multiplicador. El servidor recalcula el puntaje con estas mismas
  // reglas a partir de la secuencia de golpes (MinigameService.scoreFor).
  const ROUND_S = 60;
  const VOLLEY_Z = 3.6;      // zona de volea: de la red a esta distancia, de tu lado
  const PERFECT_S = 0.12;    // ventana del perfecto alrededor del cierre del aro
  const STUN_S = 0.35;       // un toque a destiempo frena la raqueta; cada toque extra lo alarga
  const MAX_MULT = 5;
  const BASE = [1, 2, 3];    // normal, perfecto, de aire
  const SHOT = { NORMAL: 0, PERFECT: 1, VOLLEY: 2 };
  const BEST_KEY = 'cb-best-60';

  const game = {
    phase: 'off', score: 0, n: 0, best: 0,
    segs: [], cur: null, t: 0, wait: 0, first: true,
    win: false, inFlight: false, toH: 0, postT: 1, glass: false, H: null, B: null,
    timeLeft: ROUND_S, playTime: 0, combo: 0, mult: 1, maxMult: 1, endReason: '',
    // Secuencia de golpes para que el servidor valide la partida: tipo | vidrio<<2 | bit<<3
    events: [], lastShot: null,
    // Práctica guiada la primera vez: 1 deja que bote, 2 de aire, 3 lista para empezar
    tutorial: 0, cued: false, stunUntil: 0,
  };
  try { game.best = parseInt(localStorage.getItem(BEST_KEY), 10) || 0; } catch (e) { game.best = 0; }

  const markMat = ringMat();
  const bounceMark = new THREE.Mesh(ringGeo, markMat);
  bounceMark.rotation.x = -Math.PI / 2;
  bounceMark.visible = false;
  scene.add(bounceMark);
  const hitRing = new THREE.Mesh(ringGeo, ringMat());
  hitRing.rotation.x = -Math.PI / 2;
  hitRing.visible = false;
  scene.add(hitRing);
  const approach = new THREE.Mesh(new THREE.RingGeometry(0.93, 1, 64), ringMat());
  approach.rotation.x = -Math.PI / 2;
  approach.visible = false;
  scene.add(approach);
  // Donde va a caer tu bola: aparece al pegar y se va cuando bota
  const aimMark = new THREE.Mesh(ringGeo, ringMat());
  aimMark.rotation.x = -Math.PI / 2;
  aimMark.material.opacity = 0.85;
  aimMark.visible = false;
  scene.add(aimMark);
  // Zona de volea: se ilumina cuando la bola del rival entra en ella
  const volleyZone = new THREE.Mesh(
    new THREE.PlaneGeometry(10, VOLLEY_Z),
    new THREE.MeshBasicMaterial({ color: LIME, transparent: true, opacity: 0.05, depthWrite: false, blending: THREE.AdditiveBlending })
  );
  volleyZone.rotation.x = -Math.PI / 2;
  volleyZone.position.set(0, 0.02, VOLLEY_Z / 2);
  volleyZone.visible = false;
  scene.add(volleyZone);
  // Borde del fondo de la zona: hasta ahí se puede volear
  const zoneEdge = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 0.09),
    new THREE.MeshBasicMaterial({ color: LIME, transparent: true, opacity: 0.4, depthWrite: false })
  );
  zoneEdge.position.set(0, -VOLLEY_Z / 2, 0.002);
  volleyZone.add(zoneEdge);
  // Mira tenue que sigue al cursor en la cancha rival (solo con mouse)
  const aimPreview = new THREE.Mesh(ringGeo, ringMat());
  aimPreview.rotation.x = -Math.PI / 2;
  aimPreview.material.opacity = 0.32;
  aimPreview.scale.setScalar(0.5);
  aimPreview.visible = false;
  scene.add(aimPreview);
  let mouseAim = null;

  // Bits objetivo en la cancha rival: si tu bola cae cerca, vale doble
  const targets = [0, 1].map(() => {
    const g = new THREE.Group();
    const cube = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.5, 0.5),
      new THREE.MeshStandardMaterial({ color: LIME, emissive: LIME, emissiveIntensity: 0.7, roughness: 0.4 })
    );
    cube.position.y = 0.55;
    g.add(cube);
    const pad = new THREE.Mesh(ringGeo, ringMat());
    pad.rotation.x = -Math.PI / 2;
    pad.position.y = 0.03;
    pad.scale.setScalar(1.1);
    pad.material.opacity = 0.55;
    g.add(pad);
    g.visible = false;
    g.userData = { cube, s: 0, goal: 0, phase: rand(0, TAU) };
    scene.add(g);
    return g;
  });
  function placeTarget(tg) {
    for (let k = 0; k < 20; k++) {
      const x = rand(-3.6, 3.6), z = rand(-8.4, -2.4);
      const other = targets.find((o) => o !== tg && o.visible);
      if (!other || Math.hypot(other.position.x - x, other.position.z - z) > 2.8) {
        tg.position.set(x, 0, z);
        break;
      }
    }
    tg.visible = true;
    tg.userData.s = 0;
    tg.userData.goal = 1;
  }

  const proj = V();
  function toScreen(p) {
    proj.copy(p).project(camera);
    return { x: (proj.x * 0.5 + 0.5) * host.clientWidth, y: (-proj.y * 0.5 + 0.5) * host.clientHeight };
  }
  function float(text, p, tone) {
    if (!ui.onFloat) return;
    const s = toScreen(p);
    ui.onFloat(text, s.x, s.y, tone);
  }
  function emit() {
    if (ui.onGame) ui.onGame({ score: game.score, best: game.best, mult: game.mult, timeLeft: game.timeLeft, phase: game.phase });
  }
  function buzz(ms) {
    if (navigator.vibrate) {
      try { navigator.vibrate(ms); } catch (e) { /* sin vibración */ }
    }
  }

  function cpuShot(from) {
    const n = game.n;
    const tuto = game.tutorial;
    const T = tuto ? 1.35 : game.first ? 1.4 : Math.max(0.72, 1.15 - n * 0.03);
    const spread = tuto ? 1.6 : Math.min(4.1, 2.4 + n * 0.12);
    const B = V(rand(-spread, spread), 0, tuto === 2 ? rand(6.2, 7) : rand(3.4, 7.2));
    const segs = [overNet(from, B, T, { type: 'gBounce' })];
    const useGlass = !tuto && !game.first && Math.random() < Math.min(0.5, 0.2 + n * 0.025);
    const post = tuto ? 0.7 : Math.max(0.44, 0.7 - n * 0.012);
    let H, postT;
    if (useGlass) {
      const W = V(cx(B.x + rand(-1, 1)), rand(0.9, 1.4), 9.85);
      segs.push(arc(B, W, post * 0.75, { type: 'gGlass' }));
      H = V(cx(W.x + rand(-1, 1)), rand(0.95, 1.15), rand(7.6, 8.3));
      segs.push(arc(W, H, post * 0.8, { type: 'gPass' }));
      postT = post * 1.55;
    } else {
      H = V(cx(B.x + rand(-1.2, 1.2)), rand(0.95, 1.15), rand(8.2, 8.9));
      segs.push(arc(B, H, post, { type: 'gPass' }));
      postT = post;
    }
    // Si nadie le pega, la bola sigue de largo
    const D = V(cx(H.x + (H.x - B.x) * 0.3), 0, Math.min(9.6, H.z + 0.9));
    segs.push(arc(H, D, 0.32, { type: 'gMiss' }));
    Object.assign(game, { segs, cur: null, glass: useGlass, H, B, postT, toH: Infinity, win: false, inFlight: true, first: false, cued: false });
    bounceMark.position.set(B.x, 0.03, B.z);
    bounceMark.visible = true;
  }

  function cpuServe() {
    ball.position.set(rand(-3, 3), 1.0, -8.9);
    history.length = 0;
    ballScale = 0;
    cpuShot(ball.position.clone());
  }

  function over(reason) {
    game.phase = 'over';
    game.endReason = reason;
    game.segs = [];
    game.cur = null;
    game.win = game.inFlight = false;
    hitRing.visible = approach.visible = bounceMark.visible = aimMark.visible = false;
    volleyZone.visible = false;
    const record = game.score > game.best;
    if (record) {
      game.best = game.score;
      try { localStorage.setItem(BEST_KEY, String(game.best)); } catch (e) { /* modo privado */ }
    }
    targets.forEach((tg) => { tg.userData.goal = 0; });
    emit();
    const count = (fn) => game.events.filter(fn).length;
    const stats = {
      score: game.score,
      returns: game.events.length,
      perfects: count((e) => (e & 3) === SHOT.PERFECT),
      volleys: count((e) => (e & 3) === SHOT.VOLLEY),
      glass: count((e) => (e & 4) !== 0),
      bits: count((e) => (e & 8) !== 0),
      events: game.events.slice(),
      durationMs: Math.round(game.playTime * 1000),
    };
    if (ui.onGameOver) ui.onGameOver({ score: game.score, best: game.best, record, reason, maxMult: game.maxMult, stats });
  }

  // Una sola vida: se te fue la bola o le pegaste al aire. En la práctica no
  // acaba: explica qué pasó y el rival vuelve a sacar.
  function miss(label, hint) {
    float(label, ball.position, 'miss');
    if (!game.tutorial) {
      buzz(80);
      over('miss');
      return;
    }
    buzz(30);
    game.segs = [];
    game.cur = null;
    game.win = game.inFlight = false;
    hitRing.visible = approach.visible = bounceMark.visible = aimMark.visible = false;
    game.phase = 'wait';
    game.wait = 1.3;
    coach(game.tutorial, hint);
  }

  // Toque a destiempo: no pierdes, pero la raqueta se frena un instante
  function tooEarly(now) {
    game.stunUntil = now + STUN_S * 1000;
    buzz(20);
    if (now - (game.tipAt || 0) > 700) {
      game.tipAt = now;
      float(game.inFlight ? '¡Espera!' : 'Espera la bola del rival', ball.position, 'tip');
    }
    if (!game.tutorial || !game.inFlight) return;
    const z = ball.position.z;
    coach(game.tutorial, game.tutorial === 1
      ? 'Muy pronto. Espera a que bote y entonces toca.'
      : z <= 0.2
        ? 'Muy pronto. Espera a que la bola entre a la zona lima.'
        : 'Tarde para volear. Tócala mientras cruza la zona lima.');
  }

  function coach(step, hint) {
    volleyZone.visible = step !== 1;
    if (ui.onCoach) ui.onCoach({ step, hint: hint || '' });
  }

  // Puntería: si tocas la cancha del rival, la bola va a ese punto exacto. Si tocas en
  // cualquier otro lado (la bola, el aro, tu cancha), el lado de la pantalla decide la
  // dirección: izquierda, centro o derecha; la profundidad la da el golpe.
  function aimFrom(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    const u = ((clientX - r.left) / r.width) * 2 - 1;
    const ndc = new THREE.Vector2(u, -((clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.ray.intersectPlane(ground, V());
    if (hit && hit.z < -0.8 && Math.abs(hit.x) < 5.6) {
      return { x: clamp(hit.x, -4.4, 4.4), z: clamp(hit.z, -9.2, -1.6), exact: true };
    }
    return { x: clamp(u * 1.35, -1, 1) * 4.2, z: null, exact: false };
  }

  function swing(aimRaw) {
    if (game.phase !== 'play') return;
    const now = performance.now();

    // Raqueta frenada por un toque a destiempo: cada toque extra alarga el freno,
    // así que tocar sin parar no sirve (la bola se pasa y pierdes)
    if (now < game.stunUntil) {
      game.stunUntil = now + STUN_S * 1000;
      return;
    }

    let type = null;
    if (game.inFlight && game.win) {
      // Ya botó: cualquier toque la devuelve; justo cuando el aro se cierra es perfecto
      if (game.tutorial === 2) { miss('Ya botó', 'Esta vez pégale antes de que bote, cuando cruce la zona lima.'); return; }
      type = Math.abs(game.toH) <= PERFECT_S ? SHOT.PERFECT : SHOT.NORMAL;
    } else if (game.inFlight && game.tutorial !== 1 && ball.position.z > 0.2 && ball.position.z < VOLLEY_Z) {
      // De aire: solo dentro de la zona junto a la red
      type = SHOT.VOLLEY;
    }
    if (type === null) { tooEarly(now); return; }

    if (game.tutorial) {
      // Práctica: no suma puntos, solo avanza
      float(type === SHOT.VOLLEY ? '¡De aire!' : '¡Eso!', ball.position, 'perfect');
      ring(ball.position.clone(), null, 0.45);
      buzz(22);
      game.tutorial = game.tutorial === 1 ? 2 : 3;
      if (game.tutorial === 2) coach(2);
    } else {
      addPoints(type);
    }

    game.win = false;
    game.inFlight = false;
    hitRing.visible = approach.visible = bounceMark.visible = false;
    returnShot(type, aimRaw);
  }

  function addPoints(type) {
    // Racha y multiplicador: perfectos y voleas suben la racha; un golpe normal la corta
    game.combo = type === SHOT.NORMAL ? 0 : game.combo + 1;
    const prevMult = game.mult;
    game.mult = Math.min(MAX_MULT, 1 + Math.floor(game.combo / 3));
    game.maxMult = Math.max(game.maxMult, game.mult);
    const glass = type !== SHOT.VOLLEY && game.glass ? 1 : 0;
    const pts = (BASE[type] + glass) * game.mult;
    game.score += pts;
    game.n++;
    game.events.push(type | (glass << 2));
    game.lastShot = { idx: game.events.length - 1, mult: game.mult, volley: type === SHOT.VOLLEY };

    const name = type === SHOT.VOLLEY ? '¡De aire!' : type === SHOT.PERFECT ? '¡Perfecto!' : 'Bien';
    float(`${name}${glass ? ' + vidrio' : ''} +${pts}`, ball.position, type === SHOT.NORMAL ? 'ok' : 'perfect');
    if (game.mult > prevMult) setTimeout(() => float(`¡x${game.mult}!`, V(0, 2.2, 3), 'perfect'), 260);
    ring(ball.position.clone(), null, 0.45);
    buzz(type === SHOT.NORMAL ? 12 : 22);
  }

  function returnShot(type, aimRaw) {
    // A dónde va: el punto exacto si tocaste la cancha rival; si no, la dirección del
    // toque y una profundidad según el golpe (perfecto y volea van al fondo)
    const deep = type !== SHOT.NORMAL;
    const aim = aimRaw.exact
      ? V(aimRaw.x, 0, aimRaw.z)
      : V(clamp(aimRaw.x + rand(-0.35, 0.35), -4.4, 4.4), 0, deep ? -rand(7.2, 8.6) : -rand(4.2, 6.2));
    aimMark.position.set(aim.x, 0.035, aim.z);
    aimMark.scale.setScalar(0.55);
    aimMark.visible = true;

    // Tu devolución y la respuesta del rival (a veces por la pared lima)
    const from = ball.position.clone();
    if (from.y < 0.5) from.y = 0.6;
    const T = type === SHOT.NORMAL ? 1.02 : 0.84;
    const segs = [overNet(from, aim, T, { type: 'rBounce' })];
    if (Math.random() < 0.35) {
      const W = V(cx(aim.x + rand(-1, 1)), rand(1, 1.6), -9.85);
      segs.push(arc(aim, W, 0.5, { type: 'cGlass' }));
      const C = V(cx(W.x + rand(-1, 1)), 1.0, rand(-8.3, -7.6));
      segs.push(arc(W, C, 0.45, { type: 'cHit' }));
    } else {
      const C = V(cx(aim.x + rand(-1.2, 1.2)), 1.0, rand(-8.9, -8.2));
      segs.push(arc(aim, C, 0.55, { type: 'cHit' }));
    }
    game.segs = segs;
    game.cur = null;
    emit();
  }

  function onGameEvent(ev, p) {
    switch (ev.type) {
      case 'gBounce':
        ring(V(p.x, 0.03, p.z), 'y', 0.7);
        bounceMark.visible = false;
        game.win = true;
        game.toH = game.postT;
        hitRing.position.set(game.H.x, 0.035, game.H.z);
        approach.position.set(game.H.x, 0.04, game.H.z);
        // En la práctica de volea el aro distraería: ahí se pega antes del bote
        hitRing.visible = approach.visible = game.tutorial !== 2;
        break;
      case 'gGlass':
      case 'cGlass':
        ring(p.clone(), 'z', 0.75);
        flashGlass(p);
        break;
      case 'gMiss':
        if (game.win) {
          miss('Se fue', game.tutorial === 2
            ? 'Se fue. Pégale antes del bote, mientras cruza la zona lima.'
            : 'Se fue. Cuando bote, toca antes de que pase.');
          return false;
        }
        break;
      case 'rBounce':
        aimMark.visible = false;
        ring(V(p.x, 0.03, p.z), 'y', 0.8);
        for (const tg of game.tutorial ? [] : targets) {
          if (tg.visible && tg.userData.goal && Math.hypot(tg.position.x - p.x, tg.position.z - p.z) < 1.35) {
            const shot = game.lastShot;
            const bitPts = (shot && shot.volley ? 5 : 2) * (shot ? shot.mult : 1);
            game.score += bitPts;
            if (shot) game.events[shot.idx] |= 8;
            float(`¡Bit${shot && shot.volley ? ' de aire' : ''}! +${bitPts}`, V(tg.position.x, 1, tg.position.z), 'perfect');
            burst(V(tg.position.x, 0.6, tg.position.z), 16);
            tg.userData.goal = 0;
            setTimeout(() => { if (game.phase === 'play') placeTarget(tg); }, 700);
            emit();
            break; // un bit por bola: el servidor cuenta uno por golpe
          }
        }
        break;
      case 'cHit':
        if (game.tutorial === 3) {
          // Práctica completa: la bola llega al rival y esperamos a "Empezar"
          game.phase = 'coach';
          game.segs = [];
          game.cur = null;
          coach(3);
          return false;
        }
        cpuShot(p.clone());
        break;
      default:
    }
    return true;
  }

  function stepGame(dt) {
    if (game.phase === 'ready' || game.phase === 'wait') {
      ballScale = Math.max(0, ballScale - dt * 5);
      game.wait -= dt;
      if (game.wait <= 0) {
        game.phase = 'play';
        cpuServe();
        emit();
      }
      return;
    }
    if (game.phase === 'over' || game.phase === 'coach') {
      ballScale = Math.max(0, ballScale - dt * 4);
      return;
    }
    if (game.phase !== 'play') return;
    ballScale = Math.min(1, ballScale + dt * 6);

    // Reloj de la partida (tiempo de juego: se detiene si la pestaña se oculta)
    if (!game.tutorial) {
      const shown = Math.ceil(game.timeLeft);
      game.playTime += dt;
      game.timeLeft = Math.max(0, ROUND_S - game.playTime);
      if (game.timeLeft <= 0) { float('¡Tiempo!', V(0, 2.4, 2), 'perfect'); over('time'); return; }
      if (Math.ceil(game.timeLeft) !== shown) emit();
    }

    // La zona de volea se enciende mientras la bola del rival pasa por ella
    const inZone = game.inFlight && !game.win && ball.position.z > 0.2 && ball.position.z < VOLLEY_Z;
    const zoneGoal = inZone ? 0.3 : game.tutorial === 2 ? 0.17 + Math.sin(performance.now() / 260) * 0.06 : 0.08;
    volleyZone.material.opacity += (zoneGoal - volleyZone.material.opacity) * (1 - Math.exp(-dt * 14));
    zoneEdge.material.opacity = Math.min(0.9, 0.25 + volleyZone.material.opacity * 2.2);

    // Práctica: cámara lenta en el momento de pegar y un "¡Ahora!" justo a tiempo
    if (game.tutorial === 1) dt *= game.win ? 0.5 : 0.75;
    else if (game.tutorial === 2) dt *= inZone ? 0.3 : 0.75;
    if (game.tutorial && game.tutorial < 3 && !game.cued &&
        ((game.tutorial === 1 && game.win && game.toH <= PERFECT_S + 0.05) || (game.tutorial === 2 && inZone && ball.position.z > 0.6))) {
      game.cued = true;
      float('¡Ahora!', ball.position, 'perfect');
      buzz(15);
    }

    if (game.win) {
      game.toH -= dt;
      // Aro que se cierra: cuando toca el aro fijo es el momento perfecto
      const k = clamp(game.toH / game.postT, 0, 1);
      approach.scale.setScalar(0.75 * (1 + k * 1.9));
      approach.material.opacity = 0.35 + 0.6 * (1 - k);
      hitRing.material.opacity = Math.abs(game.toH) <= PERFECT_S ? 1 : 0.55;
      hitRing.scale.setScalar(0.75);
    }
    // Raqueta frenada: los aros se apagan mientras dura
    if (performance.now() < game.stunUntil) {
      approach.material.opacity *= 0.3;
      hitRing.material.opacity *= 0.3;
    }
    if (bounceMark.visible) {
      bounceMark.scale.setScalar(0.45 + Math.sin(performance.now() / 120) * 0.05);
      markMat.opacity = 0.55;
    }
    aimPreview.visible = !!mouseAim && !aimMark.visible;
    if (aimPreview.visible) aimPreview.position.set(mouseAim.x, 0.03, mouseAim.exact ? mouseAim.z : -6);
    runSegs(game, dt, onGameEvent);
  }

  function startGame(opts) {
    if (reduce) return;
    const tutorial = !!(opts && opts.tutorial);
    mode = 'game';
    Object.assign(game, {
      phase: 'ready', score: 0, n: 0, wait: 1.3, first: true, segs: [], cur: null, win: false, inFlight: false,
      timeLeft: ROUND_S, playTime: 0, combo: 0, mult: 1, maxMult: 1, endReason: '', events: [], lastShot: null,
      tutorial: tutorial ? 1 : 0, cued: false, stunUntil: 0,
    });
    volleyZone.material.opacity = 0.08;
    coach(game.tutorial);
    rally.segs = [];
    rally.cur = null;
    gameAz = Math.round(orbit / TAU) * TAU;
    targets.forEach((tg) => { tg.visible = false; tg.userData.goal = 0; });
    if (!tutorial) targets.forEach((tg) => placeTarget(tg));
    hitRing.visible = approach.visible = bounceMark.visible = aimMark.visible = false;
    canvas.classList.add('is-game');
    dragVel = 0;
    emit();
    kick();
  }

  function exitGame() {
    mode = 'show';
    game.phase = 'off';
    game.tutorial = 0;
    game.segs = [];
    game.cur = null;
    targets.forEach((tg) => { tg.userData.goal = 0; });
    hitRing.visible = approach.visible = bounceMark.visible = aimMark.visible = aimPreview.visible = false;
    volleyZone.visible = false;
    canvas.classList.remove('is-game');
    rally.segs = [];
    rally.cur = null;
    rally.wait = 0.8;
    lastInput = performance.now();
    emit();
  }

  // ---------- Cámara (encuadre) ----------
  const fitShow = [];
  const fitCore = [];
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      fitShow.push(V(sx * PX, -0.5, sz * PZ), V(sx * 5, 4, sz * 10), V(sx * 5.5, 6.4, sz * 10.5));
      fitCore.push(V(sx * PX, -0.5, sz * PZ), V(sx * 5, 4, sz * 10));
    }
  }
  const fitTable = [];
  let fitGame = 40;
  const probe = new THREE.PerspectiveCamera();
  const tmp = V();
  function camPos(out, az, el, dist, tgt) {
    return out.set(
      tgt.x + Math.cos(el) * Math.sin(az) * dist,
      tgt.y + Math.sin(el) * dist,
      tgt.z + Math.cos(el) * Math.cos(az) * dist
    );
  }
  function fitFor(az, el, tgt, pts, mx, my) {
    let lo = 6, hi = 160;
    for (let k = 0; k < 16; k++) {
      const mid = (lo + hi) / 2;
      camPos(probe.position, az, el, mid, tgt);
      probe.lookAt(tgt);
      probe.updateMatrixWorld();
      let ok = true;
      for (const p of pts) {
        tmp.copy(p).project(probe);
        if (Math.abs(tmp.x) > mx || Math.abs(tmp.y) > my) { ok = false; break; }
      }
      if (ok) hi = mid; else lo = mid;
    }
    return hi;
  }
  function buildFit() {
    probe.fov = camera.fov;
    probe.aspect = camera.aspect;
    probe.near = 0.5;
    probe.far = 300;
    probe.updateProjectionMatrix();
    fitTable.length = 0;
    for (let i = 0; i < 36; i++) fitTable.push(fitFor((i / 36) * TAU, EL_REST, TARGET_SHOW, fitShow, 0.93, 0.9));
    fitGame = fitFor(0, EL_GAME, TARGET_GAME, fitCore, 0.96, 0.94);
  }
  function fitDist(az) {
    const n = fitTable.length;
    if (!n) return 40;
    const f = ((((az / TAU) % 1) + 1) % 1) * n;
    const i = Math.floor(f) % n;
    const k = f - Math.floor(f);
    return fitTable[i] * (1 - k) + fitTable[(i + 1) % n] * k;
  }

  // ---------- Interacción ----------
  function interacted() {
    lastInput = performance.now();
    if (ui.onInteract) ui.onInteract();
  }

  canvas.addEventListener('pointerdown', (e) => {
    lastPointer = { x: e.clientX, y: e.clientY };
    if (mode === 'game') {
      // En juego se pega al tocar, sin esperar a soltar: el tiempo importa
      swing(aimFrom(e.clientX, e.clientY));
      return;
    }
    down = { x: e.clientX, y: e.clientY, lx: e.clientX, t: performance.now(), lt: performance.now(), moved: false };
    dragVel = 0;
    interacted();
  });
  canvas.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    lastPointer = { x: e.clientX, y: e.clientY };
    if (e.pointerType === 'mouse') {
      hover.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      hover.y = ((e.clientY - r.top) / r.height) * 2 - 1;
      if (mode === 'game') mouseAim = aimFrom(e.clientX, e.clientY);
    }
    if (!down || mode === 'game') return;
    const dx = e.clientX - down.lx;
    if (!down.moved && Math.abs(e.clientX - down.x) > 6) {
      down.moved = true;
      if (canvas.setPointerCapture) canvas.setPointerCapture(e.pointerId);
      canvas.classList.add('is-dragging');
    }
    if (down.moved) {
      const now = performance.now();
      const d = -dx * 0.0065;
      orbit += d;
      dragVel = d / Math.max(0.008, (now - down.lt) / 1000);
      down.lt = now;
      dirty = true;
    }
    down.lx = e.clientX;
    interacted();
  });
  const release = (e) => {
    if (!down) return;
    const quick = performance.now() - down.t < 450;
    if (!down.moved && quick && e.type === 'pointerup' && !reduce && mode === 'show') {
      const r = canvas.getBoundingClientRect();
      const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const hit = ray.ray.intersectPlane(ground, V());
      if (hit && Math.abs(hit.x) < 5 && Math.abs(hit.z) < 10) {
        serveTo(V(clamp(hit.x, -4.6, 4.6), 0, clamp(hit.z, -9.6, 9.6)));
      }
    }
    if (performance.now() - down.lt > 90) dragVel = 0;
    dragVel = clamp(dragVel, -6, 6);
    canvas.classList.remove('is-dragging');
    down = null;
    interacted();
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('pointerleave', (e) => {
    if (e.pointerType === 'mouse') { hover.x = 0; hover.y = 0; mouseAim = null; }
  });

  // ---------- Tamaño ----------
  let lastSize = '';
  function resize(force) {
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return;
    // El observador avisa también al registrarse: si el tamaño no cambió, no recalcular
    const key = w + 'x' + h + '@' + dpr;
    if (key === lastSize && force !== true) return;
    lastSize = key;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w / h < 0.9 ? 34 : 30;
    camera.updateProjectionMatrix();
    buildFit();
    dirty = true;
  }
  const ro = new ResizeObserver(() => resize());
  ro.observe(host);

  // ---------- Capa digital (etiqueta AR) ----------
  const ANCHORS = { score: V(0, 0.95, 0), booking: V(2.5, 0.03, 4.6), class: V(-2.5, 0.03, -4.6) };
  const anchorNow = ANCHORS.score.clone();
  let anchorGoal = ANCHORS.score;
  function placeAR() {
    if (!ui.ar || mode === 'game') return;
    const s = toScreen(anchorNow);
    ui.ar(s.x, s.y, host.clientWidth, host.clientHeight);
  }
  ui.setAnchor = (key) => { anchorGoal = ANCHORS[key] || ANCHORS.score; };

  // ---------- Bucle ----------
  let t = reduce ? INTRO_END + 1 : 0;
  let frames = 0, slow = 0, shadowsDone = false;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e3 = new THREE.Euler(), sc = V(), pos = V();
  const tileColor = new THREE.Color();

  function applyIntro(t) {
    const show = (o, v) => { o.visible = v > 0.001; };
    const pf = outCubic(seg(t, 0.05, 0.6));
    platform.scale.y = Math.max(0.001, pf);
    show(platform, pf);
    contact.material.opacity = 0.75 * pf;
    floorMat.opacity = 0.16 * seg(t, 0, 0.8);
    const ledP = inOut(seg(t, 0.25, 1.35)) * 4;
    leds.forEach((m, i) => { const s = clamp(ledP - i, 0, 1); m.scale.x = Math.max(0.001, s); show(m, s); });
    ledGlow.material.opacity = 0.55 * seg(t, 0.6, 1.5);

    // Bits que caen y se aplanan en pasto
    const tilesOn = t < 2.0;
    tileMesh.visible = tilesOn;
    if (tilesOn) {
      const vanish = seg(t, 1.55, 1.95);
      tiles.forEach((b, i) => {
        const f = seg(t, b.delay, b.delay + 0.55);
        const flat = outCubic(seg(t, b.delay + 0.55, b.delay + 0.8));
        const yFall = b.sy + (0.47 - b.sy) * inQuad(f);
        const sy = (1 - flat * 0.95) * (1 - vanish);
        const sxz = (f > 0 ? 1 : 0) * (1 - vanish * 0.9);
        pos.set(b.x + b.sx * (1 - f), f < 1 ? yFall : 0.47 * sy + 0.01, b.z + b.sz * (1 - f));
        e3.set(b.rx * (1 - f), b.ry * (1 - f), 0);
        q.setFromEuler(e3);
        sc.set(sxz, Math.max(0.001, f < 1 ? 1 : sy), sxz);
        m4.compose(pos, q, sc);
        tileMesh.setMatrixAt(i, m4);
        tileColor.copy(b.color).lerp(turfColor, flat);
        tileMesh.setColorAt(i, tileColor);
      });
      tileMesh.instanceMatrix.needsUpdate = true;
      tileMesh.instanceColor.needsUpdate = true;
    }

    const tf = seg(t, 1.3, 1.8);
    turfMat.opacity = tf;
    show(turf, tf);

    lines.forEach((m, i) => {
      const s = inOut(seg(t, 1.65 + i * 0.08, 2.2 + i * 0.08));
      m.scale.set(m.userData.axis === 'x' ? Math.max(0.001, s) : 1, 1, m.userData.axis === 'z' ? Math.max(0.001, s) : 1);
      show(m, s);
    });

    wallGroups.forEach(({ g, at }) => {
      const s = outBack(seg(t, at, at + 0.6));
      g.scale.y = Math.max(0.001, s);
      show(g, s);
    });

    const n = outBack(seg(t, 2.35, 2.75));
    net.scale.y = Math.max(0.001, n);
    show(net, n);

    const pp = outCubic(seg(t, 2.2, 2.75));
    poles.forEach((g) => { g.scale.y = Math.max(0.001, pp); show(g, pp); });
    const lamp = smooth(seg(t, 2.7, 3.25));
    lampFaceMat.color.setRGB(0.25 + 0.75 * lamp, 0.25 + 0.72 * lamp, 0.22 + 0.64 * lamp);
    glareMat.opacity = 0.85 * lamp;
    coneMat.opacity = 0.07 * lamp;
  }

  let shadowStep = 0;
  function update(dt, now) {
    if (t < INTRO_END + 0.5) {
      applyIntro(t);
      // Las sombras aparecen con las luces: se calculan dos veces, no en cada cuadro
      if (shadowStep === 0 && t > 2.9) { renderer.shadowMap.needsUpdate = true; shadowStep = 1; }
    } else if (!shadowsDone) {
      applyIntro(INTRO_END + 1);
      renderer.shadowMap.needsUpdate = true;
      shadowsDone = true;
    }

    // Cámara: entrada, giro automático, arrastre con inercia, paralaje y vista de juego
    const e = outCubic(seg(t, 0, INTRO_END));
    const introAz = -1.5 * (1 - e);
    const introEl = 0.5 * (1 - e);
    const introD = 1 + 0.5 * (1 - e);
    const idle = now - lastInput > 2600;
    const spinGoal = reduce || t < INTRO_END || mode === 'game' ? 0 : idle ? 0.1 : 0;
    spin += (spinGoal - spin) * (1 - Math.exp(-dt * 1.1));
    if (!down) {
      orbit += dragVel * dt;
      dragVel *= Math.exp(-dt * 3.2);
      if (Math.abs(dragVel) < 0.002) dragVel = 0; else dirty = true;
    }
    orbit += spin * dt;
    hoverS.x += (hover.x - hoverS.x) * (1 - Math.exp(-dt * 3));
    hoverS.y += (hover.y - hoverS.y) * (1 - Math.exp(-dt * 3));
    const breathe = reduce ? 0 : Math.sin((now / 1000) * 0.35) * 0.025;
    const azS = orbit + introAz + hoverS.x * 0.07;
    const elS = EL_REST + introEl + breathe + hoverS.y * 0.03;
    const goal = fitDist(azS);
    distSmooth = distSmooth ? distSmooth + (goal - distSmooth) * (1 - Math.exp(-dt * 2.5)) : goal;
    const dS = distSmooth * introD;

    const blendGoal = mode === 'game' ? 1 : 0;
    camBlend += (blendGoal - camBlend) * (1 - Math.exp(-dt * 3.4));
    if (Math.abs(camBlend - blendGoal) > 0.001) dirty = true;
    const b = smooth(clamp(camBlend, 0, 1));
    const az = azS + (gameAz + hoverS.x * 0.02 - azS) * b;
    const el = elS + (EL_GAME - elS) * b;
    const dist = dS + (fitGame - dS) * b;
    target.lerpVectors(TARGET_SHOW, TARGET_GAME, b);
    camPos(camera.position, az, el, dist, target);
    camera.lookAt(target);

    // El poste cercano estorba la vista de juego: se esconde
    if (t > INTRO_END) {
      poles.forEach((g) => {
        const goalS = mode === 'game' && g.userData.near ? 0 : 1;
        g.userData.s += (goalS - g.userData.s) * (1 - Math.exp(-dt * 6));
        g.scale.y = Math.max(0.001, g.userData.s);
        g.visible = g.userData.s > 0.01;
      });
    }

    // Bola
    if (!reduce && t > INTRO_END - 0.2) {
      if (mode === 'game') stepGame(dt); else stepRally(dt);
      if (mode !== 'game' || game.phase !== 'play') aimPreview.visible = false;
      ball.visible = ballScale > 0.01;
      ball.scale.setScalar(Math.max(0.001, ballScale));
      blob.visible = ball.visible;
      blob.position.set(ball.position.x, 0.016, ball.position.z);
      const hgt = clamp(ball.position.y / 4, 0, 1);
      blob.scale.setScalar((0.6 + hgt * 0.9) * ballScale);
      blob.material.opacity = (1 - hgt * 0.75) * ballScale;
      history.unshift(ball.position.clone());
      if (history.length > TRAIL * 2 + 2) history.length = TRAIL * 2 + 2;
      for (let i = 0; i < TRAIL; i++) {
        const h = history[(i + 1) * 2];
        if (h && ball.visible) {
          const s = (1 - (i + 1) / (TRAIL + 1)) * 0.9 * ballScale;
          m4.compose(h, q.identity(), sc.set(s, s, s));
        } else m4.copy(hidden);
        trail.setMatrixAt(i, m4);
      }
      trail.instanceMatrix.needsUpdate = true;
    }

    // Bits objetivo
    for (const tg of targets) {
      if (!tg.visible) continue;
      const u = tg.userData;
      u.s += (u.goal - u.s) * (1 - Math.exp(-dt * 8));
      u.phase += dt * 2.2;
      u.cube.position.y = 0.55 + Math.sin(u.phase) * 0.12;
      u.cube.rotation.set(u.phase * 0.6, u.phase, 0);
      tg.scale.setScalar(Math.max(0.001, u.s));
      if (u.goal === 0 && u.s < 0.02) tg.visible = false;
    }

    // Ondas
    for (const r of rings) {
      if (!r.visible) continue;
      r.userData.life += dt / 0.65;
      const l = r.userData.life;
      if (l >= 1) { r.visible = false; continue; }
      const s = (0.25 + outCubic(l) * 1.25) * r.userData.size;
      r.scale.set(s, s, s);
      r.material.opacity = (r.userData.k || 0.9) * (1 - l);
    }

    // Destello en vidrio
    for (const g of glass) {
      if (g.flash <= 0) continue;
      g.flash = Math.max(0, g.flash - dt * 1.5);
      g.mat.emissiveIntensity = g.flash * 0.85;
      g.mat.opacity = 0.22 + g.flash * 0.2;
    }

    // Bits flotantes desde la pared lima y explosiones
    if (!reduce && t > INTRO_END && Math.random() < dt * 3.2) {
      spawnBit(V(rand(-4.8, 4.8), rand(3.4, 4.3), -10 + rand(-0.15, 0.15)), V(rand(-0.12, 0.12), rand(0.35, 0.65), rand(-0.12, 0.04)), rand(2.8, 4.2), rand(0.14, 0.26), 0);
    }
    let any = false;
    bits.forEach((bt, i) => {
      if (!bt.on) return;
      any = true;
      bt.life += dt;
      if (bt.life >= bt.max) { bt.on = false; bitMesh.setMatrixAt(i, hidden); return; }
      bt.v.y -= bt.grav * dt;
      bt.p.addScaledVector(bt.v, dt);
      if (bt.grav && bt.p.y < 0.12) { bt.p.y = 0.12; bt.v.y *= -0.35; bt.v.x *= 0.7; bt.v.z *= 0.7; }
      bt.rot.x += bt.spin.x * dt;
      bt.rot.y += bt.spin.y * dt;
      const k = bt.life / bt.max;
      const s = bt.size * Math.min(1, bt.life / 0.2) * (k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1);
      e3.set(bt.rot.x, bt.rot.y, 0);
      m4.compose(bt.p, q.setFromEuler(e3), sc.set(s, s, s));
      bitMesh.setMatrixAt(i, m4);
    });
    if (any) bitMesh.instanceMatrix.needsUpdate = true;

    anchorNow.lerp(anchorGoal, 1 - Math.exp(-dt * 4));
  }

  function frame(now) {
    raf = 0;
    if (!visible) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!reduce && now > holdUntil) t += t < INTRO_END ? dt * 1.3 : dt;
    const live = !reduce || dirty || dragVel !== 0;
    if (live) {
      update(dt, now);
      renderer.render(scene, camera);
      placeAR();
      dirty = false;
    }
    if (ui.onTime) ui.onTime(t);

    // Calidad adaptativa: si el teléfono no da, bajamos resolución una vez
    if (!reduce && t > INTRO_END + 0.5 && frames < 300) {
      frames++;
      if (dt > 0.024) slow++;
      if (frames % 150 === 0) {
        if (slow > 70 && dpr > 1) {
          dpr = dpr > 1.3 ? 1.25 : 1;
          renderer.setPixelRatio(dpr);
          resize();
        }
        slow = 0;
      }
    }
    if (!reduce || down || dragVel !== 0 || dirty) raf = requestAnimationFrame(frame);
  }

  function kick() {
    if (!raf && visible && ready) { last = performance.now(); raf = requestAnimationFrame(frame); }
  }
  canvas.addEventListener('pointerdown', kick);
  canvas.addEventListener('pointermove', () => { if (down) kick(); });

  const io = new IntersectionObserver(([en]) => {
    visible = en.isIntersecting;
    if (visible) { dirty = true; kick(); }
  });
  io.observe(host);

  // Precalentar: compilar todos los materiales (y el pase de sombras) antes de la
  // entrada, con el canvas oculto. Así ningún material se compila a media animación.
  let ready = false, holdUntil = 0;
  async function warm() {
    resize();
    const hiddenObjs = [];
    scene.traverse((o) => { if (!o.visible) { hiddenObjs.push(o); o.visible = true; } });
    camPos(camera.position, AZ_REST, EL_REST, fitDist(AZ_REST), TARGET_SHOW);
    camera.lookAt(TARGET_SHOW);
    try {
      if (renderer.compileAsync) await renderer.compileAsync(scene, camera);
      else renderer.compile(scene, camera);
    } catch (e) { /* si falla, se compila al vuelo */ }
    renderer.shadowMap.needsUpdate = true;
    renderer.render(scene, camera);
    hiddenObjs.forEach((o) => { o.visible = false; });
    applyIntro(reduce ? INTRO_END + 1 : 0);
    renderer.shadowMap.needsUpdate = true;
    renderer.render(scene, camera);
    if (ui.startGate) await Promise.race([ui.startGate, new Promise((r) => setTimeout(r, 2500))]);
    ready = true;
    holdUntil = performance.now() + 180; // el primer cuadro visible absorbe la última carga
    canvas.style.transition = 'opacity 300ms ease';
    canvas.style.opacity = '';
    last = performance.now();
    kick();
  }
  warm();

  return {
    scoreText,
    // startGame({ tutorial: true }) arranca con la práctica guiada (ui.onCoach avisa cada paso)
    startGame,
    exitGame,
    // Teclado: espacio pega hacia donde está el cursor, o al centro de la cancha rival
    swing() {
      swing(lastPointer ? aimFrom(lastPointer.x, lastPointer.y) : { x: rand(-2.5, 2.5), z: null, exact: false });
    },
    best: () => game.best,
  };
}
