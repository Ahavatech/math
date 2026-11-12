import { Math as Tex } from "@/components/ui/math";

/**
 * Authored mathematical figure: rectangles under a curve, the picture
 * behind the integral. Drawn as inline SVG from a function sampled at
 * render time, so it is crisp at any size and costs no image download.
 * Ink for the curve and axes, the one red for the approximation.
 */
const W = 520;
const H = 380;
const X0 = 56;
const X1 = 488;
const Y0 = 318; // baseline
const YH = 250; // plot height

function f(t: number): number {
  return 0.42 + 0.3 * Math.sin(2.7 * Math.PI * t - 0.55) * (0.55 + 0.45 * t);
}

const px = (t: number) => X0 + t * (X1 - X0);
const py = (v: number) => Y0 - v * YH;

export function RiemannFigure({ className }: { className?: string }) {
  const n = 14;
  const bars = Array.from({ length: n }, (_, i) => {
    const a = i / n;
    const b = (i + 1) / n;
    let min = Infinity;
    for (let k = 0; k <= 8; k++) min = Math.min(min, f(a + ((b - a) * k) / 8));
    return { x: px(a), w: px(b) - px(a), y: py(min), h: Y0 - py(min) };
  });

  const curve = Array.from({ length: 121 }, (_, i) => {
    const t = i / 120;
    return `${i === 0 ? "M" : "L"}${px(t).toFixed(1)} ${py(f(t)).toFixed(1)}`;
  }).join(" ");

  const t0 = 0.66;
  const slope = (f(t0 + 0.001) - f(t0 - 0.001)) / 0.002; // dv/dt
  const cx = px(t0);
  const cy = py(f(t0));
  const dx = 70;
  const dy = -(slope * YH * dx) / (X1 - X0);

  return (
    <figure className={className}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="A curve y equals f of x above the x-axis, with fourteen thin red rectangles under it approximating the area, and a dashed tangent line at one point."
        className="h-auto w-full"
      >
        {/* axes */}
        <g stroke="var(--foreground)" strokeWidth="1.5" fill="none">
          <path d={`M${X0} ${Y0} H${X1 + 14}`} />
          <path d={`M${X0} ${Y0 + 8} V${Y0 - YH - 22}`} />
          <path d={`M${X1 + 8} ${Y0 - 4} L${X1 + 14} ${Y0} L${X1 + 8} ${Y0 + 4}`} />
          <path d={`M${X0 - 4} ${Y0 - YH - 16} L${X0} ${Y0 - YH - 22} L${X0 + 4} ${Y0 - YH - 16}`} />
        </g>

        {/* rectangles: the approximation */}
        <g fill="var(--accent)" fillOpacity="0.1" stroke="var(--accent)" strokeWidth="1">
          {bars.map((bar) => (
            <rect key={bar.x} x={bar.x} y={bar.y} width={bar.w} height={bar.h} />
          ))}
        </g>

        {/* tangent */}
        <path
          d={`M${cx - dx} ${cy - dy} L${cx + dx} ${cy + dy}`}
          stroke="var(--foreground)"
          strokeWidth="1.25"
          strokeDasharray="5 4"
          fill="none"
        />

        {/* curve */}
        <path d={curve} stroke="var(--foreground)" strokeWidth="2.5" fill="none" strokeLinejoin="round" />
        <circle cx={cx} cy={cy} r="4.5" fill="var(--foreground)" />

        {/* ticks and labels */}
        <g stroke="var(--foreground)" strokeWidth="1.5">
          <path d={`M${X0} ${Y0} v8`} />
          <path d={`M${X1} ${Y0} v8`} />
        </g>
        <g fill="var(--foreground)" fontFamily="var(--font-serif)" fontStyle="italic" fontSize="19">
          <text x={X0 - 4} y={Y0 + 30}>a</text>
          <text x={X1 - 4} y={Y0 + 30}>b</text>
          <text x={X1 + 20} y={Y0 + 6}>x</text>
          <text x={X0 + 10} y={Y0 - YH - 14}>y</text>
          <text x={px(0.9)} y={py(f(0.9)) - 14}>f</text>
        </g>
      </svg>
      <figcaption className="mt-3 text-sm text-muted-foreground">
        <span className="block text-foreground">
          <Tex>{"\\int_a^b f(x)\\,dx=\\lim_{n\\to\\infty}\\sum_{i=1}^{n} f(x_i)\\,\\Delta x"}</Tex>
        </span>
        Thin rectangles under a curve: the idea behind the integral.
      </figcaption>
    </figure>
  );
}
