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
  assert.doesNotMatch(html, /group-title/);
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
