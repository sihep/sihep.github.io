import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import Wordmark from './Wordmark.jsx'

const LINKS = [
  { label: 'System', href: '#pipeline' },
  { label: 'Architecture', href: '#architecture' },
  { label: 'Spec Sheet', href: '#specs' },
  { label: 'Visualization', href: '#viz' },
]

export default function Nav() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: scrolled ? '16px 40px' : '26px 40px',
        background: scrolled ? 'rgba(10,10,10,0.86)' : 'transparent',
        backdropFilter: scrolled ? 'blur(10px)' : 'none',
        borderBottom: scrolled ? '1px solid var(--hairline)' : '1px solid transparent',
        transition: 'padding 0.35s ease, background 0.35s ease, border-color 0.35s ease',
      }}
    >
      <a href="#top" style={{ textDecoration: 'none', color: 'var(--paper)' }}>
        <Wordmark size={19} />
      </a>

      <nav
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 36,
        }}
        className="nav-links"
      >
        {LINKS.map((l) => (
          <a
            key={l.href}
            href={l.href}
            className="mono"
            style={{
              fontSize: 12,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'var(--paper-dim)',
              textDecoration: 'none',
              position: 'relative',
              paddingBottom: 4,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--paper)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--paper-dim)')}
          >
            {l.label}
          </a>
        ))}
        <a
          href="#contact"
          className="mono"
          style={{
            fontSize: 12,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--void)',
            background: 'var(--signal)',
            padding: '9px 16px',
            textDecoration: 'none',
            fontWeight: 600,
          }}
        >
          Request Briefing
        </a>
      </nav>

      <style>{`
        @media (max-width: 780px) {
          .nav-links a:not(:last-child) { display: none; }
        }
      `}</style>
    </motion.header>
  )
}
