/**
 * Aura Finance — Abstract A+Lightning neon logo
 * Double-lined A with lightning bolt crossbar, cyan→purple gradient
 */

interface AuraLogoProps {
  size?: number;
  style?: React.CSSProperties;
  className?: string;
}

export function AuraLogo({ size = 28, style, className }: AuraLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{
        filter: 'drop-shadow(0 0 8px rgba(6,182,212,0.7)) drop-shadow(0 0 14px rgba(139,92,246,0.5))',
        flexShrink: 0,
        ...style,
      }}
      className={className}
    >
      <defs>
        <linearGradient id="aura-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#06b6d4" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
      {/* A left leg - thick stroke for double-lined feel */}
      <path
        d="M24 4 L10 44"
        stroke="url(#aura-gradient)"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* A right leg */}
      <path
        d="M24 4 L38 44"
        stroke="url(#aura-gradient)"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Lightning bolt as crossbar - double-lined, integrated into A */}
      <path
        d="M24 14 L20 22 L23 22 L21 32 L26 32 L22 42"
        stroke="url(#aura-gradient)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}
