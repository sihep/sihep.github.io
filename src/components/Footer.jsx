import { motion } from 'framer-motion'
import Wordmark from './Wordmark.jsx'

export default function Footer() {
  return (
    <footer id="contact" className="section hairline-top" style={{ paddingBottom: 64 }}>
      <div className="footer-grid">
        <div>
          <motion.h3
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            style={{
              fontSize: 'clamp(30px, 4vw, 52px)',
              fontWeight: 800,
              color: 'var(--paper)',
              maxWidth: 620,
            }}
          >
            Request a technical briefing.
          </motion.h3>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.08 }}
            style={{ marginTop: 20, color: 'var(--paper-dim)', maxWidth: 480, lineHeight: 1.7 }}
          >
            LiSAM is under active development as a design proposal. For
            architecture reviews, dataset access, or integration questions,
            reach the project team directly.
          </motion.p>
          <motion.a
            href="mailto:lisam-project@example.mil.in"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.16 }}
            className="mono"
            style={{
              display: 'inline-block',
              marginTop: 32,
              fontSize: 13,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'var(--void)',
              background: 'var(--signal)',
              padding: '15px 26px',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            Contact Project Team →
          </motion.a>
        </div>

        <div className="mono footer-meta">
          <div>
            <span style={{ color: 'var(--steel)', display: 'block', marginBottom: 8 }}>PROGRAM</span>
            <span style={{ color: 'var(--paper-dim)' }}>LiSAM — Segment Anything, LiDAR</span>
          </div>
          <div>
            <span style={{ color: 'var(--steel)', display: 'block', marginBottom: 8 }}>STATUS</span>
            <span style={{ color: 'var(--paper-dim)' }}>Design Proposal — Not Deployed</span>
          </div>
        </div>
      </div>

      <div
        style={{
          marginTop: 80,
          paddingTop: 24,
          borderTop: '1px solid var(--hairline)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <Wordmark size={14} color="var(--steel)" gap={7} />
        <div
          className="mono"
          style={{
            display: 'flex',
            gap: 20,
            flexWrap: 'wrap',
            fontSize: 10.5,
            color: 'var(--steel-dim)',
            letterSpacing: '0.06em',
          }}
        >
          <span>© {new Date().getFullYear()} LiSAM PROJECT — CONCEPT DEMONSTRATION</span>
          <span>DOCUMENT PREPARED FOR INTERNAL REVIEW ONLY</span>
        </div>
      </div>

      <style>{`
        .footer-grid {
          display: grid;
          grid-template-columns: 1.4fr 1fr;
          gap: 64px;
        }
        .footer-meta {
          display: flex;
          flex-direction: column;
          gap: 28px;
          font-size: 12.5px;
          justify-content: flex-end;
        }
        @media (max-width: 780px) {
          .footer-grid { grid-template-columns: 1fr; gap: 40px; }
          .footer-meta { justify-content: flex-start; }
        }
      `}</style>
    </footer>
  )
}
