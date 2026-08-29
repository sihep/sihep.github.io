import { motion } from 'framer-motion'

const STAGES = [
  {
    tag: 'STAGE 01',
    title: 'Locate',
    desc: 'A lightweight model sweeps the full 2.5D depth field — range and intensity together — and proposes candidate points of interest across the frame. Built for coverage, not certainty.',
    meta: ['INPUT: FULL FRAME', 'OUTPUT: CANDIDATE POINTS'],
  },
  {
    tag: 'TRANSFORM',
    title: 'Center',
    desc: 'Each candidate is cropped to a fixed window around its own coordinate and re-normalized. The refinement model always sees the same framing, regardless of where the point sat in the original scan.',
    meta: ['INPUT: CANDIDATE POINT', 'OUTPUT: CENTERED CHIP'],
    isTransform: true,
  },
  {
    tag: 'STAGE 02',
    title: 'Identify',
    desc: 'A heavier model receives only the centered chip and makes the final call — classification, fine segmentation, or rejection as noise. Built for precision, not coverage.',
    meta: ['INPUT: CENTERED CHIP', 'OUTPUT: IDENTIFIED OBJECT'],
  },
]

export default function Pipeline() {
  return (
    <section id="pipeline" className="section hairline-top">
      <motion.p
        className="eyebrow"
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        style={{ marginBottom: 20 }}
      >
        System / Two-Stage Pipeline
      </motion.p>

      <motion.h3
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.05 }}
        style={{
          fontSize: 'clamp(28px, 3.4vw, 44px)',
          fontWeight: 700,
          maxWidth: 760,
          marginBottom: 72,
          color: 'var(--paper)',
        }}
      >
        Find, then look closer.
      </motion.h3>

      <div className="pipeline-row">
        {STAGES.map((s, i) => (
          <motion.div
            key={s.title}
            initial={{ opacity: 0, y: 32 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.7, delay: i * 0.12, ease: [0.16, 1, 0.3, 1] }}
            className={s.isTransform ? 'stage-card is-transform' : 'stage-card'}
          >
            {!s.isTransform && (
              <div
                className="corner-frame"
                style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
              />
            )}
            <span
              className="mono"
              style={{
                fontSize: 11,
                letterSpacing: '0.14em',
                color: s.isTransform ? 'var(--steel)' : 'var(--signal)',
              }}
            >
              {s.tag}
            </span>
            <h4
              style={{
                marginTop: 14,
                fontSize: 30,
                fontWeight: 700,
                color: 'var(--paper)',
                textTransform: 'uppercase',
              }}
            >
              {s.title}
            </h4>
            <p
              style={{
                marginTop: 16,
                fontSize: 14.5,
                lineHeight: 1.7,
                color: 'var(--paper-dim)',
              }}
            >
              {s.desc}
            </p>
            <div
              className="mono"
              style={{
                marginTop: 24,
                paddingTop: 16,
                borderTop: '1px solid var(--hairline)',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                fontSize: 10.5,
                color: 'var(--steel)',
                letterSpacing: '0.05em',
              }}
            >
              {s.meta.map((m) => (
                <span key={m}>{m}</span>
              ))}
            </div>
          </motion.div>
        ))}
      </div>

      <style>{`
        .pipeline-row {
          display: grid;
          grid-template-columns: 1.15fr 0.7fr 1.15fr;
          gap: 0;
          align-items: stretch;
        }
        .stage-card {
          position: relative;
          padding: 32px 30px;
          border: 1px solid var(--hairline);
        }
        .stage-card + .stage-card {
          border-left: none;
        }
        .stage-card.is-transform {
          background: var(--ink);
          display: flex;
          flex-direction: column;
          justify-content: center;
          text-align: center;
          align-items: center;
        }
        .stage-card.is-transform h4 {
          font-size: 22px;
        }
        .stage-card.is-transform p {
          max-width: 220px;
        }
        @media (max-width: 900px) {
          .pipeline-row { grid-template-columns: 1fr; }
          .stage-card + .stage-card { border-left: 1px solid var(--hairline); border-top: none; }
          .stage-card.is-transform { padding: 40px 30px; }
        }
      `}</style>
    </section>
  )
}
