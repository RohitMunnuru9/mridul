/**
 * Two botanical line drawings, used as decoration on the editorial panels.
 *
 * Stroke only, drawn in `currentColor`, so a panel tints them by setting its
 * own colour and they read as one continuous hand at every size. They are
 * always decorative: hidden from assistive technology, no pointer events, and
 * positioned so a panel's `overflow: hidden` crops them — nothing here may
 * ever widen the page.
 */

export function Botanical({
  variant,
  className,
}: {
  variant: 'bloom' | 'sprig';
  className?: string;
}) {
  const shared = {
    'aria-hidden': true as const,
    focusable: 'false' as const,
    className: className ? `botanical botanical-${variant} ${className}` : `botanical botanical-${variant}`,
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.1,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  if (variant === 'bloom') {
    return (
      <svg viewBox="0 0 220 340" {...shared}>
        {/* stem and two leaves */}
        <path d="M112 336 C118 270 104 210 118 150" />
        <path d="M110 250 C80 240 62 214 66 190 C92 196 108 220 110 250 Z" />
        <path d="M110 250 C96 232 82 214 70 194" />
        <path d="M116 205 C146 200 168 176 166 152 C140 156 122 178 116 205 Z" />
        <path d="M116 205 C130 190 148 172 162 156" />
        {/* six petals around the head */}
        <path d="M120 118 C96 104 84 78 100 60 C112 52 124 66 120 118 Z" />
        <path d="M120 118 C118 92 130 66 150 62 C166 66 158 96 120 118 Z" />
        <path d="M120 118 C138 100 168 96 178 110 C176 126 146 126 120 118 Z" />
        <path d="M120 118 C144 126 160 148 148 164 C132 170 122 146 120 118 Z" />
        <path d="M120 118 C112 144 96 160 80 154 C70 144 92 128 120 118 Z" />
        <path d="M120 118 C94 122 70 112 68 96 C74 82 102 100 120 118 Z" />
        {/* inner veins */}
        <path d="M120 118 C114 100 112 84 116 70" />
        <path d="M120 118 C134 106 146 100 156 98" />
        <path d="M120 118 C128 132 132 146 130 158" />
        {/* a bud off to the side */}
        <path d="M150 44 C154 34 162 32 166 40 C164 50 154 52 150 44 Z" />
        <path d="M150 44 C144 56 134 62 128 70" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 210 360" {...shared}>
      {/* one stem, leaves alternating up it */}
      <path d="M28 356 C60 300 92 240 124 180 C142 146 154 108 160 64" />
      <path d="M62 292 C40 282 26 262 30 238 C52 244 66 268 62 292 Z" />
      <path d="M62 292 C54 276 44 258 34 242" />
      <path d="M84 262 C104 250 128 254 138 272 C120 284 96 280 84 262 Z" />
      <path d="M84 262 C100 266 118 270 134 272" />
      <path d="M104 218 C84 206 72 184 78 162 C98 170 110 194 104 218 Z" />
      <path d="M104 218 C96 200 88 182 80 166" />
      <path d="M124 194 C146 184 170 190 178 210 C160 220 136 214 124 194 Z" />
      <path d="M124 194 C140 200 158 206 174 210" />
      <path d="M138 150 C122 136 114 112 124 92 C142 104 148 130 138 150 Z" />
      <path d="M138 150 C132 132 128 112 126 96" />
      <path d="M150 120 C168 108 188 110 196 128 C180 138 160 134 150 120 Z" />
      <path d="M150 120 C164 124 178 128 192 130" />
      <path d="M160 64 C170 48 184 40 196 44 C194 60 178 70 160 64 Z" />
      <path d="M160 64 C172 58 184 52 192 48" />
    </svg>
  );
}
