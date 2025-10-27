import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { saveExperience } from '../services/experience'
import { io, Socket } from 'socket.io-client';

export default function FormCadastro() {
  const { campanha } = useParams()
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

  const socketRef = useRef<Socket | null>(null);
  useEffect(() => {
    if (socketRef.current) {
      socketRef.current.emit('openia:close', { campanha });
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    const backendUrl = (import.meta.env.VITE_API_URL as string) ?? 'http://localhost:3002';

    const socket = io(backendUrl, {
      transports: ['websocket'],
      forceNew: true,
      timeout: 10000,
      reconnection: true,
      reconnectionAttempts: 300000,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Socket conectado:', socket.id, 'campanha:', campanha);
      console.log('Transporte usado:', socket.io.engine.transport.name);
      socket.emit('openia:open', { campanha });
    });

    // socket.on('openia:open:ack', (d) => console.log('open ack', d));
    // socket.on('openia:status', (d) => console.log('status', d));
    // socket.on('openia:event', (d) => console.log('evento', d));

    // socket.on('openia:saveForm:received', (payload) => {
    //   console.log('Form recebido na campanha:', payload);
    // });

    return () => {
      socket.emit('openia:close', { campanha });
      socket.disconnect();
    };
  }, [campanha]);

  const [form, setForm] = useState({
    cpf: '',
    nomeCompleto: '',
    email: '',
    telefone: '',
    dataNascimento: '',
    areaAtuacao: '',
    idioma: 'pt',
    autorizado: false,
  })
  const [error, setError] = useState<string>('')

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.autorizado) return
    const nome = (campanha ?? '').trim()
    if (!nome) {
      alert('Campanha não informada.')
      return
    }
    try {
      await saveExperience(nome, {
        cpf: form.cpf,
        nomeCompleto: form.nomeCompleto,
        email: form.email,
        telefone: form.telefone,
        dataNascimento: form.dataNascimento,
        areaAtuacao: form.areaAtuacao,
        idioma: form.idioma,
        autorizado: form.autorizado,
      })
      alert('Cadastro finalizado!')
      const data = {
        nomeCompleto: form.nomeCompleto,
        idioma: form.idioma,
      }
      socketRef.current?.emit('openia:saveForm', { campanha, data });
    } catch (err: any) {
      alert(err?.message || 'Falha ao salvar a experiência')
    }
  }
  const titleStyle: React.CSSProperties = { color: '#007bc2', fontFamily: 'BBTitleBold' }
  const fieldStyle: React.CSSProperties = { padding: 10, borderRadius: 8, border: '1px solid #007bc2', background: '#ffffff', color: '#007bc2' }
  const cardStyle: React.CSSProperties = { background: '#ffffff', border: '2px solid #007bc2' }

  useEffect(() => {
    const nome = (campanha ?? '').trim()
    if (!nome) {
      setError('Campanha não informada.')
      return
    }
    setError('')
      ; (async () => {
        try {
          const res = await fetch(`${API_URL}/prompt/${encodeURIComponent(nome)}`)
          if (res.status === 404) {
            setError('Conteúdo da campanha não encontrado (404).')
            return
          }
          if (!res.ok) {
            let body = ''
            try { body = await res.text() } catch { }
            setError(`Falha ao consultar a campanha (${res.status}): ${res.statusText}${body ? ` — ${body}` : ''}`)
            return
          }
          // ok: validação feita
        } catch (err: any) {
          setError(err?.message || 'Falha ao consultar a campanha')
        }
      })()
  }, [campanha])

  return (
    <div className="campanha-page">
      <div className="campanha-content" style={{ background: '#ffffff', border: '2px solid #007bc2' }}>
        <h2 style={titleStyle}>Preencha o formulário abaixo para iniciar a experiência com a Árvore BB.</h2>
        {error ? (
          <div role="alert" style={{ color: '#d32f2f', fontFamily: 'BBTitleBold', marginBottom: 12 }}>
            {error}
          </div>
        ) : (
          <form onSubmit={onSubmit} style={{ display: 'grid', gap: 12 }}>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={titleStyle}>CPF</span>
              <input
                type="text"
                value={form.cpf}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, '').slice(0, 11)
                  const part1 = digits.slice(0, 3)
                  const part2 = digits.slice(3, 6)
                  const part3 = digits.slice(6, 9)
                  const part4 = digits.slice(9, 11)
                  let formatted = part1
                  if (part2) formatted += '.' + part2
                  if (part3) formatted += '.' + part3
                  if (part4) formatted += '-' + part4
                  update('cpf', formatted)
                }}
                inputMode="numeric"
                maxLength={14}
                pattern="\d{3}\.\d{3}\.\d{3}-\d{2}"
                placeholder="000.000.000-00"
                required
                style={fieldStyle}
              />
            </label>

            <label style={{ display: 'grid', gap: 6 }}>
              <span style={titleStyle}>Nome Completo</span>
              <input type="text" value={form.nomeCompleto} onChange={(e) => update('nomeCompleto', e.target.value)} required style={fieldStyle} />
            </label>

            <label style={{ display: 'grid', gap: 6 }}>
              <span style={titleStyle}>E-mail</span>
              <input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} required style={fieldStyle} />
            </label>

            <label style={{ display: 'grid', gap: 6 }}>
              <span style={titleStyle}>Telefone (Whatsapp)</span>
              <input type="tel" value={form.telefone} onChange={(e) => update('telefone', e.target.value)} placeholder="(00) 00000-0000" required style={fieldStyle} />
            </label>

            <label style={{ display: 'grid', gap: 6 }}>
              <span style={titleStyle}>Data de nascimento</span>
              <input type="date" value={form.dataNascimento} onChange={(e) => update('dataNascimento', e.target.value)} required style={fieldStyle} />
            </label>

            <label style={{ display: 'grid', gap: 6 }}>
              <span style={titleStyle}>Área de atuação</span>
              <input type="text" value={form.areaAtuacao} onChange={(e) => update('areaAtuacao', e.target.value)} required style={fieldStyle} />
            </label>

            <label style={{ display: 'grid', gap: 6 }}>
              <span style={titleStyle}>Selecione o Idioma</span>
              <select value={form.idioma} onChange={(e) => update('idioma', e.target.value as 'pt' | 'en' | 'es')} required style={fieldStyle}>
                <option value="pt">Português</option>
                <option value="en">Inglês</option>
                <option value="es">Espanhol</option>
              </select>
            </label>

            <fieldset style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12 }}>
              <legend style={{ padding: '0 8px', ...titleStyle }}>Autorização de uso de imagem e dados</legend>
              <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <input
                  type="radio"
                  name="autorizacao"
                  checked={form.autorizado}
                  onChange={() => update('autorizado', true)}
                />
                <span style={{ color: '#333', fontFamily: 'BBTitleBold', fontSize: 10, lineHeight: '14px' }}>
                  Autorizo o uso da minha imagem para fins institucionais e concordo com a utilização dos meus dados para receber informativos, campanhas de marketing e outras comunicações.
                </span>
              </label>
            </fieldset>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
              <button
                type="submit"
                disabled={!form.autorizado}
                style={{
                  backgroundColor: '#007bc2',
                  color: '#ffffff',
                  border: '1px solid #007bc2',
                  borderRadius: 16,
                  padding: '8px 32px',
                  fontFamily: 'BBTitleBold',
                  fontWeight: 'bold'
                }}
              >
                Finalizar cadastro
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}