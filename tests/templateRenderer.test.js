const test = require('node:test');
const assert = require('node:assert/strict');
const { fractionLabel, renderItems, renderJob } = require('../src/main/templateRenderer');

const configurableItem = {
  quantidade: 1,
  nomeProduto: 'Pizza',
  nomeVariacao: 'P • 4 fatias',
  precoTotal: 32.5,
  observacoes: 'Sem cebola • massa bem assada',
  selecoes: [
    { nomeGrupo: 'Sabores', nomeOpcao: '4 Queijos', quantidade: 1, fracao: 0.5 },
    { nomeGrupo: 'Sabores', nomeOpcao: 'Abacaxi flambado', quantidade: 1, fracao: 0.5 },
  ],
};

test('formata frações comuns para a impressão térmica', () => {
  assert.equal(fractionLabel(0.5), '½');
  assert.equal(fractionLabel(0.25), '¼');
  assert.equal(fractionLabel(0.1), '1/10');
  assert.equal(fractionLabel(0.5, 'percentage'), '½');
});

test('renderiza item configurável agrupado com observação em caixa', () => {
  const html = renderItems([configurableItem], true);

  assert.match(html, /1x Pizza/);
  assert.match(html, /R\$ 32,50/);
  assert.match(html, /TAMANHO/);
  assert.match(html, /P • 4 fatias/);
  assert.match(html, /Sabores/);
  assert.equal((html.match(/class="fraction">½/g) || []).length, 2);
  assert.match(html, /config-observation box uppercase/);
  assert.match(html, /OBSERVAÇÃO/);
});

test('imprime observação por adicional e destaca borda depois do tamanho', () => {
  const html = renderItems([{
    ...configurableItem,
    selecoes: [
      { nomeGrupo: 'Sabores', nomeOpcao: '4 Queijos', observacoes: 'sem cebola', quantidade: 1 },
      { nomeGrupo: 'Adicionais', nomeOpcao: 'Borda recheada de catupiry', quantidade: 1 },
    ],
  }], false);

  assert.match(html, /TAMANHO:<\/span> P • 4 fatias \(Com borda\)/);
  assert.match(html, /4 Queijos - sem cebola/);
  assert.match(html, /Borda recheada de catupiry/);
});

test('destaca borda ao lado do produto quando a variação está oculta', () => {
  const html = renderItems([{
    ...configurableItem,
    selecoes: [{ nomeGrupo: 'Adicionais', nomeOpcao: 'BORDA cheddar', quantidade: 1 }],
  }], false, { configurable_items: { show_variation: false } });

  assert.match(html, /1x Pizza \(Com borda\)/);
});

test('respeita as preferências visuais recebidas da impressora', () => {
  const html = renderItems([configurableItem], false, {
    configurable_items: {
      variation_label: 'MODELO',
      show_group_titles: false,
      fraction_format: 'percentage',
      observation_style: 'plain',
      observation_title: 'RECADO',
      uppercase_observation: false,
    },
  });

  assert.match(html, /MODELO/);
  assert.doesNotMatch(html, /<p class="group-title/);
  assert.match(html, /½/);
  assert.doesNotMatch(html, /50%/);
  assert.match(html, /config-observation plain/);
  assert.match(html, /RECADO/);
});

test('renderiza a comanda completa sem alterar itens simples', () => {
  const html = renderJob({
    document_type: 'ORDER_CUSTOMER',
    payload: {
      printer: { paperWidthMm: 80, layoutSettings: {} },
      order: { numeroPedido: '1842', mesaNumero: '04' },
      items: [configurableItem, { quantidade: 1, nomeProduto: 'Refrigerante', precoTotal: 8, selecoes: [] }],
    },
  });

  assert.match(html, /Pedido:/);
  assert.match(html, /MESA 04/);
  assert.match(html, /1x Refrigerante/);
});

test('aplica no cupom o layout de produtos configuráveis salvo no agente', () => {
  const html = renderJob({
    document_type: 'ORDER_CUSTOMER',
    payload: {
      printer: {
        paperWidthMm: 80,
        layoutSettings: { configurable_items: { variation_label: 'CONFIGURAÇÃO ANTIGA' } },
      },
      order: { numeroPedido: '1843' },
      items: [configurableItem],
    },
  }, {
    customer: {
      configurableItems: {
        variation_label: 'MODELO LOCAL',
        show_group_titles: false,
        observation_title: 'RECADO',
        observation_style: 'plain',
        uppercase_observation: false,
        font_scale: 'large',
      },
    },
  });

  assert.match(html, /MODELO LOCAL/);
  assert.doesNotMatch(html, /CONFIGURAÇÃO ANTIGA/);
  assert.doesNotMatch(html, /<p class="group-title/);
  assert.match(html, /config-observation plain/);
  assert.match(html, /RECADO/);
  assert.match(html, /\.configurable-item \.product \{ font-size: calc\(16\.52px/);
});

test('imprime todos os pagamentos atuais e ignora os cancelados', () => {
  const html = renderJob({
    document_type: 'ORDER_CUSTOMER',
    payload: {
      order: { numeroPedido: '1844' },
      items: [],
      payments: [
        {
          formaPagamento: 'pix',
          formaPagamentoLabel: 'PIX',
          valor: 40,
          status: 'aprovado',
          statusLabel: 'Aprovado',
          pago: true,
          pagoLabel: 'PAGO',
        },
        {
          formaPagamento: 'dinheiro',
          formaPagamentoLabel: 'Dinheiro',
          valor: 60,
          status: 'pendente',
          statusLabel: 'Pendente',
          pago: false,
          pagoLabel: 'PAGAMENTO PENDENTE',
        },
        {
          formaPagamento: 'boleto',
          formaPagamentoLabel: 'Boleto antigo',
          valor: 100,
          status: 'cancelado',
          statusLabel: 'Cancelado',
        },
      ],
    },
  });

  assert.match(html, /PAGAMENTOS/);
  assert.match(html, /Forma:<\/span> PIX/);
  assert.match(html, /Valor:<\/span> R\$ 40,00/);
  assert.match(html, /Forma:<\/span> Dinheiro/);
  assert.match(html, /Valor:<\/span> R\$ 60,00/);
  assert.doesNotMatch(html, /Boleto antigo/);
});

test('coloca cada produto em uma caixa separada no cupom do cliente', () => {
  const html = renderJob({
    document_type: 'ORDER_CUSTOMER',
    payload: {
      order: { numeroPedido: '1845' },
      items: [
        { quantidade: 1, nomeProduto: 'Pizza', precoTotal: 30, selecoes: [] },
        { quantidade: 2, nomeProduto: 'Refrigerante', precoTotal: 16, selecoes: [] },
      ],
    },
  }, {
    customer: { itemOptions: { boxEachItem: true } },
  });

  assert.match(html, /\.item \{\s+border: 1px solid #000; padding: 6px;/);
  assert.equal((html.match(/<section class="item">/g) || []).length, 2);
});

test('coloca cada produto em uma caixa separada no cupom da cozinha', () => {
  const html = renderJob({
    document_type: 'ORDER_KITCHEN',
    payload: {
      order: { numeroPedido: '1846' },
      items: [configurableItem],
    },
  }, {
    kitchen: { itemOptions: { boxEachItem: true } },
  });

  assert.match(html, /\.item \{\s+border: 2px solid #000; padding: 7px;/);
  assert.match(html, /<section class="item configurable-item">/);
});
