/** Ô icon bo tròn với nền tint category (lớp "playful" của Nocturne). */
export function IconTile({ icon, color, size = 46 }: { icon: string; color: string; size?: number }): JSX.Element {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-2xl"
      style={{
        width: size,
        height: size,
        background: `color-mix(in srgb, ${color} 22%, transparent)`,
        color,
        fontSize: size * 0.5,
      }}
    >
      <i className={`ph-fill ${icon}`} aria-hidden />
    </span>
  );
}

