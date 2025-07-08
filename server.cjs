const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv'); // Para gerenciar variáveis de ambiente
dotenv.config(); // Carrega as variáveis do arquivo .env

const { MercadoPagoConfig, Preference, Payment } = require('mercadopago'); // Importe 'Preference' aqui
const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN,
  options: {
    timeout: 5000
  }
});

const preferenceClient = new Preference(client);
const paymentClient = new Payment(client);

const app = express();
// Configuração do CORS: Muito importante para a segurança e para permitir que seu frontend se conecte
// Use o domínio do seu frontend. Se for testar localmente, pode adicionar 'http://localhost:XXXX'
const allowedOrigins = [
  'https://www.telhasindustrial.com',
  'http://localhost:3000', // Exemplo para desenvolvimento local do frontend
  'http://localhost:5173', // Exemplo para frameworks como Vite/Vue/React
  'http://127.0.0.1:5500',
  'http://127.0.0.1:52360',
  // Adicione outros domínios de teste/produção se necessário
];

app.use(cors({
  origin: function (origin, callback) {
    // Permite requisições sem 'origin' (ex: mobile apps, ferramentas como Postman)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'], // Métodos HTTP permitidos
  allowedHeaders: ['Content-Type', 'Authorization'], // Cabeçalhos permitidos
}));

app.use(express.json()); // Para parsear JSON no corpo das requisições

// --- Variáveis de Ambiente ---
// É CRUCIAL usar variáveis de ambiente para credenciais!
// Crie um arquivo .env na raiz do seu projeto com:
// MERCADOPAGO_ACCESS_TOKEN=TEST-f1a7d36c-0bac-4e2e-bcf3-120a2d515f4e
// BACKEND_BASE_URL=https://seubackend.render.com (ou outro domínio do seu backend)
// FRONTEND_BASE_URL=https://www.telhasindustrial.com



// --- Rota para Criar Preferência de Pagamento ---
app.post('/api/mercadopago-preferencia', async (req, res) => {
  try {
    // *** CORREÇÃO AQUI: Adicione payerName e payerSurname à desestruturação ***
    const { items, payerEmail, payerName, payerSurname, externalReference } = req.body;

    const itensMapeados = items.map(p => ({
      title: p.nome,
      quantity: Number(p.qtd),
      currency_id: 'BRL',
      unit_price: Number(p.preco)
    }));

    const backendBaseUrl = process.env.BACKEND_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
    const frontendBaseUrl = process.env.FRONTEND_BASE_URL || 'http://localhost:3000';

    const preferenceBody = {
      items: itensMapeados,
      payer: {
        email: payerEmail,
        // *** MELHOR PRÁTICA: Use first_name e last_name para o Mercado Pago ***
        first_name: payerName,   // Mapeando payerName do frontend para first_name da API
        last_name: payerSurname, // Mapeando payerSurname do frontend para last_name da API
      },
      back_urls: {
        success: `${frontendBaseUrl}/pagamento/sucesso.html`,
        failure: `${frontendBaseUrl}/pagamento/falha.html`,
        pending: `${frontendBaseUrl}/pagamento/pendente.html`,
      },
      auto_return: "approved",
      notification_url: `${backendBaseUrl}/api/mercadopago-webhook`,
      external_reference: externalReference || `pedido-${Date.now()}`,
    };

    const response = await preferenceClient.create({ body: preferenceBody });
    res.json({ id: response.id, init_point: response.init_point });

  } catch (err) {
    console.error('Erro ao criar preferência de pagamento:', err.message);
    res.status(500).json({ error: 'Erro ao criar preferência de pagamento', details: err.message });
  }
});

// --- Rota para Webhook/IPN (Notificações de Pagamento) ---
// Esta rota receberá as notificações do Mercado Pago sobre o status dos pagamentos.
// É AQUI que você deve atualizar o status do pedido no seu banco de dados!
app.post('/api/mercadopago-webhook', async (req, res) => {
  const { type, data } = req.body; // O Mercado Pago envia 'type' e 'data'

  console.log(`Webhook recebido - Tipo: ${type}`);

  if (type === 'payment') {
    const paymentId = data.id; // ID do pagamento no Mercado Pago

    try {
      // Obtenha os detalhes completos do pagamento usando o ID
            // Crie a instância de Payment
            const payment = await paymentClient.get({ id: paymentId }); // Use a instância 'paymentClient'
            const paymentStatus = payment.status;
            const externalReference = payment.external_reference;
    console.log(`Webhook: Pagamento ID: ${paymentId}, Status: ${paymentStatus}, Ref Externa: ${externalReference}`);
      // --- LÓGICA DE NEGÓCIO CRÍTICA AQUI ---
      // 1. Encontre o pedido no seu banco de dados usando 'externalReference'.
      // 2. Atualize o status do pedido no seu banco de dados com 'paymentStatus'.
      // 3. Se 'approved', inicie o processamento do pedido (ex: envio de e-mail de confirmação, liberação de produto).
      // 4. Se 'rejected' ou 'pending', trate de acordo.

      // Exemplo de como você faria (apenas pseudo-código):
      
      const pedido = await seuBancoDeDados.findPedidoByExternalReference(externalReference);
      if (pedido) {
        pedido.statusPagamento = paymentStatus;
        await seuBancoDeDados.updatePedido(pedido);
        if (paymentStatus === 'approved') {
          console.log('Pagamento aprovado! Pedido pronto para processamento.');
          // Enviar e-mail, atualizar estoque, etc.
        } else if (paymentStatus === 'pending') {
          console.log('Pagamento pendente. Aguardando confirmação.');
        } else if (paymentStatus === 'rejected') {
          console.log('Pagamento rejeitado. Informar cliente.');
        }
      }
      

      res.sendStatus(200); // Responda 200 OK para o Mercado Pago para indicar que a notificação foi recebida
    } catch (err) {
      console.error('Erro ao processar webhook de pagamento:', err.message);
      res.sendStatus(500); // Responda com erro se algo der errado
    }
  } else if (type === 'plan') {
    // Notificação de plano, se você usar assinaturas
    console.log('Webhook de plano recebido:', data);
    res.sendStatus(200);
  } else if (type === 'invoice') {
    // Notificação de fatura
    console.log('Webhook de fatura recebido:', data);
    res.sendStatus(200);
  } else {
    console.log('Webhook de tipo desconhecido recebido:', type, data);
    res.sendStatus(200); // Sempre responda 200 para o Mercado Pago evitar retentativas excessivas
  }
});


// --- Rota de Teste Simples ---
// Apenas para verificar se o backend está online
app.get('/api/status', (req, res) => {
  res.json({ status: 'online', message: 'Backend da Industrial Telhas funcionando!' });
});

// Porta do backend (use variável de ambiente em produção)
const PORT = process.env.PORT || 3001; // Use 3001 ou outra para não conflitar com o frontend local 3000
app.listen(PORT, () => {
  console.log(`Backend rodando em http://localhost:${PORT}`);
 
});