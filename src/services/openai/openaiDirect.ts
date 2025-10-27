import WebSocket from 'ws';

export interface OpenAIDirectOptions {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}

export interface OpenAIMessage {
  type: string;
  [key: string]: any;
}

export class OpenAIDirectWS {
  private ws: WebSocket | null = null;
  private apiKey: string;
  private baseUrl: string;
  private model: string;
  private isConnected = false;
  private messageQueue: OpenAIMessage[] = [];

  public onOpen?: () => void;
  public onMessage?: (message: OpenAIMessage) => void;
  public onError?: (error: Error) => void;
  public onClose?: (code: number, reason: string) => void;

  constructor(options: OpenAIDirectOptions = {}) {
    this.apiKey = options.apiKey ?? import.meta.env.VITE_OPENAI_API_KEY ?? '';
    this.baseUrl = options.baseUrl ?? import.meta.env.VITE_OPENAI_API_BASE_URL ?? 'wss://api.openai.com/v1/realtime';
    this.model = options.model ?? import.meta.env.VITE_OPENAI_MODEL ?? 'gpt-4o-realtime-preview';

    if (!this.apiKey) {
      throw new Error('OpenAI API Key é obrigatória. Configure VITE_OPENAI_API_KEY ou passe via options.apiKey');
    }
  }

  async connect(): Promise<void> {
    if (this.isConnected || this.ws) {
      console.warn('WebSocket já está conectado ou em processo de conexão');
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        const url = `${this.baseUrl}?model=${encodeURIComponent(this.model)}`;
        
        this.ws = new WebSocket(url, {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'OpenAI-Beta': 'realtime=v1',
          },
        });

        this.ws.on('open', () => {
          console.log('Conectado ao OpenAI Realtime API');
          this.isConnected = true;
          
          this.processMessageQueue();
          
          if (this.onOpen) {
            this.onOpen();
          }
          resolve();
        });

        this.ws.on('message', (data: WebSocket.Data) => {
          try {
            const message = JSON.parse(data.toString()) as OpenAIMessage;
            console.log('Mensagem recebida do OpenAI:', message);
            
            if (this.onMessage) {
              this.onMessage(message);
            }
          } catch (error) {
            console.error('Erro ao parsear mensagem do OpenAI:', error);
            if (this.onError) {
              this.onError(error as Error);
            }
          }
        });

        this.ws.on('error', (error: Error) => {
          console.error('Erro no WebSocket OpenAI:', error);
          if (this.onError) {
            this.onError(error);
          }
          reject(error);
        });

        this.ws.on('close', (code: number, reason: Buffer) => {
          console.log(`WebSocket OpenAI fechado: ${code} - ${reason.toString()}`);
          this.isConnected = false;
          this.ws = null;
          
          if (this.onClose) {
            this.onClose(code, reason.toString());
          }
        });

      } catch (error) {
        console.error('Erro ao criar WebSocket:', error);
        reject(error);
      }
    });
  }

  /**
   * Desconecta do OpenAI
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.isConnected = false;
    }
  }

  /**
   * Envia mensagem para o OpenAI
   */
  sendMessage(message: OpenAIMessage): void {
    if (!this.isConnected || !this.ws) {
      console.warn('WebSocket não conectado. Adicionando mensagem à fila.');
      this.messageQueue.push(message);
      return;
    }

    try {
      this.ws.send(JSON.stringify(message));
      console.log('Mensagem enviada para OpenAI:', message);
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      if (this.onError) {
        this.onError(error as Error);
      }
    }
  }

  /**
   * Processa fila de mensagens pendentes
   */
  private processMessageQueue(): void {
    while (this.messageQueue.length > 0 && this.isConnected) {
      const message = this.messageQueue.shift();
      if (message) {
        this.sendMessage(message);
      }
    }
  }

  configureSession(config: any): void {
    this.sendMessage({
      type: 'session.update',
      session: {
        modalities: ['text', 'audio'],
        instructions: 'Você é um assistente útil. Responda sempre em português brasileiro.',
        voice: 'alloy',
        temperature: 0.7,
        input_audio_format: 'pcm16',
        output_audio_format: 'pcm16',
        input_audio_transcription: {
          model: 'gpt-4o-transcribe'
        },
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 200
        },
        ...config
      }
    });
  }

  /**
   * Inicia uma nova conversa
   */
  startConversation(): void {
    this.sendMessage({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: 'Olá! Estou pronto para conversar.'
          }
        ]
      }
    });

    this.sendMessage({
      type: 'response.create'
    });
  }

  /**
   * Envia texto do usuário
   */
  sendUserText(text: string): void {
    this.sendMessage({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: text
          }
        ]
      }
    });

    this.sendMessage({
      type: 'response.create'
    });
  }

  /**
   * Envia áudio PCM em base64
   */
  sendUserAudio(audioBase64: string): void {
    this.sendMessage({
      type: 'input_audio_buffer.append',
      audio: audioBase64
    });
  }

  /**
   * Finaliza o buffer de áudio
   */
  commitAudio(): void {
    this.sendMessage({
      type: 'input_audio_buffer.commit'
    });

    this.sendMessage({
      type: 'response.create'
    });
  }

  /**
   * Cancela a resposta atual
   */
  cancelResponse(): void {
    this.sendMessage({
      type: 'response.cancel'
    });
  }

  /**
   * Verifica se está conectado
   */
  get connected(): boolean {
    return this.isConnected;
  }
}

// Instância padrão
export const openaiDirect = new OpenAIDirectWS();