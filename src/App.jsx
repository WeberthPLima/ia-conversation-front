import { useState } from 'react'
import './App.css'
import { Routes, Route, useNavigate } from 'react-router-dom'
import Campanha from './pages/Campanha.tsx'
import PromptManage from './pages/PromptManage.tsx'
import './services/openai/test.ts' // Importa o teste para disponibilizar no console

function Home() {
  const [campanha, setCampanha] = useState('')
  const navigate = useNavigate()

  const go = (e) => {
    e.preventDefault()
    const nome = campanha.trim()
    if (!nome) return
    navigate(`/${encodeURIComponent(nome)}`)
  }

  return (
    <div style={{ maxWidth: 720, margin: '2rem auto', padding: '1rem' }}>
      <h1>Bem-vindo</h1>
      <p>Digite o nome da campanha e abra a página dedicada.</p>
      <form onSubmit={go} className="card" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <input
          type="text"
          placeholder="Ex.: blackfriday"
          value={campanha}
          onChange={(e) => setCampanha(e.target.value)}
        />
        <button type="submit">Abrir campanha</button>
      </form>
      <p className="read-the-docs">Você também pode ir direto para <code>/:campanha</code>.</p>
    </div>
  )
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/:campanha" element={<Campanha />} />
      <Route path="/gerenciar/prompt" element={<PromptManage />} />
    </Routes>
  )
}

export default App
