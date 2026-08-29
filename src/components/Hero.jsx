import { motion } from 'framer-motion'
import { useMemo } from 'react'

// deterministic pseudo-random so the point field is stable across renders
function mulberry32(seed) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function usePointCloud() {
  return useMemo(() => {
    const rand = mulberry32(1337)
    const points = []
    for (let i = 0; i < 150; i++) {
      points.push({
        x: rand() * 700,
        y: rand() * 500,
        r: rand() * 1.1 + 0.6,
        d: rand() * 0.9,
      })
    }
    // a denser cluster the reticle will "identify" — dead center
    for (let i = 0; i < 34; i++) {
      points.push({
        x: 350 + rand() * 120 - 60,
        y: 250 + rand() * 120 - 60,
        r: rand() * 1.3 + 0.8,
        d: 0.9 + rand() * 0.6,
        cluster: true,
      })
    }
    return points
  }, [])
}

export default function Hero() {
  const points = usePointCloud()

  return (
    <section
      id="top"
      style={{
        position: 'relative',
        minHeight: '100svh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        background: 'var(--void)',
        paddingTop: 96,
        textAlign: 'center',
      }}
    >
      <div className="grid-overlay" />

      {/* ambient scanline sweep */}
      <motion.div
        aria-hidden
        initial={{ top: '-10%' }}
        animate={{ top: '110%' }}
        transition={{ duration: 7, repeat: Infinity, ease: 'linear', repeatDelay: 1.2 }}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          height: 1,
          background:
            'linear-gradient(90deg, transparent, rgba(255,255,255,0.4) 40%, rgba(255,255,255,0.4) 60%, transparent)',
          pointerEvents: 'none',
        }}
      />

      {/* point-cloud / reticle-lock visual — centered, ambient, behind the type */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(78vw, 900px)',
          aspectRatio: '7 / 5',
          opacity: 0.5,
        }}
        className="hero-cloud"
      >
        <svg viewBox="0 0 700 500" width="100%" height="100%">
          {points.map((p, i) => (
            <motion.circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={p.r}
              fill={p.cluster ? 'var(--signal)' : 'var(--paper)'}
              initial={{ opacity: 0 }}
              animate={{ opacity: p.cluster ? 0.85 : 0.22 + p.d * 0.22 }}
              transition={{ duration: 1.1, delay: 0.3 + p.d * 0.5 }}
            />
          ))}

          {/* primary reticle locking onto the cluster */}
          <motion.g
            initial={{ opacity: 0, scale: 1.4 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, delay: 1.9, ease: [0.16, 1, 0.3, 1] }}
            style={{ transformOrigin: '350px 250px' }}
          >
            {[
              'M 280 190 L 280 210 M 280 190 L 300 190',
              'M 420 190 L 420 210 M 420 190 L 400 190',
              'M 280 310 L 280 290 M 280 310 L 300 310',
              'M 420 310 L 420 290 M 420 310 L 400 310',
            ].map((d, i) => (
              <path key={i} d={d} stroke="var(--signal)" strokeWidth="2" fill="none" />
            ))}
            <rect
              x="280"
              y="190"
              width="140"
              height="120"
              fill="none"
              stroke="var(--signal)"
              strokeOpacity="0.3"
              strokeWidth="1"
              strokeDasharray="4 4"
            />
          </motion.g>

          {/* inner refinement box, stage 2 */}
          <motion.rect
            x="332"
            y="228"
            width="36"
            height="44"
            fill="none"
            stroke="var(--paper)"
            strokeWidth="1.4"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 1, 0.55, 1] }}
            transition={{ duration: 2.6, delay: 2.6, repeat: Infinity, repeatDelay: 1.4 }}
          />

          <motion.text
            x="286"
            y="178"
            fill="var(--signal)"
            fontSize="11"
            fontFamily="'JetBrains Mono', monospace"
            letterSpacing="0.5"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 2.3 }}
          >
            POI_014 · LOCKED
          </motion.text>
          <motion.text
            x="286"
            y="326"
            fill="var(--paper-dim)"
            fontSize="10"
            fontFamily="'JetBrains Mono', monospace"
            letterSpacing="0.5"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 2.5 }}
          >
            {/* STAGE_02 · CENTERING → REFINE */}
          </motion.text>
        </svg>
      </div>

      {/* headline */}
      <div style={{ position: 'relative', zIndex: 2, padding: '0 48px', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
        <motion.p
          className="eyebrow"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          style={{ marginBottom: 28, justifyContent: 'center' }}
        >
          Point-of-Interest Identification System
        </motion.p>

        <div style={{ overflow: 'hidden' }}>
          <motion.h1
            initial={{ y: '110%' }}
            animate={{ y: 0 }}
            transition={{ duration: 0.9, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
            style={{
              fontSize: 'clamp(64px, 11vw, 176px)',
              color: 'var(--paper)',
              // textTransform: 'uppercase',
            }}
          >
            LiSAM
          </motion.h1>
        </div>

        <div style={{ overflow: 'hidden', marginTop: 4 }}>
          <motion.h2
            initial={{ y: '110%' }}
            animate={{ y: 0 }}
            transition={{ duration: 0.9, delay: 0.38, ease: [0.16, 1, 0.3, 1] }}
            style={{
              fontSize: 'clamp(22px, 3vw, 40px)',
              fontWeight: 500,
              color: 'var(--steel)',
              maxWidth: 760,
            }}
          >
            Segment anything in <span style={{ color: 'var(--paper)' }}>2.5D LiDAR.</span>
          </motion.h2>
        </div>

        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.62 }}
          style={{
            marginTop: 32,
            maxWidth: 560,
            fontSize: 16,
            lineHeight: 1.6,
            color: 'var(--paper-dim)',
          }}
        >
          A two-stage model for point-of-interest identification in depth-sensor
          imagery. The first pass finds what matters. The second pass, fed a
          centered crop, decides exactly what it is.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.78 }}
          style={{ display: 'flex', gap: 16, marginTop: 44, flexWrap: 'wrap', justifyContent: 'center' }}
        >
          <a
            href="#pipeline"
            className="mono"
            style={{
              textDecoration: 'none',
              fontSize: 13,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'var(--void)',
              background: 'var(--signal)',
              padding: '15px 26px',
              fontWeight: 600,
            }}
          >
            How it works →
          </a>
          <a
            href="#specs"
            className="mono"
            style={{
              textDecoration: 'none',
              fontSize: 13,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'var(--paper)',
              border: '1px solid var(--hairline-strong)',
              padding: '15px 26px',
            }}
          >
            Spec Sheet
          </a>
        </motion.div>
      </div>

      {/* bottom readout bar */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 1.1 }}
        className="mono"
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'space-between',
          padding: '18px 48px',
          fontSize: 11,
          color: 'var(--steel)',
          letterSpacing: '0.08em',
          borderTop: '1px solid var(--hairline)',
        }}
      >
        <span>SENSOR_CLASS: 2.5D LIDAR · DEPTH+INTENSITY</span>
        <span className="hide-sm">MODEL_STAGES: 02</span>
        <span>STATUS: PROPOSAL</span>
      </motion.div>

      <style>{`
        @media (max-width: 900px) {
          .hero-cloud { opacity: 0.22 !important; }
        }
        @media (max-width: 620px) {
          .hide-sm { display: none; }
        }
      `}</style>
    </section>
  )
}
