import Nav from './components/Nav.jsx'
import Hero from './components/Hero.jsx'
import Context from './components/Context.jsx'
import Pipeline from './components/Pipeline.jsx'
import Architecture from './components/Architecture.jsx'
import Specs from './components/Specs.jsx'
import VizSlot from './components/VizSlot.jsx'
import Footer from './components/Footer.jsx'

export default function App() {
  return (
    <div>
      <Nav />
      <main>
        <Hero />
        <Context />
        <Pipeline />
        <Architecture />
        <Specs />
        <VizSlot />
      </main>
      <Footer />
    </div>
  )
}
