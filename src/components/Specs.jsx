import { motion } from 'framer-motion'

const SPECS = [
  {
    k: '01',
    label: 'Input Modality',
    value: '2.5D LiDAR — range + intensity',
    note: 'Single-return or multi-echo depth frames',
  },
  {
    k: '02',
    label: 'Stage 1 Model',
    value: 'Point-of-interest proposal network',
    note: 'Optimized for recall across the full frame',
  },
  {
    k: '03',
    label: 'Stage 2 Model',
    value: 'Centered-crop identification network',
    note: 'Optimized for precision on a single candidate',
  },
  {
    k: '04',
    label: 'Handoff',
    value: 'Coordinate-centered, scale-normalized crop',
    note: 'Fixed window, consistent framing per candidate',
  },
  {
    k: '05',
    label: 'Output',
    value: 'Per-point class, mask, confidence',
    note: 'Structured for downstream tracking / fusion',
  },
]

export default function Specs() {
  return (
    <section id="specs" className="section hairline-top">
      <motion.p
        className="eyebrow"
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        style={{ marginBottom: 20 }}
      >
        Spec Sheet
      </motion.p>

      <motion.h3
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        style={{
          fontSize: 'clamp(26px, 3vw, 38px)',
          fontWeight: 700,
          maxWidth: 700,
          marginBottom: 56,
          color: 'var(--paper)',
        }}
      >
        System characteristics.
      </motion.h3>

      <div>
        {SPECS.map((s, i) => (
          <motion.div
            key={s.k}
            initial={{ opacity: 0, x: -16 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.55, delay: i * 0.05 }}
            className="spec-row"
          >
            <span className="mono" style={{ fontSize: 12, color: 'var(--signal)' }}>
              {s.k}
            </span>
            <span
              style={{
                fontFamily: 'var(--f-display)',
                fontWeight: 600,
                fontSize: 15,
                color: 'var(--paper-dim)',
                textTransform: 'uppercase',
                letterSpacing: '0.02em',
              }}
            >
              {s.label}
            </span>
            <span style={{ fontSize: 16, color: 'var(--paper)' }}>{s.value}</span>
            <span className="mono" style={{ fontSize: 11.5, color: 'var(--steel)' }}>
              {s.note}
            </span>
          </motion.div>
        ))}
      </div>

      <style>{`
        .spec-row {
          display: grid;
          grid-template-columns: 40px 200px 1.3fr 1fr;
          gap: 24px;
          align-items: center;
          padding: 22px 0;
          border-top: 1px solid var(--hairline);
        }
        .spec-row:last-child {
          border-bottom: 1px solid var(--hairline);
        }
        @media (max-width: 860px) {
          .spec-row {
            grid-template-columns: 1fr;
            gap: 6px;
            padding: 18px 0;
          }
        }
      `}</style>
    </section>
  )
}
