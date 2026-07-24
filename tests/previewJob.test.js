const test = require('node:test');
const assert = require('node:assert/strict');
const previewJob = require('../src/main/previewJob');
const { renderJob } = require('../src/main/templateRenderer');

test('usa o pedido completo solicitado no preview do layout', () => {
  const customerPreview = previewJob('customer');
  const kitchenPreview = previewJob('kitchen');
  const { items, totals, payment } = customerPreview.payload;

  assert.equal(customerPreview.document_type, 'ORDER_CUSTOMER');
  assert.equal(kitchenPreview.document_type, 'ORDER_KITCHEN');
  assert.equal(items.length, 4);
  assert.deepEqual(items.map((item) => ({
    quantidade: item.quantidade,
    nomeProduto: item.nomeProduto,
    precoTotal: item.precoTotal,
  })), [
    { quantidade: 1, nomeProduto: 'Pizza', precoTotal: 77.5 },
    { quantidade: 1, nomeProduto: 'Pizza Aurora Mussarela 440g', precoTotal: 17.9 },
    { quantidade: 1, nomeProduto: 'Refrigerante Coca-Cola 1,5L', precoTotal: 6.79 },
    { quantidade: 1, nomeProduto: 'Refrigerante Coca-Cola Original 2,5L', precoTotal: 11.49 },
  ]);
  assert.equal(items[0].nomeVariacao, 'XG - 12 Fatias');
  assert.equal(items[0].observacoes, 'Quero ela quentinha e fresquinha');
  assert.deepEqual(items[0].selecoes.map((selection) => ({
    nomeGrupo: selection.nomeGrupo,
    nomeOpcao: selection.nomeOpcao,
    observacoes: selection.observacoes,
    fracao: selection.fracao,
    fracaoLabel: selection.fracaoLabel,
  })), [
    { nomeGrupo: 'Sabores', nomeOpcao: '4 Queijos Especial', observacoes: 'Com cebola', fracao: 0.25, fracaoLabel: '25%' },
    { nomeGrupo: 'Sabores', nomeOpcao: 'Atum', observacoes: 'Sem picles', fracao: 0.25, fracaoLabel: '25%' },
    { nomeGrupo: 'Sabores', nomeOpcao: 'Chocolate Branco', observacoes: 'Com bastante chocolate', fracao: 0.25, fracaoLabel: '25%' },
    { nomeGrupo: 'Sabores', nomeOpcao: 'Frango Fricasse', observacoes: 'Sem milho e ervilha', fracao: 0.25, fracaoLabel: '25%' },
  ]);
  assert.equal(totals.subtotalLabel, 'Subtotal dos pedidos lançados');
  assert.equal(totals.subtotal, 113.68);
  assert.equal(totals.total, 113.68);
  assert.equal(payment.valor, 113.68);

  const html = renderJob(customerPreview);
  assert.match(html, /Pizza Aurora Mussarela 440g/);
  assert.match(html, /Refrigerante Coca-Cola 1,5L/);
  assert.match(html, /Refrigerante Coca-Cola Original 2,5L/);
  assert.match(html, /4 Queijos Especial - Com cebola \(25%\)/);
  assert.match(html, /Frango Fricasse - Sem milho e ervilha \(25%\)/);
  assert.match(html, /Quero ela quentinha e fresquinha/);
  assert.match(html, /Subtotal dos pedidos lançados/);
  assert.match(html, /R\$ 113,68/);
});
