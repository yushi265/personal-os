import * as React from "react";
import { animate, useReducedMotion } from "motion/react";

// ホームサマリの数値カウントアップ(design P6-C5)。初回マウント時のみ0→valueへアニメーションする。
export function CountUp({ value }: { value: number }) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const hasAnimated = React.useRef(false);
  const reduced = useReducedMotion();

  React.useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (reduced || hasAnimated.current) {
      node.textContent = String(value);
      hasAnimated.current = true;
      return;
    }
    hasAnimated.current = true;
    const controls = animate(0, value, {
      duration: 0.6,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => {
        if (node) node.textContent = String(Math.round(v));
      },
    });
    return () => controls.stop();
  }, [value, reduced]);

  return <span ref={ref}>0</span>;
}
