const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizePrintLayoutConfig } = require('../src/main/printLayoutConfig');

test('inclui o layout padrão de produtos configuráveis em configurações antigas', () => {
  const layout = normalizePrintLayoutConfig({
    customer: { paperWidthMm: 58 },
    kitchen: {},
  });

  assert.equal(layout.customer.configurableItems.variation_label, 'TAMANHO');
  assert.equal(layout.customer.configurableItems.observation_title, 'OBSERVAÇÃO');
  assert.equal(layout.kitchen.configurableItems.font_scale, 'normal');
  assert.equal(layout.customer.itemOptions.boxEachItem, false);
  assert.equal(layout.kitchen.itemOptions.boxEachItem, false);
});

test('normaliza os campos de produtos configuráveis salvos pelo agente', () => {
  const layout = normalizePrintLayoutConfig({
    customer: {
      configurableItems: {
        variation_label: '  MODELO  ',
        observation_title: '  RECADO  ',
        observation_style: 'plain',
        font_scale: 'large',
        show_fractions: false,
      },
    },
  });

  assert.equal(layout.customer.configurableItems.variation_label, 'MODELO');
  assert.equal(layout.customer.configurableItems.observation_title, 'RECADO');
  assert.equal(layout.customer.configurableItems.observation_style, 'plain');
  assert.equal(layout.customer.configurableItems.font_scale, 'large');
  assert.equal(layout.customer.configurableItems.show_fractions, false);
});

test('normaliza a opção de colocar cada produto em uma caixa por tipo de comanda', () => {
  const layout = normalizePrintLayoutConfig({
    customer: { itemOptions: { boxEachItem: true } },
    kitchen: { itemOptions: { boxEachItem: false } },
  });

  assert.equal(layout.customer.itemOptions.boxEachItem, true);
  assert.equal(layout.kitchen.itemOptions.boxEachItem, false);
});
