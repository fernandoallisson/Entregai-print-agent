const { normalizePrintLayoutConfig } = require('./printLayoutConfig');

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function text(value) {
  return String(value ?? '').trim();
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
    ...(settings?.configurable_items || settings || {}),
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

function selectionObservation(selection = {}) {
  return text(selection.observacoes ?? selection.observacao ?? selection.notes);
}

function hasBorderSelection(item = {}) {
  return (item.selecoes || []).some((selection) =>
    text(selection?.nomeOpcao).toLocaleLowerCase('pt-BR').includes('borda')
  );
}

function borderMarker(item = {}) {
  return hasBorderSelection(item) ? ' (Com borda)' : '';
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

function renderConfigurableItem(item, showPrices, layout, options = {}) {
  const groups = groupSelections(item.selecoes || []);
  const showOptions = options.showOptions !== false;
  const showNotes = options.showNotes !== false;
  const showVariation = showOptions && layout.show_variation && item.nomeVariacao;
  const markerAfterVariation = Boolean(showVariation);
  const visibleGroups = showOptions ? groups : [];
  const hasDetails = showVariation || visibleGroups.length > 0;
  const optionClass = layout.uppercase_options ? ' uppercase' : '';
  const showGroupTitles = layout.show_group_titles;
  const showQuantities = layout.show_option_quantities;
  const prefix = text(options.optionPrefix);
  return `
    <section class="item configurable-item">
      <div class="row product">
        <span class="${layout.uppercase_product ? 'uppercase' : ''}">${escapeHtml(item.quantidade)}x ${escapeHtml(item.nomeProduto)}${markerAfterVariation ? '' : escapeHtml(borderMarker(item))}</span>
        ${showPrices ? `<span>R$ ${money(item.precoTotal)}</span>` : ''}
      </div>
      ${showVariation ? `<p class="variation${layout.uppercase_variation ? ' uppercase' : ''}"><span class="bold">${escapeHtml(layout.variation_label)}:</span> ${escapeHtml(item.nomeVariacao)}${escapeHtml(borderMarker(item))}</p>` : ''}
      ${hasDetails && layout.show_configuration_divider ? '<div class="config-divider"></div>' : ''}
      ${visibleGroups.map((group) => `
        <div class="option-group">
          ${showGroupTitles ? `<p class="group-title${layout.uppercase_group_titles ? ' uppercase' : ''}">${escapeHtml(group.name)}</p>` : ''}
          ${group.selections.map((selection) => {
            const fractionSuffix = layout.show_fractions ? text(selection.fracaoLabel) : '';
            const fraction = layout.show_fractions && !fractionSuffix ? fractionLabel(selection.fracao) : '';
            const quantity = showQuantities && Number(selection.quantidade) > 1
              ? `${escapeHtml(selection.quantidade)}x `
              : '';
            const observation = selectionObservation(selection);
            return `<p class="config-option${optionClass}">${fraction ? `<span class="fraction">${fraction}</span>` : ''}<span>${prefix ? `${escapeHtml(prefix)} ` : ''}${quantity}${escapeHtml(selection.nomeOpcao)}${observation ? ` - ${escapeHtml(observation)}` : ''}${fractionSuffix ? ` (${escapeHtml(fractionSuffix)})` : ''}</span></p>`;
          }).join('')}
        </div>
      `).join('')}
      ${showNotes ? renderObservation(item.observacoes, layout) : ''}
    </section>
  `;
}

function maskDocument(value) {
  const raw = text(value);
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 5) return raw ? '*'.repeat(raw.length) : '';

  let visibleDigitIndex = 0;
  const firstVisible = 3;
  const lastVisibleStart = Math.max(firstVisible, digits.length - 2);
  return raw.replace(/\d/g, (digit) => {
    const shouldShow = visibleDigitIndex < firstVisible || visibleDigitIndex >= lastVisibleStart;
    visibleDigitIndex += 1;
    return shouldShow ? digit : '*';
  });
}

function ticketCode(order = {}) {
  const formatted = text(order.numeroComandaCodigo || order.comandaDiaria?.codigo);
  if (formatted) return formatted;
  const numeric = Number(order.numeroComandaDiario || order.comandaDiaria?.numero);
  return Number.isFinite(numeric) && numeric > 0 ? String(numeric).padStart(5, '0') : '';
}

function itemName(item = {}) {
  const name = text(item.displayName) ||
    [text(item.nomeProduto) || 'Produto', text(item.nomeVariacao)]
      .filter(Boolean)
      .join(' - ');
  return hasBorderSelection(item) && !name.toLocaleLowerCase('pt-BR').includes('(com borda)')
    ? `${name}${borderMarker(item)}`
    : name;
}

function formatOptionLine(line, options = {}) {
  const prefix = text(options.optionPrefix);
  const value = options.uppercaseOptions ? text(line).toUpperCase() : text(line);
  return `${prefix ? `${prefix} ` : ''}${value}`;
}

function selectionLine(selection = {}, options = {}) {
  const quantity = Number(selection.quantidade || 1);
  const fraction = Number(selection.fracao || 0);
  const suffix = options.showOptionQuantities === false
    ? ''
    : [
      quantity > 1 ? `x${quantity}` : '',
      fraction > 0 ? fractionLabel(fraction) : '',
    ].filter(Boolean).join(', ');
  const group = options.showOptionGroups === false ? '' : text(selection.nomeGrupo);
  const option = text(selection.nomeOpcao) || 'Opção';
  const observation = selectionObservation(selection);
  return formatOptionLine(`${group ? `${group}: ` : ''}${option}${observation ? ` - ${observation}` : ''}${suffix ? ` (${suffix})` : ''}`, options);
}

function configurationLines(item = {}, options = {}) {
  if (Array.isArray(item.configurationLines) && item.configurationLines.length > 0) {
    return item.configurationLines.map((line) => formatOptionLine(line, options)).filter(Boolean);
  }

  const lines = [];
  if (text(item.nomeVariacao)) lines.push(formatOptionLine(`Tamanho: ${text(item.nomeVariacao)}`, options));
  for (const selection of item.selecoes || []) {
    lines.push(selectionLine(selection, options));
  }
  return lines;
}

function renderItems(items = [], options = {}, isKitchen) {
  const normalizedOptions = typeof options === 'boolean'
    ? { showPrices: options, layoutSettings: isKitchen || {} }
    : options;
  const kitchen = typeof isKitchen === 'boolean' ? isKitchen : false;
  const showPrices = Boolean(normalizedOptions.showPrices);
  const showOptions = normalizedOptions.showOptions !== false;
  const showNotes = normalizedOptions.showNotes !== false;
  const configurableLayout = configurableItemsLayout(normalizedOptions.layoutSettings);

  return items.map((item) => {
    const configurable = Boolean(item.nomeVariacao || (item.selecoes || []).length);
    if (configurable) {
      return renderConfigurableItem(item, showPrices, configurableLayout, normalizedOptions);
    }
    return `
      <section class="item">
        <div class="row product">
          <span>${escapeHtml(item.quantidade)}x ${escapeHtml(itemName(item))}</span>
          ${showPrices ? `<span>R$ ${money(item.precoTotal)}</span>` : ''}
        </div>
        ${showOptions ? configurationLines(item, normalizedOptions).map((line) => `<p class="option">${escapeHtml(line)}</p>`).join('') : ''}
        ${showNotes && item.observacoes ? `<p class="obs">Obs: ${escapeHtml(item.observacoes)}</p>` : ''}
      </section>
    `;
  }).join('') || `<p class="${kitchen ? 'kitchen-empty' : ''}">Nenhum item selecionado.</p>`;
}

function renderStoreHeader(store = {}) {
  const lines = [
    store.nome ? `<p class="large bold">${escapeHtml(store.nome)}</p>` : '',
    store.razaoSocial && store.razaoSocial !== store.nome ? `<p class="store-line">${escapeHtml(store.razaoSocial)}</p>` : '',
    store.cnpj ? `<p class="store-line">CNPJ: ${escapeHtml(store.cnpj)}</p>` : '',
    store.telefone ? `<p class="store-line">Tel: ${escapeHtml(store.telefone)}</p>` : '',
    store.email ? `<p class="store-line">${escapeHtml(store.email)}</p>` : '',
  ].filter(Boolean);

  return lines.length ? `<div class="center">${lines.join('')}</div><div class="solid thin"></div>` : '';
}

function renderCustomer(order = {}) {
  return `
    <div class="info-box">
      <p class="box-title">DADOS DO CLIENTE</p>
      <p><span class="bold">Nome:</span> ${escapeHtml(order.clienteNome || 'Não informado')}</p>
      <p><span class="bold">Telefone:</span> ${escapeHtml(order.clienteTelefone || 'Não informado')}</p>
      ${order.clienteDocumento ? `<p><span class="bold">Documento:</span> ${escapeHtml(maskDocument(order.clienteDocumento))}</p>` : ''}
      ${order.cpfNaNota ? `<p><span class="bold">CPF na nota:</span> ${escapeHtml(order.cpfNaNotaCpf || 'Informado')}</p>` : ''}
    </div>
  `;
}

function renderAddress(order = {}) {
  const address = order.enderecoDestaque || {};
  const type = text(order.tipoPedidoLabel || order.tipoPedido).toUpperCase();
  if (type.includes('RETIRADA')) {
    return `
      <div class="address-box">
        <p class="box-title">RETIRADA NO BALCÃO</p>
        <p class="address-line">Cliente retira o pedido na loja.</p>
      </div>
    `;
  }

  const line = text(address.linha || order.endereco);
  const neighborhood = text(address.bairro || order.bairro);
  const full = text(address.completo || order.endereco);
  const reference = text(address.referencia);
  if (!line && !neighborhood && !full && !reference) return '';

  return `
    <div class="address-box">
      <p class="box-title">ENDEREÇO DE ENTREGA</p>
      ${line ? `<p class="address-line"><span class="bold">Endereço:</span> ${escapeHtml(line)}</p>` : ''}
      ${neighborhood ? `<p class="address-line"><span class="bold">Bairro:</span> ${escapeHtml(neighborhood)}</p>` : ''}
      ${full && full !== line ? `<p class="address-line"><span class="bold">Completo:</span> ${escapeHtml(full)}</p>` : ''}
      ${reference ? `<p class="address-line"><span class="bold">Referência:</span> ${escapeHtml(reference)}</p>` : ''}
    </div>
  `;
}

const INACTIVE_PAYMENT_STATUSES = new Set([
  'cancelado',
  'cancelada',
  'cancelled',
  'estornado',
  'estornada',
  'reembolsado',
  'refunded',
  'expirado',
  'expired',
  'falhou',
  'failed',
  'recusado',
  'rejeitado',
]);

function isCurrentPayment(payment) {
  const status = text(payment?.status).toLocaleLowerCase('pt-BR');
  const superseded = payment?.metadata?.substituido_por_ajuste_admin;
  return Boolean(payment) &&
    !INACTIVE_PAYMENT_STATUSES.has(status) &&
    superseded !== true &&
    superseded !== 'true';
}

function currentPayments(payload = {}) {
  const payments = Array.isArray(payload.payments)
    ? payload.payments
    : payload.payment
      ? [payload.payment]
      : [];
  return payments.filter(isCurrentPayment);
}

function renderPayments(payments = []) {
  if (payments.length === 0) {
    return `
      <div class="payment-box">
        <p class="box-title">PAGAMENTO</p>
        <p><span class="bold">Forma:</span> Não informado</p>
        <p class="payment-status">PAGAMENTO PENDENTE</p>
      </div>
    `;
  }

  return `
    <div class="payment-box">
      <p class="box-title">${payments.length > 1 ? 'PAGAMENTOS' : 'PAGAMENTO'}</p>
      ${payments.map((payment) => {
        const changeLines = payment.troco?.linhas || [];
        return `
          <div class="payment-entry">
            <p><span class="bold">Forma:</span> ${escapeHtml(payment.formaPagamentoLabel || payment.formaPagamento || 'Não informado')}</p>
            <p><span class="bold">Valor:</span> R$ ${money(payment.valor)}</p>
            <p><span class="bold">Status:</span> ${escapeHtml(payment.statusLabel || payment.status || 'Não informado')}</p>
            <p class="payment-status">${escapeHtml(payment.pagoLabel || (payment.pago ? 'PAGO' : 'PAGAMENTO PENDENTE'))}</p>
            ${changeLines.map((line) => `<p class="cash-change">${escapeHtml(line)}</p>`).join('')}
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function renderTotals(totals = null, typeLabel = '') {
  if (!totals) return '';
  const isPickup = text(typeLabel).toUpperCase().includes('RETIRADA');
  return `
    <div class="divider"></div>
    <div class="row"><span>${escapeHtml(totals.subtotalLabel || 'Subtotal')}</span><span>R$ ${money(totals.subtotal)}</span></div>
    <div class="row"><span>${isPickup ? 'Retirada na loja' : 'Entrega'}</span><span>R$ ${money(totals.taxaEntrega)}</span></div>
    <div class="row"><span>Desconto</span><span>R$ ${money(totals.desconto)}</span></div>
    <div class="solid"></div>
    <div class="row total"><span>TOTAL A PAGAR</span><span>R$ ${money(totals.total)}</span></div>
  `;
}

function blockClass(block = {}) {
  return [
    'print-block',
    `block-${block.size || 'normal'}`,
    `align-${block.align || 'left'}`,
    block.bold ? 'block-bold' : '',
  ].filter(Boolean).join(' ');
}

function renderTitleBlock({ documentType, isKitchen, order, code, typeLabel, title }) {
  return `
    <p class="large bold">${escapeHtml(title)}</p>
    ${code ? `<div class="ticket-number"><span class="ticket-label">COMANDA DO DIA</span><span class="ticket-value">${escapeHtml(code)}</span></div>` : ''}
    ${typeLabel ? `<span class="tag">${escapeHtml(typeLabel)}</span>` : ''}
    ${order.mesaNumero ? `<span class="tag">MESA ${escapeHtml(order.mesaNumero)}</span>` : ''}
    ${!isKitchen && order.numeroPedido ? `<p>Pedido: <span class="bold">${escapeHtml(order.numeroPedido)}</span></p>` : ''}
    ${!isKitchen && order.agendadoPara ? `<p>Entrega agendada: <span class="bold">${escapeHtml(new Date(order.agendadoPara).toLocaleString('pt-BR'))}</span></p>` : ''}
    <p>${documentType === 'TEST_PRINT' ? 'Teste local' : new Date().toLocaleString('pt-BR')}</p>
  `;
}

function renderKitchenMeta(order = {}) {
  return `
    <div class="kitchen-meta">
      ${order.numeroPedido ? `<p>Pedido: <span class="bold">${escapeHtml(order.numeroPedido)}</span></p>` : ''}
      <p>Cliente: <span class="bold">${escapeHtml(order.clienteNome || 'Não informado')}</span></p>
      ${order.clienteTelefone ? `<p>Telefone: <span class="bold">${escapeHtml(order.clienteTelefone)}</span></p>` : ''}
      ${order.mesaNumero ? `<p>Mesa: <span class="bold">${escapeHtml(order.mesaNumero)}</span></p>` : ''}
    </div>
  `;
}

function renderFooter(profile = {}) {
  const footerText = text(profile.footerText);
  if (!footerText) return '';
  return `<div class="divider"></div><p>${escapeHtml(footerText)}</p>`;
}

function renderBlock(block, content) {
  const trimmed = text(content);
  if (!block.enabled || !trimmed) return '';
  return `<section class="${blockClass(block)}" data-preview-block="${escapeHtml(block.id)}">${content}</section>`;
}

function cssNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function borderStyle(width, style = 'solid') {
  return width > 0 ? `${width}px ${style} #000` : '0';
}

function renderStyles(width, isKitchen, profile = {}, configurableLayout = DEFAULT_CONFIGURABLE_ITEMS_LAYOUT) {
  const paperWidth = Number(width);
  const pageWidth = Number.isFinite(paperWidth) && paperWidth > 0 ? paperWidth : 80;
  const layout = profile.layout || {};
  const itemOptions = profile.itemOptions || {};
  const margins = layout.marginsMm || {};
  const reduction = cssNumber(layout.printableReductionMm, 5);
  const marginTop = cssNumber(margins.top, 3);
  const marginRight = cssNumber(margins.right, 2);
  const marginBottom = cssNumber(margins.bottom, 3);
  const marginLeft = cssNumber(margins.left, 3);
  const printableWidth = Math.max(30, pageWidth - reduction - marginLeft - marginRight);
  const blockGap = cssNumber(layout.blockGapPx, isKitchen ? 8 : 6);
  const lineGap = cssNumber(layout.lineGapPx, isKitchen ? 5 : 4);
  const itemGap = cssNumber(layout.itemGapPx, isKitchen ? 10 : 7);
  const boxPadding = cssNumber(layout.boxPaddingPx, isKitchen ? 7 : 6);
  const indent = cssNumber(layout.indentPx, 12);
  const baseFont = cssNumber(layout.baseFontPx, isKitchen ? 19 : 13);
  const titleFont = cssNumber(layout.titleFontPx, isKitchen ? 22 : 16);
  const ticketFont = cssNumber(layout.ticketFontPx, isKitchen ? 54 : 24);
  const productFont = cssNumber(layout.productFontPx, isKitchen ? 29 : 14);
  const optionFont = cssNumber(layout.optionFontPx, isKitchen ? 22 : 12);
  const noteFont = cssNumber(layout.noteFontPx, isKitchen ? 24 : 13);
  const metaFont = cssNumber(layout.metaFontPx, isKitchen ? 18 : 14);
  const totalFont = cssNumber(layout.totalFontPx, isKitchen ? 20 : 15);
  const showBorders = layout.showBorders !== false;
  const boxEachItem = itemOptions.boxEachItem === true;
  const highlightOptions = itemOptions.highlightOptions === true;
  const boldOptions = itemOptions.boldOptions === true;
  const borderWidth = showBorders ? cssNumber(layout.borderWidthPx, isKitchen ? 2 : 1) : 0;
  const dividerWidth = showBorders ? cssNumber(layout.dividerWidthPx, isKitchen ? 2 : 1) : 0;
  const itemDividerWidth = showBorders ? cssNumber(layout.itemDividerWidthPx, isKitchen ? 2 : 1) : 0;
  const configurableFontScale = {
    compact: 0.86,
    normal: 1,
    large: 1.18,
  }[configurableLayout.font_scale] || 1;

  return `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html {
      width: ${pageWidth}mm;
      min-height: 30mm;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: "Courier New", monospace;
      width: ${printableWidth}mm;
      max-width: ${printableWidth}mm;
      margin: ${marginTop}mm ${marginRight}mm ${marginBottom}mm ${marginLeft}mm;
      padding: 0;
      color: #000;
      font-size: ${baseFont}px;
      font-weight: ${isKitchen ? 900 : 500};
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body * { color: #000 !important; }
    body, .print-block, .item { overflow-x: hidden; }
    @media screen {
      .preview-highlight {
        position: relative;
        outline: 2px solid #0082dc !important;
        outline-offset: 2px;
        background: rgba(0, 130, 220, 0.08) !important;
        box-shadow: 0 0 0 5px rgba(0, 130, 220, 0.12) !important;
      }
      body.preview-highlight {
        outline-offset: -2px;
      }
    }
    .center { text-align: center; }
    .print-block { --block-scale: 1; margin-bottom: ${blockGap}px; text-align: left; }
    .align-left { text-align: left; }
    .align-center { text-align: center; }
    .align-right { text-align: right; }
    .block-bold, .block-bold p, .block-bold span { font-weight: 900; }
    .block-small { --block-scale: .85; font-size: calc(${baseFont}px * var(--block-scale)); }
    .block-normal { --block-scale: 1; font-size: calc(${baseFont}px * var(--block-scale)); }
    .block-large { --block-scale: 1.18; font-size: calc(${baseFont}px * var(--block-scale)); }
    .block-huge { --block-scale: 1.38; font-size: calc(${baseFont}px * var(--block-scale)); }
    .bold { font-weight: 900; }
    .large { font-size: calc(${titleFont}px * var(--block-scale)); }
    .store-line { font-size: calc(${Math.max(8, baseFont - 3)}px * var(--block-scale)); margin-bottom: ${Math.max(1, lineGap - 2)}px; }
    .divider { border-top: ${borderStyle(dividerWidth, 'dashed')}; margin: ${blockGap}px 0; }
    .solid { border-top: ${borderStyle(dividerWidth)}; margin: ${blockGap}px 0; }
    .thin { border-top-width: ${Math.min(1, dividerWidth)}px; }
    .row { display: flex; justify-content: space-between; gap: 6px; width: 100%; margin-bottom: ${lineGap}px; }
    .row > span:first-child { flex: 1; min-width: 0; overflow-wrap: anywhere; word-break: break-word; }
    .row > span:last-child { flex: 0 0 auto; max-width: 44%; text-align: right; white-space: nowrap; }
    .row > span:first-child:last-child { flex: 1 1 auto; max-width: 100%; text-align: left; white-space: normal; }
    .tag { display: inline-block; border: ${borderStyle(borderWidth)}; padding: 1px 6px; font-size: calc(${Math.max(10, baseFont - 1)}px * var(--block-scale)); margin: 2px; font-weight: 900; }
    .ticket-number { border: ${borderStyle(Math.max(borderWidth, isKitchen ? 3 : 1))}; padding: ${boxPadding}px 4px; margin: ${blockGap}px 0; text-align: center; }
    .ticket-label { font-size: calc(${Math.max(10, metaFont - 1)}px * var(--block-scale)); font-weight: 900; }
    .ticket-value { display: block; font-size: calc(${ticketFont}px * var(--block-scale)); line-height: .95; font-weight: 900; margin-top: ${Math.max(2, lineGap - 1)}px; }
    .kitchen-meta { border: ${borderStyle(borderWidth)}; padding: ${boxPadding}px; margin: ${blockGap}px 0; text-align: left; }
    .kitchen-meta p { font-size: calc(${metaFont}px * var(--block-scale)); line-height: 1.16; margin-bottom: ${lineGap}px; }
    .item {
      ${boxEachItem
        ? `border: ${borderStyle(borderWidth)}; padding: ${boxPadding}px;`
        : isKitchen
          ? `border-bottom: ${borderStyle(itemDividerWidth)}; padding-bottom: ${Math.max(0, itemGap - 1)}px;`
          : ''}
      margin-bottom: ${itemGap}px;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .product { font-size: calc(${productFont}px * var(--block-scale)); line-height: ${isKitchen ? 1.08 : 1.2}; margin-bottom: ${lineGap}px; font-weight: ${isKitchen ? 900 : 700}; }
    .configurable-item .product { font-size: calc(${productFont * configurableFontScale}px * var(--block-scale)); }
    .product span, .option, .obs, .address-line, .cash-change, p {
      max-width: 100%;
      overflow-wrap: anywhere;
      word-break: break-word;
      white-space: normal;
    }
    .option { ${highlightOptions ? `border: ${borderStyle(Math.max(borderWidth, 1))}; padding: ${Math.max(0, boxPadding - 3)}px;` : ''} font-size: calc(${optionFont}px * var(--block-scale)); line-height: ${isKitchen ? 1.1 : 1.2}; margin: 0 0 ${lineGap}px ${indent}px; font-weight: ${boldOptions ? 900 : 500}; ${isKitchen && !highlightOptions ? `padding-left: ${Math.max(0, indent - 4)}px; border-left: ${borderStyle(Math.max(borderWidth, 1))};` : ''} }
    .obs { ${isKitchen ? `border: ${borderStyle(borderWidth)}; padding: ${Math.max(0, boxPadding - 2)}px; margin: ${lineGap}px 0 ${itemGap}px 0;` : `margin: 0 0 ${lineGap}px ${indent}px;`} font-size: calc(${noteFont}px * var(--block-scale)); line-height: ${isKitchen ? 1.1 : 1.2}; font-style: italic; font-weight: 900; }
    .variation { margin: 0; font-size: calc(${optionFont}px * var(--block-scale)); line-height: 1.2; }
    .configurable-item .variation,
    .configurable-item .option-group { font-size: calc(${optionFont * configurableFontScale}px * var(--block-scale)); }
    .config-divider { border-top: ${borderStyle(dividerWidth, 'dashed')}; margin: ${Math.max(3, lineGap + 2)}px 0; }
    .option-group { margin: 0 0 ${Math.max(4, lineGap + 3)}px; font-size: calc(${optionFont}px * var(--block-scale)); }
    .group-title { margin: 0 0 ${lineGap}px; font-weight: 900; }
    .uppercase { text-transform: uppercase; }
    .config-option { ${highlightOptions ? `border: ${borderStyle(Math.max(borderWidth, 1))}; padding: ${Math.max(0, boxPadding - 3)}px;` : ''} display: flex; align-items: baseline; gap: 8px; margin: 0 0 ${lineGap}px; line-height: ${isKitchen ? 1.1 : 1.2}; font-weight: ${boldOptions ? 900 : 500}; }
    .fraction { display: inline-block; min-width: 1.35em; flex: 0 0 auto; font-size: 1.18em; font-weight: 900; }
    .config-observation { margin: ${Math.max(6, itemGap)}px 0 4px; font-size: calc(${noteFont}px * var(--block-scale)); line-height: 1.2; break-inside: avoid; page-break-inside: avoid; font-weight: 900; }
    .configurable-item .config-observation { font-size: calc(${noteFont * configurableFontScale}px * var(--block-scale)); }
    .config-observation p { margin: 0; }
    .config-observation.box { border: ${borderStyle(Math.max(borderWidth, 1))}; padding: ${boxPadding}px; text-align: center; }
    .config-observation.highlight { border-left: ${borderStyle(Math.max(borderWidth, 3))}; padding: 3px 0 3px ${Math.max(6, indent - 4)}px; }
    .config-observation.plain { margin-left: 0; }
    .observation-title { margin-bottom: ${lineGap}px !important; font-weight: 900; text-transform: ${configurableLayout.uppercase_observation ? 'uppercase' : 'none'}; }
    .info-box { border: ${borderStyle(Math.min(borderWidth, 1))}; padding: ${boxPadding}px; margin: ${itemGap}px 0; }
    .address-box, .payment-box { border: ${borderStyle(borderWidth)}; padding: ${boxPadding}px; margin: ${blockGap}px 0; }
    .box-title { text-align: center; font-size: calc(${metaFont}px * var(--block-scale)); font-weight: 900; margin-bottom: ${lineGap}px; }
    .address-line { font-size: calc(${metaFont}px * var(--block-scale)); line-height: 1.2; margin-bottom: ${lineGap}px; }
    .payment-entry + .payment-entry { border-top: ${borderStyle(Math.min(borderWidth, 1))}; margin-top: ${lineGap + 2}px; padding-top: ${lineGap + 2}px; }
    .payment-status { border: ${borderStyle(Math.min(borderWidth, 1))}; padding: ${Math.max(0, boxPadding - 2)}px; text-align: center; font-size: calc(${metaFont}px * var(--block-scale)); font-weight: 900; margin: ${lineGap}px 0; }
    .cash-change { font-size: calc(${baseFont}px * var(--block-scale)); line-height: 1.2; margin-bottom: ${lineGap}px; font-weight: 900; }
    .total { font-size: calc(${totalFont}px * var(--block-scale)); font-weight: 900; }
    .kitchen-empty { font-size: calc(${totalFont}px * var(--block-scale)); font-weight: 900; }
    p { margin-bottom: ${lineGap}px; }
    @page { size: ${pageWidth}mm auto; margin: 0; }
  `;
}

function renderBlockContent(blockId, context) {
  const {
    documentType,
    isKitchen,
    order,
    store,
    code,
    typeLabel,
    title,
    payload,
    profile,
  } = context;

  if (documentType === 'TEST_PRINT') {
    if (blockId === 'title') return renderTitleBlock(context);
    if (blockId === 'items') return `<p>${escapeHtml(payload.message || 'Teste de impressão')}</p>`;
    if (blockId === 'footer') return renderFooter(profile);
    return '';
  }

  switch (blockId) {
    case 'storeHeader':
      return isKitchen ? '' : renderStoreHeader(store);
    case 'title':
      return renderTitleBlock({ documentType, isKitchen, order, code, typeLabel, title });
    case 'kitchenMeta':
      return isKitchen ? renderKitchenMeta(order) : '';
    case 'customer':
      return isKitchen ? '' : renderCustomer(order);
    case 'address':
      return isKitchen ? '' : renderAddress(order);
    case 'items':
      return `<p class="bold">PRODUTOS:</p>${renderItems(payload.items || [], {
        ...profile.itemOptions,
        layoutSettings: profile.configurableItems,
      }, isKitchen)}`;
    case 'totals':
      return isKitchen ? '' : renderTotals(payload.totals, typeLabel);
    case 'payment':
      return isKitchen ? '' : renderPayments(currentPayments(payload));
    case 'footer':
      return renderFooter(profile);
    default:
      return '';
  }
}

function renderJob(job, printLayoutConfig = {}) {
  const payload = job.payload || {};
  const documentType = job.document_type || payload.documentType;
  const isKitchen = ['ORDER_KITCHEN', 'ORDER_ADDITION'].includes(documentType);
  const layout = normalizePrintLayoutConfig(printLayoutConfig);
  const profile = isKitchen ? layout.kitchen : layout.customer;
  const width = profile.paperWidthMm || payload.printer?.paperWidthMm || 80;
  const itemLayout = configurableItemsLayout(profile.configurableItems);
  const order = payload.order || {};
  const store = payload.store || {};
  const code = ticketCode(order);
  const typeLabel = order.tipoPedidoLabel || order.tipoPedido || '';
  const title = documentType === 'TEST_PRINT'
    ? 'TESTE DE IMPRESSÃO'
    : isKitchen
      ? documentType === 'ORDER_ADDITION' ? 'ADIÇÃO NA COZINHA' : 'COMANDA DA COZINHA'
      : 'COMANDA DE PEDIDO';
  const context = {
    documentType,
    isKitchen,
    order,
    store,
    code,
    typeLabel,
    title,
    payload,
    profile,
  };
  const blocks = profile.blocks.map((block) => renderBlock(block, renderBlockContent(block.id, context))).join('');

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <style>${renderStyles(width, isKitchen, profile, itemLayout)}</style>
</head>
<body>
  ${blocks}
</body>
</html>`;
}

module.exports = { fractionLabel, renderItems, renderJob };
