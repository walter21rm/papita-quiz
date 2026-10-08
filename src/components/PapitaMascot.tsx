export type PapitaMood = "happy" | "thinking" | "cheer" | "oops" | "wave";

interface PapitaMascotProps {
  mood?: PapitaMood;
  size?: number;
  className?: string;
  title?: string;
}

function Eyes({ mood }: { mood: PapitaMood }) {
  if (mood === "cheer") {
    return (
      <g stroke="#3d2814" strokeWidth="4" strokeLinecap="round" fill="none">
        <path d="M70 92 q8 -9 16 0" />
        <path d="M114 92 q8 -9 16 0" />
      </g>
    );
  }
  const lookUp = mood === "thinking" ? -4 : 0;
  return (
    <g className="papita-blink">
      <ellipse cx="78" cy={94 + lookUp} rx="7" ry="9" fill="#3d2814" />
      <ellipse cx="122" cy={94 + lookUp} rx="7" ry="9" fill="#3d2814" />
      <circle cx="80.5" cy={90 + lookUp} r="2.6" fill="#fff" />
      <circle cx="124.5" cy={90 + lookUp} r="2.6" fill="#fff" />
    </g>
  );
}

function Mouth({ mood }: { mood: PapitaMood }) {
  switch (mood) {
    case "cheer":
      return <path d="M82 114 q18 22 36 0 z" fill="#8f2f1f" stroke="#3d2814" strokeWidth="3" strokeLinejoin="round" />;
    case "thinking":
      return <path d="M88 120 q8 -4 20 1" stroke="#3d2814" strokeWidth="3.5" strokeLinecap="round" fill="none" />;
    case "oops":
      return <ellipse cx="100" cy="120" rx="7" ry="6" fill="#8f2f1f" stroke="#3d2814" strokeWidth="3" />;
    default:
      return <path d="M84 113 q16 16 32 0" stroke="#3d2814" strokeWidth="4" strokeLinecap="round" fill="none" />;
  }
}

/** Papita, the friendly potato that guides the student through the app. */
export function PapitaMascot({ mood = "happy", size = 160, className = "", title = "Papita" }: PapitaMascotProps) {
  return (
    <svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      role="img"
      aria-label={title}
      className={className}
    >
      <title>{title}</title>
      <ellipse cx="100" cy="186" rx="52" ry="7" fill="#6d3d17" opacity="0.15" />

      {/* sprout */}
      <path d="M100 34 C 98 22, 102 14, 104 8" stroke="#3f8239" strokeWidth="4" strokeLinecap="round" fill="none" />
      <path d="M103 16 C 116 4, 132 8, 134 14 C 124 22, 110 22, 103 16 Z" fill="#4f9d48" />
      <path d="M101 22 C 90 12, 76 14, 74 20 C 82 28, 94 28, 101 22 Z" fill="#62b25a" />

      {/* arms */}
      <path
        d="M44 118 C 30 112, 24 100, 28 92"
        stroke="#b96d19"
        strokeWidth="9"
        strokeLinecap="round"
        fill="none"
        className={mood === "wave" || mood === "cheer" ? "papita-wave" : undefined}
      />
      <path d="M156 118 C 170 124, 174 134, 170 142" stroke="#b96d19" strokeWidth="9" strokeLinecap="round" fill="none" />

      {/* body */}
      <path
        d="M100 32 C 146 30, 166 62, 164 104 C 162 150, 136 180, 98 180 C 60 180, 36 152, 36 110 C 36 64, 58 34, 100 32 Z"
        fill="#eda93b"
        stroke="#b96d19"
        strokeWidth="4"
      />
      <path
        d="M72 52 C 90 44, 118 44, 136 56"
        stroke="#fbd993"
        strokeWidth="8"
        strokeLinecap="round"
        fill="none"
        opacity="0.8"
      />

      {/* potato spots */}
      <circle cx="58" cy="136" r="4" fill="#b96d19" opacity="0.55" />
      <circle cx="140" cy="146" r="3.5" fill="#b96d19" opacity="0.55" />
      <circle cx="146" cy="74" r="3" fill="#b96d19" opacity="0.5" />
      <circle cx="66" cy="70" r="2.6" fill="#b96d19" opacity="0.5" />

      {/* cheeks */}
      <ellipse cx="64" cy="112" rx="10" ry="6" fill="#f08a6b" opacity="0.55" />
      <ellipse cx="136" cy="112" rx="10" ry="6" fill="#f08a6b" opacity="0.55" />

      <Eyes mood={mood} />
      <Mouth mood={mood} />

      {mood === "thinking" && (
        <g fill="#8f5118">
          <circle cx="162" cy="58" r="4" />
          <circle cx="174" cy="44" r="5.5" />
          <circle cx="188" cy="26" r="7" />
        </g>
      )}
      {mood === "oops" && (
        <path d="M150 70 q6 10 0 16 q-6 -6 0 -16 z" fill="#3f86c2" opacity="0.8" />
      )}
      {mood === "cheer" && (
        <g fill="#f6c25f">
          <path d="M22 50 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3 z" />
          <path d="M176 92 l2.5 5.5 5.5 2.5 -5.5 2.5 -2.5 5.5 -2.5 -5.5 -5.5 -2.5 5.5 -2.5 z" />
        </g>
      )}
    </svg>
  );
}
