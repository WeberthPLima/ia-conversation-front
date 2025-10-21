import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export default function Campanha() {
  const { campanha } = useParams();
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchPrompt() {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`${API_URL}/prompt/${encodeURIComponent(campanha)}`);
        if (!res.ok) {
          throw new Error(`Erro ${res.status}: ${res.statusText}`);
        }
        // Tenta interpretar como JSON; se falhar, lê como texto
        let texto = '';
        try {
          const data = await res.json();
          texto = data?.prompt ?? '';
        } catch {
          texto = await res.text();
        }
        setPrompt(texto);
      } catch (err) {
        setError(err.message || 'Falha ao buscar o prompt');
      } finally {
        setLoading(false);
      }
    }

    fetchPrompt();
  }, [campanha]);

  if (loading) return <p>Carregando...</p>;
  if (error) return <p style={{ color: 'red' }}>Erro: {error}</p>;

  return (
    <div style={{ maxWidth: 720, margin: '2rem auto', padding: '1rem' }}>
      <h2>Campanha: {campanha}</h2>
      <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: '#f4f4f4', padding: '1rem', borderRadius: 8 }}>
        {prompt || 'Nenhum conteúdo em "prompt".'}
      </pre>
    </div>
  );
}