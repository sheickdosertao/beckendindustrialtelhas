const express = require('express');
const cors = require('cors');
const mercadopago = require('mercadopago');

const app = express();
app.use(cors());
app.use(express.json());

// Substitua pelo seu access_token do Mercado Pago
mercadopago.configure({
  access_token: 'SEU_ACCESS_TOKEN'
});

app.post('/api/mercadopago-preferencia', async (req, res) => {
  try {
    const itens = req.body.itens.map(p => ({
      title: p.nome,
      quantity: p.qtd,
      currency_id: 'BRL',
      unit_price: p.preco
    }));

    const preference = await mercadopago.preferences.create({ items: itens });
    res.json({ id: preference.body.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao criar preferência' });
  }
});

// Porta do backend (pode ser 3000, 5000, etc)
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Backend rodando em http://localhost:${PORT}`);
});