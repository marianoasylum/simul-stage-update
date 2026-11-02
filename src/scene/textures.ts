/**
 * Procedural texture generators using HTML5 Canvas (Zero 404 dependencies)
 */
import * as THREE from 'three';

export function createAsphaltTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;

  // 1. Rich dark asphalt base
  ctx.fillStyle = '#1c1f24';
  ctx.fillRect(0, 0, 1024, 1024);

  // 2. Micro-aggregate stone / mineral noise (fine multi-layer gravel)
  for (let i = 0; i < 90000; i++) {
    const x = Math.random() * 1024;
    const y = Math.random() * 1024;
    const size = Math.random() < 0.85 ? 1.2 : 2.2;
    const lum = Math.floor(Math.random() * 45 + 18);
    const tint = Math.floor(Math.random() * 6 - 3);
    ctx.fillStyle = `rgb(${lum + tint}, ${lum}, ${lum + 4})`;
    ctx.fillRect(x, y, size, size);
  }

  // 3. Subtle asphalt bitumen binder patches & wear
  for (let p = 0; p < 80; p++) {
    const px = Math.random() * 1024;
    const py = Math.random() * 1024;
    const rad = 15 + Math.random() * 45;
    const grad = ctx.createRadialGradient(px, py, 2, px, py, rad);
    const alpha = 0.04 + Math.random() * 0.08;
    grad.addColorStop(0, `rgba(10, 12, 16, ${alpha})`);
    grad.addColorStop(1, 'rgba(10, 12, 16, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(px, py, rad, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(16, 8);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createConcreteFloorTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Urban plaza / sidewalk concrete base
  ctx.fillStyle = '#262a33';
  ctx.fillRect(0, 0, 512, 512);

  // Surface grain noise
  for (let i = 0; i < 25000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const val = Math.floor(Math.random() * 30 + 30);
    ctx.fillStyle = `rgb(${val}, ${val + 2}, ${val + 5})`;
    ctx.fillRect(x, y, 1.5, 1.5);
  }

  // Elegant sidewalk paving tile joints
  ctx.strokeStyle = '#181b22';
  ctx.lineWidth = 2.5;
  const tileSize = 64;
  for (let i = 0; i <= 512; i += tileSize) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 512);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(512, i);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(8, 2);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createStarTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;

  const cx = 32;
  const cy = 32;

  // Soft radiant glow
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 32);
  grad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
  grad.addColorStop(0.18, 'rgba(230, 245, 255, 0.9)');
  grad.addColorStop(0.45, 'rgba(180, 220, 255, 0.35)');
  grad.addColorStop(0.8, 'rgba(100, 160, 255, 0.08)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, 32, 0, Math.PI * 2);
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createMoonTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  const cx = 128;
  const cy = 128;

  // Atmospheric lunar glow
  const aura = ctx.createRadialGradient(cx, cy, 25, cx, cy, 120);
  aura.addColorStop(0, 'rgba(220, 235, 255, 0.45)');
  aura.addColorStop(0.4, 'rgba(160, 200, 255, 0.15)');
  aura.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = aura;
  ctx.fillRect(0, 0, 256, 256);

  // Glowing Moon Disc
  const moonGrad = ctx.createRadialGradient(cx - 8, cy - 8, 5, cx, cy, 50);
  moonGrad.addColorStop(0, '#ffffff');
  moonGrad.addColorStop(0.7, '#e2ecf8');
  moonGrad.addColorStop(0.95, '#b9cbe0');
  moonGrad.addColorStop(1, '#8ea2bc');

  ctx.fillStyle = moonGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, 48, 0, Math.PI * 2);
  ctx.fill();

  // Subtle lunar maria / surface crater shading
  ctx.fillStyle = 'rgba(110, 130, 155, 0.25)';
  const craters = [
    { x: cx - 14, y: cy - 10, r: 16 },
    { x: cx + 18, y: cy + 12, r: 14 },
    { x: cx - 8, y: cy + 22, r: 18 },
    { x: cx + 12, y: cy - 20, r: 12 },
  ];
  craters.forEach((c) => {
    ctx.beginPath();
    ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
    ctx.fill();
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createNeonSignTexture(text: string, subtext = '', color = '#00f0ff'): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  // Background
  ctx.fillStyle = '#0a0d14';
  ctx.fillRect(0, 0, 1024, 256);

  // Glowing border
  ctx.strokeStyle = color;
  ctx.lineWidth = 8;
  ctx.strokeRect(16, 16, 992, 224);

  // Glow effect
  ctx.shadowColor = color;
  ctx.shadowBlur = 24;

  // Text
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 72px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 512, subtext ? 100 : 128);

  if (subtext) {
    ctx.font = '600 36px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = color;
    ctx.fillText(subtext, 512, 175);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createJumbotronTexture(): {
  texture: THREE.CanvasTexture;
  update: (bass: number, vol: number, treble: number) => void;
} {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 288;
  const ctx = canvas.getContext('2d')!;

  let frame = 0;

  const update = (bass: number, vol: number, treble: number) => {
    frame++;
    // Dark background
    ctx.fillStyle = '#07090e';
    ctx.fillRect(0, 0, 512, 288);

    // Audio reactive equalizer visualizer
    const bars = 24;
    const barWidth = 512 / bars;

    for (let i = 0; i < bars; i++) {
      const freqFactor = Math.sin((i / bars) * Math.PI) * 0.8 + 0.2;
      const energy = (i < 8 ? bass : (i < 16 ? vol : treble)) * freqFactor;
      const height = Math.max(12, energy * 230 + Math.sin(frame * 0.15 + i * 0.4) * 20);

      const hue = 180 + (i / bars) * 160 + (frame % 360);
      const gradient = ctx.createLinearGradient(0, 288 - height, 0, 288);
      gradient.addColorStop(0, `hsl(${hue}, 100%, 70%)`);
      gradient.addColorStop(1, `hsl(${hue}, 90%, 30%)`);

      ctx.fillStyle = gradient;
      ctx.fillRect(i * barWidth + 2, 288 - height, barWidth - 4, height);
    }

    // Dynamic banner text
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 12;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('LIVE CONCERT • ARENA STELLAR', 256, 40);

    texture.needsUpdate = true;
  };

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  return { texture, update };
}

export function createArenaFacadeTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Dark charcoal architectural composite panel base
  ctx.fillStyle = '#181e28';
  ctx.fillRect(0, 0, 512, 512);

  // Subtle metallic panel noise / grain
  for (let i = 0; i < 25000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const v = Math.floor(Math.random() * 25 + 20);
    ctx.fillStyle = `rgb(${v}, ${v + 4}, ${v + 10})`;
    ctx.fillRect(x, y, 1.5, 1.5);
  }

  // Architectural horizontal panels
  ctx.strokeStyle = '#0e1218';
  ctx.lineWidth = 4;
  for (let y = 0; y <= 512; y += 64) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(512, y);
    ctx.stroke();

    // Top highlight bevel on panels
    ctx.strokeStyle = '#273142';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, y + 2);
    ctx.lineTo(512, y + 2);
    ctx.stroke();
    ctx.strokeStyle = '#0e1218';
    ctx.lineWidth = 4;
  }

  // Vertical staggered expansion joints
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#0c1016';
  for (let y = 0; y < 512; y += 64) {
    const offset = (y / 64) % 2 === 0 ? 0 : 64;
    for (let x = offset; x <= 512; x += 128) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + 64);
      ctx.stroke();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(6, 6);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
