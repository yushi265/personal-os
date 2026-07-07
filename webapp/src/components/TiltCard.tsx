import * as React from "react";
import { motion, useMotionTemplate, useMotionValue, useReducedMotion, useSpring, useTransform } from "motion/react";

// ポインタ追従の3Dチルトラッパー(ホームサマリカード用)。機能的な意味は持たせず、
// 「触ると気持ちいい」だけの触感演出に徹する:
// - カーソル位置へ向かってspringで傾く(離れると中央へ弾んで戻る)
// - カーソル位置を追う鏡面グレア(--glare。light=極薄の陰/dark=白ハイライト)
// - hoverでわずかに浮き、押すと沈む(whileHover/whileTap)
// 情報伝達には一切使っていないため、reduced-motion時は素のdivに落として丸ごと省略する。
// チルトはmouse/penのみ(タッチはスクロール中の誤発火が不快なため、tapの沈み込みだけ効かせる)。
const TILT_SPRING = { stiffness: 300, damping: 22, mass: 0.6 };
const MAX_TILT_DEG = 7;

export function TiltCard({ children, className }: { children: React.ReactNode; className?: string }) {
  const reduced = useReducedMotion();
  // ポインタ位置(0..1)。初期値0.5=中央でチルト0度
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const rotateX = useSpring(useTransform(py, [0, 1], [MAX_TILT_DEG, -MAX_TILT_DEG]), TILT_SPRING);
  const rotateY = useSpring(useTransform(px, [0, 1], [-MAX_TILT_DEG, MAX_TILT_DEG]), TILT_SPRING);
  const glareX = useTransform(px, (v) => `${v * 100}%`);
  const glareY = useTransform(py, (v) => `${v * 100}%`);
  const glare = useMotionTemplate`radial-gradient(180px circle at ${glareX} ${glareY}, var(--glare), transparent 70%)`;

  if (reduced) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={`group/tilt relative ${className ?? ""}`}
      style={{ rotateX, rotateY, transformPerspective: 700 }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 350, damping: 25 }}
      onPointerMove={(e) => {
        if (e.pointerType !== "mouse" && e.pointerType !== "pen") return;
        const rect = e.currentTarget.getBoundingClientRect();
        px.set((e.clientX - rect.left) / rect.width);
        py.set((e.clientY - rect.top) / rect.height);
      }}
      onPointerLeave={() => {
        px.set(0.5);
        py.set(0.5);
      }}
    >
      {children}
      {/* グレアはカードの角丸(rounded-lg=var(--radius))に合わせて重ねる。装飾のみのためSRからは隠す */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-lg opacity-0 transition-opacity duration-300 group-hover/tilt:opacity-100"
        style={{ background: glare }}
      />
    </motion.div>
  );
}
