/**
 * A short, restrained confetti burst from a point on screen: thin ribbons and
 * fine dots in the app's own palette, a soft ring, then everything drifts and
 * fades. One canvas, removed when it finishes.
 */
const COLORS = ['#8ed1a8', '#a9dfbe', '#e3e4e6', '#c4c6ca', '#9db4e8', '#f4f5f6'];
const DURATION = 2400;
const COUNT = 90;

interface Bit {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  rot: number;
  spin: number;
  flip: number;
  flipSpeed: number;
  color: string;
  dot: boolean;
}

export function confetti(from: DOMRect): void {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const dpr = window.devicePixelRatio || 1;
  const canvas = document.createElement('canvas');
  canvas.className = 'confetti';
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  document.body.appendChild(canvas);
  const g = canvas.getContext('2d');
  if (!g) {
    canvas.remove();
    return;
  }
  g.scale(dpr, dpr);

  const ox = from.left + from.width / 2;
  const oy = from.top + from.height / 2;
  const bits: Bit[] = Array.from({ length: COUNT }, () => {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.95;
    const speed = 380 + Math.random() * 620;
    const dot = Math.random() < 0.3;
    return {
      x: ox + (Math.random() - 0.5) * from.width * 0.6,
      y: oy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      w: dot ? 2.4 + Math.random() * 1.6 : 7 + Math.random() * 6,
      h: dot ? 0 : 2 + Math.random() * 1.4,
      rot: Math.random() * Math.PI,
      spin: (Math.random() - 0.5) * 10,
      flip: Math.random() * Math.PI,
      flipSpeed: 6 + Math.random() * 8,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      dot,
    };
  });

  const start = performance.now();
  let last = start;
  const frame = (t: number) => {
    const dt = Math.min((t - last) / 1000, 0.033);
    last = t;
    const age = t - start;
    g.clearRect(0, 0, window.innerWidth, window.innerHeight);

    const ring = Math.min(age / 650, 1);
    if (ring < 1) {
      const ease = 1 - Math.pow(1 - ring, 3);
      g.globalAlpha = (1 - ring) * 0.55;
      g.strokeStyle = COLORS[0];
      g.lineWidth = 1.5;
      g.beginPath();
      g.ellipse(ox, oy, from.width / 2 + ease * 70, from.height / 2 + ease * 46, 0, 0, Math.PI * 2);
      g.stroke();
    }

    const fade = Math.max(0, Math.min(1, (DURATION - age) / (DURATION * 0.35)));
    for (const b of bits) {
      b.vx *= 1 - 2.2 * dt;
      b.vy = b.vy * (1 - 2.2 * dt) + 900 * dt;
      b.x += (b.vx + Math.sin(b.flip) * 18) * dt;
      b.y += b.vy * dt;
      b.rot += b.spin * dt;
      b.flip += b.flipSpeed * dt;

      g.globalAlpha = fade;
      g.fillStyle = b.color;
      g.save();
      g.translate(b.x, b.y);
      g.rotate(b.rot);
      if (b.dot) {
        g.beginPath();
        g.arc(0, 0, b.w / 2, 0, Math.PI * 2);
        g.fill();
      } else {
        g.scale(1, Math.cos(b.flip));
        g.fillRect(-b.w / 2, -b.h / 2, b.w, b.h);
      }
      g.restore();
    }

    if (age < DURATION) requestAnimationFrame(frame);
    else canvas.remove();
  };
  requestAnimationFrame(frame);
}
