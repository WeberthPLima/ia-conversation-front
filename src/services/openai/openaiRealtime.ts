/**
 * Serviço de conversação via WebSocket
 *
 * Este cliente espera um gateway WebSocket (no seu backend) que faça a ponte
 * com a OpenAI Realtime API. Do front, você NÃO deve expor sua API key.
 *
 * Configure `VITE_WS_GATEWAY_URL` no `.env` apontando para o seu backend WS.
 * O gateway deve traduzir estas mensagens para o protocolo da OpenAI.
 */

export type OpenAIWSMessage = { type: string; data?: any };

export type EventHandlers = {
  onOpen?: () => void;
  onClose?: (e: CloseEvent) => void;
  onError?: (e: Event) => void;
  onMessage?: (msg: OpenAIWSMessage) => void;
};

export class OpenAIRealtimeWS {
  private ws?: WebSocket;
  private url: string;
  private model: string;
  private handlers: EventHandlers;

  constructor(opts?: { url?: string; model?: string; handlers?: EventHandlers }) {
    const viteGateway = import.meta.env.VITE_WS_GATEWAY_URL as string | undefined;
    const viteRealtime = import.meta.env.VITE_OPENAI_REALTIME_URL as string | undefined;
    const viteApiBase = (import.meta.env.VITE_API_BASE_URL as string | undefined) || (import.meta.env.VITE_OPENAI_API_BASE_URL as string | undefined);

    // Prioriza: opts.url > VITE_WS_GATEWAY_URL > VITE_OPENAI_REALTIME_URL > VITE_API_BASE_URL > fallback
    this.url = opts?.url ?? viteGateway ?? viteRealtime ?? viteApiBase ?? 'ws://localhost:3000/ws';
    this.model = opts?.model ?? (import.meta.env.VITE_OPENAI_MODEL || 'gpt-4o-realtime-preview');
    this.handlers = opts?.handlers ?? {};
  }

  connect() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;
    console.log('OpenAIRealtimeWS: conectando a', this.url);
    this.ws = new WebSocket(this.url);

    this.ws.addEventListener('open', () => {
      this.handlers.onOpen?.();
      // Opcional: informe o modelo ao gateway para configurar a sessão
      this.send({ type: 'session.configure', data: { model: this.model } });
    });

    this.ws.addEventListener('message', (event) => {
      try {
        const parsed = JSON.parse(event.data);
        this.handlers.onMessage?.(parsed);
      } catch {
        this.handlers.onMessage?.({ type: 'raw', data: event.data });
      }
    });

    this.ws.addEventListener('error', (e) => this.handlers.onError?.(e));
    this.ws.addEventListener('close', (e) => {
      console.log('OpenAIRealtimeWS: conexão fechada', e.code, e.reason);
      this.handlers.onClose?.(e);
    });
  }

  disconnect(code?: number, reason?: string) {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      this.ws.close(code ?? 1000, reason);
    }
    this.ws = undefined;
  }

  private ensureOpen() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket não está conectado. Chame connect() primeiro.');
    }
  }

  send(payload: OpenAIWSMessage) {
    this.ensureOpen();
    this.ws!.send(JSON.stringify(payload));
  }

  /** Inicia uma conversa (pode enviar um prompt de sistema opcional) */
  startConversation(system?: string) {
    this.send({ type: 'chat.start', data: { system, model: this.model } });
  }

  /** Envia texto do usuário para a conversa */
  sendUserText(text: string) {
    this.send({ type: 'chat.user_text', data: { text } });
  }

  /**
   * Envia áudio em PCM 16-bit (base64) do usuário.
   * O gateway deve converter para o formato esperado pela OpenAI.
   */
  sendAudioPCMBase64(base64PCM: string, sampleRate: number = 16000) {
    this.send({ type: 'chat.user_audio_pcm', data: { pcm_base64: base64PCM, sample_rate: sampleRate } });
  }

  /** Finaliza a conversa */
  endConversation() {
    this.send({ type: 'chat.end' });
  }
}

export const createOpenAIRealtimeWS = (handlers?: EventHandlers, url?: string, model?: string) =>
  new OpenAIRealtimeWS({ handlers, url, model });