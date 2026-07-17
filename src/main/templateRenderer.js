function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function money(value) {
  const number = Number(value);
  return (Number.isFinite(number) ? number : 0).toFixed(2).replace('.', ',');
}

const DEFAULT_CONFIGURABLE_ITEMS_LAYOUT = Object.freeze({
  uppercase_product: true,
  show_variation: true,
  variation_label: 'TAMANHO',
  uppercase_variation: true,
  show_group_titles: true,
  uppercase_group_titles: true,
  uppercase_options: true,
  show_fractions: true,
  fraction_format: 'symbol',
  show_option_quantities: true,
  show_configuration_divider: true,
  observation_style: 'box',
  observation_title: 'OBSERVAÇÃO',
  uppercase_observation: true,
  font_scale: 'normal',
});

function configurableItemsLayout(settings = {}) {
  return {
    ...DEFAULT_CONFIGURABLE_ITEMS_LAYOUT,
    ...(settings?.configurable_items || {}),
  };
}

function greatestCommonDivisor(left, right) {
  let a = Math.abs(left);
  let b = Math.abs(right);
  while (b) [a, b] = [b, a % b];
  return a || 1;
}

function fractionLabel(value) {
  const fraction = Number(value);
  if (!Number.isFinite(fraction) || fraction <= 0 || fraction >= 1) return '';

  const symbols = [
    [1 / 2, '½'], [1 / 3, '⅓'], [2 / 3, '⅔'], [1 / 4, '¼'], [3 / 4, '¾'],
    [1 / 5, '⅕'], [2 / 5, '⅖'], [3 / 5, '⅗'], [4 / 5, '⅘'],
    [1 / 6, '⅙'], [5 / 6, '⅚'], [1 / 8, '⅛'], [3 / 8, '⅜'], [5 / 8, '⅝'], [7 / 8, '⅞'],
  ];
  const match = symbols.find(([candidate]) => Math.abs(candidate - fraction) < 0.001);
  if (match) return match[1];

  let best = { numerator: 1, denominator: 2, error: Number.POSITIVE_INFINITY };
  for (let denominator = 2; denominator <= 12; denominator += 1) {
    const numerator = Math.round(fraction * denominator);
    if (numerator <= 0 || numerator >= denominator) continue;
    const error = Math.abs(fraction - numerator / denominator);
    if (error < best.error) best = { numerator, denominator, error };
  }
  const divisor = greatestCommonDivisor(best.numerator, best.denominator);
  return `${best.numerator / divisor}/${best.denominator / divisor}`;
}

function groupSelections(selections = []) {
  const groups = [];
  const byName = new Map();
  for (const selection of selections) {
    const name = String(selection?.nomeGrupo || 'OPÇÕES').trim() || 'OPÇÕES';
    if (!byName.has(name)) {
      const group = { name, selections: [] };
      byName.set(name, group);
      groups.push(group);
    }
    byName.get(name).selections.push(selection);
  }
  return groups;
}

function renderObservation(value, layout) {
  if (!value) return '';
  const title = escapeHtml(layout.observation_title);
  const contentClass = layout.uppercase_observation ? ' uppercase' : '';
  const content = escapeHtml(value);
  if (layout.observation_style === 'plain') {
    return `<p class="config-observation plain${contentClass}"><span class="bold">${title}:</span> ${content}</p>`;
  }
  if (layout.observation_style === 'highlight') {
    return `<div class="config-observation highlight${contentClass}"><p class="observation-title">${title}</p><p>${content}</p></div>`;
  }
  return `<div class="config-observation box${contentClass}"><p class="observation-title">${title}</p><p>${content}</p></div>`;
}

function renderConfigurableItem(item, showPrices, layout) {
  const groups = groupSelections(item.selecoes || []);
  const hasDetails = (layout.show_variation && item.nomeVariacao) || groups.length > 0;
  const optionClass = layout.uppercase_options ? ' uppercase' : '';
  return `
    <section class="item">
      <div class="row product">
        <span class="${layout.uppercase_product ? 'uppercase' : ''}">${escapeHtml(item.quantidade)}x ${escapeHtml(item.nomeProduto)}</span>
        ${showPrices ? `<span>R$ ${money(item.precoTotal)}</span>` : ''}
      </div>
      ${layout.show_variation && item.nomeVariacao ? `<p class="variation${layout.uppercase_variation ? ' uppercase' : ''}"><span class="bold">${escapeHtml(layout.variation_label)}:</span> ${escapeHtml(item.nomeVariacao)}</p>` : ''}
      ${hasDetails && layout.show_configuration_divider ? '<div class="config-divider"></div>' : ''}
      ${groups.map((group) => `
        <div class="option-group">
          ${layout.show_group_titles ? `<p class="group-title${layout.uppercase_group_titles ? ' uppercase' : ''}">${escapeHtml(group.name)}</p>` : ''}
          ${group.selections.map((selection) => {
            const fraction = layout.show_fractions ? fractionLabel(selection.fracao) : '';
            const quantity = layout.show_option_quantities && Number(selection.quantidade) > 1
              ? `${escapeHtml(selection.quantidade)}x `
              : '';
            return `<p class="config-option${optionClass}">${fraction ? `<span class="fraction">${fraction}</span>` : ''}<span>${quantity}${escapeHtml(selection.nomeOpcao)}</span></p>`;
          }).join('')}
        </div>
      `).join('')}
      ${renderObservation(item.observacoes, layout)}
    </section>
  `;
}

function renderItems(items = [], showPrices, settings = {}) {
  const layout = configurableItemsLayout(settings);
  return items.map((item) => {
    const configurable = Boolean(item.nomeVariacao || (item.selecoes || []).length);
    if (configurable) return renderConfigurableItem(item, showPrices, layout);
    return `
      <section class="item">
        <div class="row product">
          <span>${escapeHtml(item.quantidade)}x ${escapeHtml(item.nomeProduto)}</span>
          ${showPrices ? `<span>R$ ${money(item.precoTotal)}</span>` : ''}
        </div>
        ${item.observacoes ? `<p class="obs">Obs: ${escapeHtml(item.observacoes)}</p>` : ''}
      </section>
    `;
  }).join('');
}

function renderJob(job) {
  const payload = job.payload || {};
  const width = job.payload?.printer?.paperWidthMm || 80;
  const isKitchen = ['ORDER_KITCHEN', 'ORDER_ADDITION'].includes(job.document_type);
  const itemLayout = configurableItemsLayout(job.payload?.printer?.layoutSettings);
  const configurableFontSize = {
    compact: isKitchen ? 16 : 12,
    normal: isKitchen ? 19 : 14,
    large: isKitchen ? 22 : 16,
  }[itemLayout.font_scale] || (isKitchen ? 19 : 14);
  const order = payload.order || {};
  const store = payload.store || {};
  const title = job.document_type === 'TEST_PRINT'
    ? 'TESTE DE IMPRESSÃO'
    : isKitchen
      ? job.document_type === 'ORDER_ADDITION' ? 'ADIÇÃO NA COZINHA' : 'COMANDA DA COZINHA'
      : 'COMANDA DE PEDIDO';

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <style>
    * { box-sizing: border-box; }
    html, body { width: ${width}mm; margin: 0; padding: 0; }
    body { font-family: "Courier New", monospace; padding: 3mm; color: #000; font-size: ${isKitchen ? 18 : 13}px; font-weight: ${isKitchen ? 900 : 500}; }
    .center { text-align: center; }
    .bold { font-weight: 900; }
    .large { font-size: ${isKitchen ? 22 : 16}px; }
    .divider { border-top: 1px dashed #000; margin: 8px 0; }
    .solid { border-top: 2px solid #000; margin: 8px 0; }
    .row { display: flex; justify-content: space-between; gap: 8px; }
    .product { font-size: ${isKitchen ? 26 : 14}px; line-height: 1.12; margin-bottom: 5px; }
    .option { margin: 0 0 3px 14px; }
    .obs { margin: 0 0 5px 14px; font-style: italic; }
    .item { break-inside: avoid; page-break-inside: avoid; margin-bottom: 8px; }
    .variation { margin: 0; font-size: ${configurableFontSize}px; line-height: 1.2; }
    .config-divider { border-top: 1px dashed #000; margin: 7px 0; }
    .option-group { margin: 0 0 8px; font-size: ${configurableFontSize}px; }
    .group-title { margin: 0 0 4px; font-weight: 900; }
    .uppercase { text-transform: uppercase; }
    .config-option { display: flex; align-items: baseline; gap: 8px; margin: 0 0 3px; line-height: 1.18; }
    .fraction { display: inline-block; min-width: 1.35em; font-size: 1.18em; font-weight: 900; }
    .config-observation { margin: 10px 0 4px; font-size: ${configurableFontSize}px; line-height: 1.2; break-inside: avoid; page-break-inside: avoid; }
    .config-observation p { margin: 0; }
    .config-observation.box { border: 2px solid #000; padding: 5px; text-align: center; }
    .config-observation.highlight { border-left: 4px solid #000; padding: 3px 0 3px 8px; }
    .config-observation.plain { margin-left: 0; }
    .observation-title { margin-bottom: 3px !important; font-weight: 900; text-transform: uppercase; }
    @page { size: ${width}mm auto; margin: 0; }
  </style>
</head>
<body>
  <div class="center">
    ${store.nome ? `<p class="large bold">${escapeHtml(store.nome)}</p>` : ''}
    <p class="large bold">${title}</p>
    ${order.numeroComandaCodigo ? `<p class="large bold">COMANDA ${escapeHtml(order.numeroComandaCodigo)}</p>` : ''}
    ${order.numeroPedido ? `<p>Pedido: <span class="bold">${escapeHtml(order.numeroPedido)}</span></p>` : ''}
    ${order.mesaNumero ? `<p class="bold">MESA ${escapeHtml(order.mesaNumero)}</p>` : ''}
    <p>${new Date().toLocaleString('pt-BR')}</p>
  </div>
  <div class="solid"></div>
  ${job.document_type === 'TEST_PRINT' ? `<p>${escapeHtml(payload.message)}</p>` : ''}
  ${order.clienteNome && !isKitchen ? `<p><span class="bold">Cliente:</span> ${escapeHtml(order.clienteNome)}</p>` : ''}
  ${renderItems(payload.items || [], !isKitchen, payload.printer?.layoutSettings)}
  ${payload.totals ? `
    <div class="divider"></div>
    <div class="row"><span>Subtotal</span><span>R$ ${money(payload.totals.subtotal)}</span></div>
    <div class="row"><span>Entrega</span><span>R$ ${money(payload.totals.taxaEntrega)}</span></div>
    <div class="row"><span>Desconto</span><span>R$ ${money(payload.totals.desconto)}</span></div>
    <div class="solid"></div>
    <div class="row bold"><span>Total</span><span>R$ ${money(payload.totals.total)}</span></div>
  ` : ''}
</body>
</html>`;
}

module.exports = { fractionLabel, renderItems, renderJob };
