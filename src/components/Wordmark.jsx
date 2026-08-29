/**
 * The LiSAM mark: the "therefore" symbol (∴), used literally — the system
 * is a two-stage logical pipeline (locate the candidate, therefore identify
 * it), so the glyph is the argument the whole product makes, not a
 * decorative bug.
 */
export function Mark({ size = 20, color = 'var(--paper)' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="6" cy="7" r="2.15" fill={color} />
      <circle cx="18" cy="7" r="2.15" fill={color} />
      <circle cx="12" cy="17.5" r="2.15" fill={color} />
    </svg>
  )
}

export default function Wordmark({ tag = 'span', size = 19, gap = 11, color = 'var(--paper)', style }) {
  const Tag = tag
  return (
    <Tag
      className="wordmark"
      style={{ display: 'inline-flex', alignItems: 'center', gap, ...style }}
    >
      <Mark size={size} color={color} />
      <span
        style={{
          fontFamily: 'var(--f-display)',
          fontWeight: 800,
          fontSize: size,
          letterSpacing: '0.01em',
          color,
        }}
      >
        LiSAM
      </span>
    </Tag>
  )
}
