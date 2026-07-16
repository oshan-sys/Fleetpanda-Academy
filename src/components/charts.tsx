// Server-rendered SVG charts for the reports page. No client JS — native
// <title> tooltips carry the hover detail. Colors: data marks use the two
// validated hues (orange #EA580C, teal #0D9488); "empty" reads as a light
// neutral track; all text uses text tokens, never the data color.

const ORANGE = "#EA580C";
const TEAL = "#0D9488";
const TRACK = "#E7E5E4";
const INK_SECONDARY = "#525252";
const INK_MUTED = "#737373";

/** Rect with rounded right corners (data end) and square left (baseline). */
function roundedRightBar(x: number, y: number, w: number, h: number): string {
  const r = Math.min(4, w, h / 2);
  return `M${x},${y} h${w - r} a${r},${r} 0 0 1 ${r},${r} v${h - 2 * r} a${r},${r} 0 0 1 -${r},${r} h-${w - r} Z`;
}

/** Rect with rounded top corners (data end) and square bottom (baseline). */
function roundedTopBar(x: number, y: number, w: number, h: number): string {
  const r = Math.min(4, h, w / 2);
  return `M${x},${y + h} v-${h - r} a${r},${r} 0 0 1 ${r},-${r} h${w - 2 * r} a${r},${r} 0 0 1 ${r},${r} v${h - r} Z`;
}

/** Horizontal bar chart — one measure across categories, single hue. */
export function HBarChart({
  items,
}: {
  items: { label: string; value: number; display: string }[];
}) {
  const rowH = 34;
  const labelW = 170;
  const barMaxW = 240;
  const valueW = 48;
  const width = labelW + barMaxW + valueW;
  const height = items.length * rowH;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full"
      role="img"
      aria-label="Completion rate by course"
    >
      {items.map((item, i) => {
        const y = i * rowH;
        const barH = 16;
        const barY = y + (rowH - barH) / 2;
        const w = Math.max(Math.round(item.value * barMaxW), 2);
        return (
          <g key={item.label}>
            <title>{`${item.label}: ${item.display}`}</title>
            <text
              x={labelW - 10}
              y={y + rowH / 2 + 4}
              textAnchor="end"
              fontSize="11.5"
              fill={INK_SECONDARY}
            >
              {item.label.length > 26
                ? item.label.slice(0, 25) + "…"
                : item.label}
            </text>
            <rect
              x={labelW}
              y={barY}
              width={barMaxW}
              height={barH}
              rx="4"
              fill={TRACK}
            />
            <path d={roundedRightBar(labelW, barY, w, barH)} fill={ORANGE} />
            <text
              x={labelW + barMaxW + 8}
              y={y + rowH / 2 + 4}
              fontSize="11"
              fontFamily="var(--font-mono)"
              fill={INK_MUTED}
            >
              {item.display}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** Donut — parts of a whole with a headline % in the middle. */
export function Donut({
  segments,
  centerValue,
  centerLabel,
}: {
  segments: { label: string; count: number; color: string }[];
  centerValue: string;
  centerLabel: string;
}) {
  const size = 168;
  const c = size / 2;
  const rOuter = 80;
  const rInner = 56;
  const total = segments.reduce((s, x) => s + x.count, 0);
  const rMid = (rOuter + rInner) / 2;
  // 2px surface gap between segments, expressed as an angle at mid-radius.
  const gap = total > 0 ? 2 / rMid : 0;

  function arc(a0: number, a1: number): string {
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const p = (r: number, a: number) => [
      c + r * Math.cos(a),
      c + r * Math.sin(a),
    ];
    const [x0, y0] = p(rOuter, a0);
    const [x1, y1] = p(rOuter, a1);
    const [x2, y2] = p(rInner, a1);
    const [x3, y3] = p(rInner, a0);
    return [
      `M${x0},${y0}`,
      `A${rOuter},${rOuter} 0 ${large} 1 ${x1},${y1}`,
      `L${x2},${y2}`,
      `A${rInner},${rInner} 0 ${large} 0 ${x3},${y3}`,
      "Z",
    ].join(" ");
  }

  const visible = segments.filter((s) => s.count > 0);
  let angle = -Math.PI / 2;

  return (
    <div className="flex items-center gap-6">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="h-40 w-40 shrink-0"
        role="img"
        aria-label={`${centerLabel}: ${centerValue}`}
      >
        {total === 0 || visible.length === 0 ? (
          <circle
            cx={c}
            cy={c}
            r={rMid}
            fill="none"
            stroke={TRACK}
            strokeWidth={rOuter - rInner}
          />
        ) : visible.length === 1 ? (
          <circle
            cx={c}
            cy={c}
            r={rMid}
            fill="none"
            stroke={visible[0].color}
            strokeWidth={rOuter - rInner}
          >
            <title>{`${visible[0].label}: ${visible[0].count}`}</title>
          </circle>
        ) : (
          visible.map((s) => {
            const sweep = (s.count / total) * Math.PI * 2;
            const a0 = angle + gap / 2;
            const a1 = angle + sweep - gap / 2;
            angle += sweep;
            return (
              <path key={s.label} d={arc(a0, Math.max(a1, a0 + 0.01))} fill={s.color}>
                <title>{`${s.label}: ${s.count}`}</title>
              </path>
            );
          })
        )}
        <text
          x={c}
          y={c - 2}
          textAnchor="middle"
          fontSize="24"
          fontWeight="600"
          fill="#171717"
        >
          {centerValue}
        </text>
        <text
          x={c}
          y={c + 16}
          textAnchor="middle"
          fontSize="9.5"
          fill={INK_MUTED}
        >
          {centerLabel}
        </text>
      </svg>

      <div className="space-y-2">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center gap-2.5">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: s.color }}
            />
            <span className="text-[13px] text-neutral-700">{s.label}</span>
            <span className="font-mono text-[12px] text-neutral-400">
              {s.count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Two-series line chart for weekly activity trends. */
export function TrendChart({
  buckets,
  series,
}: {
  buckets: string[]; // x labels, one per bucket
  series: { label: string; color: string; values: number[]; total: number }[];
}) {
  const plotW = 620;
  const plotH = 150;
  const padL = 34;
  const padB = 24;
  const padT = 12;
  const width = padL + plotW;
  const height = padT + plotH + padB;
  const n = buckets.length;
  const rawMax = Math.max(...series.flatMap((s) => s.values), 1);
  // Round the axis top to a clean number.
  const step = rawMax <= 5 ? 1 : rawMax <= 10 ? 2 : rawMax <= 25 ? 5 : rawMax <= 50 ? 10 : 25;
  const yMax = Math.ceil(rawMax / step) * step;
  const x = (i: number) => padL + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const y = (v: number) => padT + plotH - (v / yMax) * plotH;
  const ticks = [0, yMax / 2, yMax];

  return (
    <div className="flex flex-wrap items-center gap-6">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="min-w-0 flex-1"
        role="img"
        aria-label="Activity trend"
      >
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={padL}
              y1={y(t)}
              x2={padL + plotW}
              y2={y(t)}
              stroke="#EEEDEB"
              strokeWidth="1"
            />
            <text
              x={padL - 8}
              y={y(t) + 3.5}
              textAnchor="end"
              fontSize="10"
              fontFamily="var(--font-mono)"
              fill={INK_MUTED}
            >
              {t}
            </text>
          </g>
        ))}
        {buckets.map((b, i) => (
          <text
            key={b}
            x={x(i)}
            y={padT + plotH + 16}
            textAnchor="middle"
            fontSize="9.5"
            fontFamily="var(--font-mono)"
            fill={INK_MUTED}
          >
            {b}
          </text>
        ))}
        {series.map((s) => (
          <g key={s.label}>
            <path
              d={s.values
                .map((v, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(v)}`)
                .join(" ")}
              fill="none"
              stroke={s.color}
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {s.values.map((v, i) => (
              <circle
                key={i}
                cx={x(i)}
                cy={y(v)}
                r="4"
                fill={s.color}
                stroke="#FFFFFF"
                strokeWidth="2"
              >
                <title>{`${s.label} · ${buckets[i]}: ${v}`}</title>
              </circle>
            ))}
          </g>
        ))}
      </svg>

      <div className="space-y-3">
        {series.map((s) => (
          <div key={s.label} className="flex items-center gap-2.5 border-l-2 pl-3" style={{ borderColor: s.color }}>
            <div>
              <div className="text-[13px] text-neutral-700">{s.label}</div>
              <div className="font-mono text-lg font-semibold tracking-tight">
                {s.total}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Score-distribution histogram: five percent buckets, single hue. */
export function ScoreHistogram({
  percents,
}: {
  percents: number[]; // each 0..100
}) {
  const buckets = [0, 0, 0, 0, 0];
  for (const p of percents) {
    buckets[Math.min(Math.floor(p / 20), 4)]++;
  }
  const labels = ["0–20", "20–40", "40–60", "60–80", "80–100"];
  const max = Math.max(...buckets, 1);
  const colW = 52;
  const barW = 24;
  const plotH = 90;
  const width = colW * 5;
  const height = plotH + 22;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-28"
      role="img"
      aria-label="Score distribution"
    >
      <line
        x1="0"
        y1={plotH}
        x2={width}
        y2={plotH}
        stroke="#E5E5E5"
        strokeWidth="1"
      />
      {buckets.map((count, i) => {
        const h = count === 0 ? 0 : Math.max((count / max) * (plotH - 18), 4);
        const x = i * colW + (colW - barW) / 2;
        return (
          <g key={i}>
            <title>{`${labels[i]}%: ${count} ${count === 1 ? "learner" : "learners"}`}</title>
            {count > 0 && (
              <>
                <path
                  d={roundedTopBar(x, plotH - h, barW, h)}
                  fill={i >= 3 ? TEAL : ORANGE}
                />
                <text
                  x={i * colW + colW / 2}
                  y={plotH - h - 5}
                  textAnchor="middle"
                  fontSize="10.5"
                  fontFamily="var(--font-mono)"
                  fill={INK_SECONDARY}
                >
                  {count}
                </text>
              </>
            )}
            <text
              x={i * colW + colW / 2}
              y={plotH + 14}
              textAnchor="middle"
              fontSize="9"
              fontFamily="var(--font-mono)"
              fill={INK_MUTED}
            >
              {labels[i]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
