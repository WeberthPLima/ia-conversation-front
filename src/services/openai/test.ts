import { OpenAIDirectWS } from './openaiDirect';

// Teste básico da conexão direta com OpenAI
export async function testOpenAIConnection() {
  console.log('🧪 Testando conexão direta com OpenAI...');
  
  const client = new OpenAIDirectWS();
  
  // Configura handlers de eventos
  client.onOpen = () => {
    console.log('✅ Conectado com sucesso ao OpenAI!');
    
    // Configura a sessão
    client.configureSession({
      instructions: 'Você é um assistente útil. Responda sempre em português brasileiro de forma concisa.',
      voice: 'alloy'
    });
    
    // Envia uma mensagem de teste
    setTimeout(() => {
      client.sendUserText('Olá! Você pode me responder em português?');
    }, 1000);
  };
  
  client.onMessage = (message) => {
    console.log('📨 Mensagem recebida:', message);
    
    // Se recebeu uma resposta de áudio, mostra informações
    if (message.type === 'response.audio.delta') {
      console.log('🔊 Áudio recebido (delta)');
    }
    
    // Se recebeu texto, mostra
    if (message.type === 'response.text.delta') {
      console.log('💬 Texto:', message.delta);
    }
    
    // Se a resposta foi finalizada
    if (message.type === 'response.done') {
      console.log('✅ Resposta completa recebida!');
      
      // Desconecta após 2 segundos
      setTimeout(() => {
        client.disconnect();
        console.log('🔌 Desconectado do OpenAI');
      }, 2000);
    }
  };
  
  client.onError = (error) => {
    console.error('❌ Erro na conexão:', error);
  };
  
  client.onClose = (code, reason) => {
    console.log(`🔌 Conexão fechada: ${code} - ${reason}`);
  };
  
  try {
    await client.connect();
  } catch (error) {
    console.error('❌ Falha ao conectar:', error);
  }
}

// Função para testar no console do navegador
(window as any).testOpenAI = testOpenAIConnection;