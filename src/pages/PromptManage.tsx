import { useEffect, useMemo, useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

type PromptItem = Record<string, any> & {
  id?: string;
  key?: string;
  name?: string;
  campanha?: string;
  type?: string;
  voice?: string;
  aiName?: string;
  temperature?: number | null;
  prompt?: string;
  created_at?: string;
  updated_at?: string;
};

function normalizeResponse(data: any): PromptItem[] {
  if (!data) return [];
  if (Array.isArray(data)) return data as PromptItem[];
  if (data?.prompts && Array.isArray(data.prompts)) return data.prompts as PromptItem[];
  // Fallback: se vier objeto, use os valores
  if (typeof data === 'object') return Object.values(data) as PromptItem[];
  return [];
}

function short(text?: string, len = 80) {
  if (!text) return '';
  const t = String(text);
  return t.length > len ? t.slice(0, len) + '…' : t;
}

function getValueForColumn(it: PromptItem, col: string) {
  if (col === 'campanha') {
    return it.campanha ?? it.name ?? it.key ?? it.id ?? '';
  }
  if (col === 'type') {
    return it.type ?? '';
  }
  return it[col] ?? '';
}

export default function PromptManage() {
  const [items, setItems] = useState<PromptItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // Modal e formulário
  const [selected, setSelected] = useState<PromptItem | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<{ campanha: string; prompt: string; temperature: string; type: string; voice: string; aiName: string }>({
    campanha: '',
    prompt: '',
    temperature: '0.8',
    type: 'chat',
    voice: 'shimmer',
    aiName: '',
  });

  async function load() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/prompts`);
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`Falha ao buscar prompts (${res.status}): ${res.statusText}${body ? ` — ${body}` : ''}`);
      }
      const json = await res.json();
      setItems(normalizeResponse(json));
    } catch (e: any) {
      setError(e?.message || 'Erro ao carregar prompts');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  // Mostrar apenas as colunas "campanha" e "type"
  const columns = useMemo(() => ['campanha', 'type'], []);

  function onRowClick(it: PromptItem) {
    setSelected(it);
    const campanhaVal = String(getValueForColumn(it, 'campanha') ?? '');
    setForm({
      campanha: campanhaVal,
      prompt: String(it.prompt ?? ''),
      temperature: String(it.temperature ?? '0.8'),
      type: String(it.type ?? 'chat'),
      voice: String(it.voice ?? 'shimmer'),
      aiName: String(it.aiName ?? ''),
    });
    setShowModal(true);
  }

  async function savePrompt() {
    setSaving(true);
    setError('');
    try {
      const tempNum = parseFloat(form.temperature);
      const payload: any = {
        campanha: form.campanha,
        prompt: form.prompt,
        temperature: Number.isFinite(tempNum) ? tempNum : null,
        type: form.type,
        voice: form.voice,
        aiName: form.aiName,
      };
      // Inclui um identificador se houver (pode ajudar o backend a diferenciar create/update)
      if (selected?.id) payload.id = selected.id;
      else if (selected?.key) payload.key = selected.key;

      const res = await fetch(`${API_URL}/prompts/${selected?.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`Falha ao salvar (${res.status}): ${res.statusText}${body ? ` — ${body}` : ''}`);
      }
      setShowModal(false);
      setSelected(null);
      await load();
    } catch (e: any) {
      setError(e?.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ width: '100vw', maxWidth: '1280px', margin: '2rem auto', padding: '1rem', backgroundColor: '#f9fafb' }}>
      <h2 style={{ color: '#333', marginBottom: 12 }}>Gerenciar Prompts</h2>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
        <button onClick={load} disabled={loading}>{loading ? 'Atualizando…' : 'Atualizar'}</button>
      </div>
      {error && (
        <div style={{ background: '#ffecec', color: 'red', padding: 12, borderRadius: 8, marginBottom: 12 }}>
          {error}
        </div>
      )}
      {!loading && items.length === 0 && !error && (
        <div style={{ color: '#666' }}>Nenhum prompt encontrado.</div>
      )}
      <div style={{ overflowX: 'auto', color: '#333', width: '100%', }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c} style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: '8px 6px', textTransform: 'uppercase' }}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((it, idx) => (
              <tr key={idx} onClick={() => onRowClick(it)} style={{ cursor: 'pointer' }}>
                {columns.map((c) => {
                  const val = getValueForColumn(it, c);
                  return (
                    <td key={`${idx}-${c}`} style={{ textAlign: 'left', borderBottom: '1px solid #eee', padding: '8px 6px', verticalAlign: 'left' }}>
                      {String(val ?? '')}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'left', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#ffffff', color: '#1f2937', padding: 20, borderRadius: 12, width: 680, maxWidth: '90vw', boxShadow: '0 20px 50px rgba(0,0,0,0.35)', border: '1px solid rgba(0,0,0,0.08)' }}>
            <h3 style={{ margin: 0, marginBottom: 12, fontSize: 20, fontWeight: 600, color: '#111827' }}>Editar Prompt</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: 0.2 }}>campanha</span>
                <input type="text" value={form.campanha} onChange={(e) => setForm({ ...form, campanha: e.target.value })} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db', background: '#f9fafb', color: '#111827' }} />
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: 0.2 }}>prompt</span>
                <textarea rows={6} value={form.prompt} onChange={(e) => setForm({ ...form, prompt: e.target.value })} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db', background: '#f9fafb', color: '#111827', resize: 'vertical' }} />
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: 0.2 }}>temperature</span>
                <input type="number" step="0.1" value={form.temperature} onChange={(e) => setForm({ ...form, temperature: e.target.value })} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db', background: '#f9fafb', color: '#111827' }} />
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: 0.2 }}>type</span>
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db', background: '#f9fafb', color: '#111827' }}>
                  <option value="form">form</option>
                  <option value="webapp">webapp</option>
                  <option value="chat">chat</option>
                </select>
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: 0.2 }}>voice</span>
                <select value={form.voice} onChange={(e) => setForm({ ...form, voice: e.target.value })} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db', background: '#f9fafb', color: '#111827' }}>
                  <option value="alloy">Alloy</option>
                  <option value="ash">Ash</option>
                  <option value="ballad">Ballad</option>
                  <option value="cedar">Cedar</option>
                  <option value="coral">Coral</option>
                  <option value="echo">Echo</option>
                  <option value="marin">Marin</option>
                  <option value="sage">Sage</option>
                  <option value="shimmer">Shimmer</option>
                  <option value="verse">Verse</option>
                </select>
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: 0.2 }}>aiName</span>
                <input type="text" value={form.aiName} onChange={(e) => setForm({ ...form, aiName: e.target.value })} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db', background: '#f9fafb', color: '#111827' }} />
              </label>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button onClick={() => { setShowModal(false); setSelected(null); }} disabled={saving} style={{ background: '#f3f4f6', border: '1px solid #e5e7eb', color: '#111827', padding: '8px 12px', borderRadius: 8 }}>Cancelar</button>
              <button onClick={savePrompt} disabled={saving} style={{ background: '#2563eb', border: '1px solid #1d4ed8', color: '#ffffff', padding: '8px 12px', borderRadius: 8 }}>{saving ? 'Salvando…' : 'Salvar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}