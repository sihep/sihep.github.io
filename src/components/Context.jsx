import { motion } from 'framer-motion'

const reveal = {
  hidden: { opacity: 0, y: 26 },
  show: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] } },
}

export default function Context() {
  return (
    <section className="section hairline-top">
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0,1fr) minmax(0,2.2fr)',
          gap: 64,
        }}
        className="context-grid"
      >
        <motion.p
          className="eyebrow"
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-80px' }}
          variants={reveal}
        >
          The Problem
        </motion.p>

        <div>
          <motion.h3
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-80px' }}
            variants={reveal}
            style={{
              fontSize: 'clamp(28px, 3.6vw, 46px)',
              fontWeight: 600,
              lineHeight: 1.22,
              color: 'var(--paper)',
              maxWidth: 880,
            }}
          >
            Point clouds are dense with geometry and empty of meaning. A LiDAR
            frame tells you <em style={{ fontStyle: 'normal', color: 'var(--steel)' }}>where every surface is</em> —
            it does not tell you which fifty points, out of fifty thousand,
            are worth a second look.
          </motion.h3>

          <motion.p
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-80px' }}
            variants={reveal}
            transition={{ delay: 0.1 }}
            style={{
              marginTop: 32,
              fontSize: 17,
              lineHeight: 1.75,
              color: 'var(--paper-dim)',
              maxWidth: 640,
            }}
          >
            LiSAM is built on a simple division of labor. One model is fast
            and coarse — it scans the full 2.5D depth field and flags
            candidate points of interest. The other is slow and precise —
            it receives only a centered crop around each candidate and
            makes the call. Neither model has to be good at the other's
            job.
          </motion.p>
        </div>
      </div>

      <style>{`
        @media (max-width: 780px) {
          .context-grid { grid-template-columns: 1fr !important; gap: 24px !important; }
        }
      `}</style>
    </section>
  )
}
