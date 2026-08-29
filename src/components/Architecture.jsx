import { motion } from 'framer-motion'

const NODES = [
  { k: 'A', label: 'Depth Field', sub: '2.5D range + intensity' },
  { k: 'B', label: 'Locate Model', sub: 'coarse, full-frame' },
  { k: 'C', label: 'Candidate Points', sub: 'N proposals, scored' },
  { k: 'D', label: 'Center + Crop', sub: 'fixed window, per point' },
  { k: 'E', label: 'Identify Model', sub: 'precise, single-crop' },
  { k: 'F', label: 'Labeled Output', sub: 'class + mask + confidence' },
]

export default function Architecture() {
  return (
    <section id="architecture" className="section hairline-top">
      <motion.p
        className="eyebrow"
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        style={{ marginBottom: 20 }}
      >
        Architecture / Data Flow
      </motion.p>

      <motion.h3
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        style={{
          fontSize: 'clamp(26px, 3vw, 38px)',
          fontWeight: 700,
          maxWidth: 700,
          marginBottom: 64,
          color: 'var(--paper)',
        }}
      >
        One frame in. One label per point of interest out.
      </motion.h3>

      <div className="flow-row">
        {NODES.map((n, i) => (
          <div key={n.k} style={{ display: 'contents' }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.94 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className="flow-node"
            >
              <span className="mono" style={{ fontSize: 10, color: 'var(--signal)' }}>
                {n.k}
              </span>
              <strong
                style={{
                  display: 'block',
                  marginTop: 8,
                  fontFamily: 'var(--f-display)',
                  fontWeight: 700,
                  fontSize: 15,
                  color: 'var(--paper)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.01em',
                }}
              >
                {n.label}
              </strong>
              <span
                className="mono"
                style={{
                  display: 'block',
                  marginTop: 6,
                  fontSize: 10.5,
                  color: 'var(--steel)',
                }}
              >
                {n.sub}
              </span>
            </motion.div>

            {i < NODES.length - 1 && (
              <div className="flow-arrow" aria-hidden>
                <svg width="100%" height="16" viewBox="0 0 60 16" preserveAspectRatio="none">
                  <line x1="0" y1="8" x2="52" y2="8" stroke="var(--hairline-strong)" strokeWidth="1" />
                  <path d="M 52 3 L 60 8 L 52 13" fill="none" stroke="var(--hairline-strong)" strokeWidth="1" />
                </svg>
              </div>
            )}
          </div>
        ))}
      </div>

      <style>{`
        .flow-row {
          display: grid;
          grid-template-columns: 1fr auto 1fr auto 1fr auto 1fr auto 1fr auto 1fr;
          align-items: center;
          gap: 0;
        }
        .flow-node {
          border: 1px solid var(--hairline);
          padding: 20px 16px;
          min-height: 120px;
        }
        .flow-arrow {
          display: flex;
          align-items: center;
          padding: 0 4px;
          width: 36px;
        }
        @media (max-width: 980px) {
          .flow-row { grid-template-columns: 1fr; }
          .flow-arrow { transform: rotate(90deg); padding: 8px 0; width: 40px; margin: 0 auto; }
        }
      `}</style>
    </section>
  )
}
