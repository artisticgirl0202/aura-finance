/**
 * Aura Finance — Count-Up Animation
 * 숫자가 변경될 때 부드럽게 카운트업되는 컴포넌트.
 */

import { animate } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

interface CountUpProps {
  value: number;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  style?: React.CSSProperties;
}

export function CountUp({
  value,
  duration = 1,
  decimals = 0,
  prefix = '',
  suffix = '',
  style = {},
}: CountUpProps) {
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);

  useEffect(() => {
    const from = prevRef.current;
    const to = value;
    prevRef.current = to;

    const controls = animate(from, to, {
      duration,
      ease: 'easeOut',
      onUpdate: (v) => setDisplay(v),
    });
    return () => controls.stop();
  }, [value, duration]);

  const formatted = decimals > 0
    ? display.toFixed(decimals)
    : Math.round(display).toString();

  return (
    <span style={style}>
      {prefix}{formatted}{suffix}
    </span>
  );
}
