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
  return text(item.displayName) ||
    [text(item.nomeProduto) || 'Produto', text(item.nomeVariacao)]
      .filter(Boolean)
      .join(' - ');
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
      fraction > 0 ? `${Math.round(fraction * 100)}%` : '',
    ].filter(Boolean).join(', ');
  const group = options.showOptionGroups === false ? '' : text(selection.nomeGrupo);
  const option = text(selection.nomeOpcao) || 'Opção';
  return formatOptionLine(`${group ? `${group}: ` : ''}${option}${suffix ? ` (${suffix})` : ''}`, options);
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
  const showPrices = Boolean(options.showPrices);
  const showOptions = options.showOptions !== false;
  const showNotes = options.showNotes !== false;

  return items.map((item) => `
    <section class="item">
      <div class="row product">
        <span>${escapeHtml(item.quantidade)}x ${escapeHtml(itemName(item))}</span>
        ${showPrices ? `<span>R$ ${money(item.precoTotal)}</span>` : ''}
      </div>
      ${showOptions ? configurationLines(item, options).map((line) => `<p class="option">${escapeHtml(line)}</p>`).join('') : ''}
      ${showNotes && item.observacoes ? `<p class="obs">Obs: ${escapeHtml(item.observacoes)}</p>` : ''}
    </section>
  `).join('') || `<p class="${isKitchen ? 'kitchen-empty' : ''}">Nenhum item selecionado.</p>`;
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

function renderPayment(payment = null) {
  if (!payment) {
    return `
      <div class="payment-box">
        <p class="box-title">PAGAMENTO</p>
        <p><span class="bold">Forma:</span> Não informado</p>
        <p class="payment-status">PAGAMENTO PENDENTE</p>
      </div>
    `;
  }

  const changeLines = payment.troco?.linhas || [];
  return `
    <div class="payment-box">
      <p class="box-title">PAGAMENTO</p>
      <p><span class="bold">Forma:</span> ${escapeHtml(payment.formaPagamentoLabel || payment.formaPagamento || 'Não informado')}</p>
      <p><span class="bold">Status:</span> ${escapeHtml(payment.statusLabel || payment.status || 'Não informado')}</p>
      <p class="payment-status">${escapeHtml(payment.pagoLabel || (payment.pago ? 'PAGO' : 'PAGAMENTO PENDENTE'))}</p>
      ${changeLines.map((line) => `<p class="cash-change">${escapeHtml(line)}</p>`).join('')}
    </div>
  `;
}

function renderTotals(totals = null, typeLabel = '') {
  if (!totals) return '';
  const isPickup = text(typeLabel).toUpperCase().includes('RETIRADA');
  return `
    <div class="divider"></div>
    <div class="row"><span>Subtotal</span><span>R$ ${money(totals.subtotal)}</span></div>
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

function renderStyles(width, isKitchen, profile = {}) {
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
  const highlightOptions = itemOptions.highlightOptions === true;
  const boldOptions = itemOptions.boldOptions === true;
  const borderWidth = showBorders ? cssNumber(layout.borderWidthPx, isKitchen ? 2 : 1) : 0;
  const dividerWidth = showBorders ? cssNumber(layout.dividerWidthPx, isKitchen ? 2 : 1) : 0;
  const itemDividerWidth = showBorders ? cssNumber(layout.itemDividerWidthPx, isKitchen ? 2 : 1) : 0;

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
    .item { ${isKitchen ? `border-bottom: ${borderStyle(itemDividerWidth)}; padding-bottom: ${Math.max(0, itemGap - 1)}px;` : ''} margin-bottom: ${itemGap}px; }
    .product { font-size: calc(${productFont}px * var(--block-scale)); line-height: ${isKitchen ? 1.08 : 1.2}; margin-bottom: ${lineGap}px; font-weight: ${isKitchen ? 900 : 700}; }
    .product span, .option, .obs, .address-line, .cash-change, p {
      max-width: 100%;
      overflow-wrap: anywhere;
      word-break: break-word;
      white-space: normal;
    }
    .option { ${highlightOptions ? `border: ${borderStyle(Math.max(borderWidth, 1))}; padding: ${Math.max(0, boxPadding - 3)}px;` : ''} font-size: calc(${optionFont}px * var(--block-scale)); line-height: ${isKitchen ? 1.1 : 1.2}; margin: 0 0 ${lineGap}px ${indent}px; font-weight: ${boldOptions ? 900 : 500}; ${isKitchen && !highlightOptions ? `padding-left: ${Math.max(0, indent - 4)}px; border-left: ${borderStyle(Math.max(borderWidth, 1))};` : ''} }
    .obs { ${isKitchen ? `border: ${borderStyle(borderWidth)}; padding: ${Math.max(0, boxPadding - 2)}px; margin: ${lineGap}px 0 ${itemGap}px 0;` : `margin: 0 0 ${lineGap}px ${indent}px;`} font-size: calc(${noteFont}px * var(--block-scale)); line-height: ${isKitchen ? 1.1 : 1.2}; font-style: italic; font-weight: 900; }
    .info-box { border: ${borderStyle(Math.min(borderWidth, 1))}; padding: ${boxPadding}px; margin: ${itemGap}px 0; }
    .address-box, .payment-box { border: ${borderStyle(borderWidth)}; padding: ${boxPadding}px; margin: ${blockGap}px 0; }
    .box-title { text-align: center; font-size: calc(${metaFont}px * var(--block-scale)); font-weight: 900; margin-bottom: ${lineGap}px; }
    .address-line { font-size: calc(${metaFont}px * var(--block-scale)); line-height: 1.2; margin-bottom: ${lineGap}px; }
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
      return `<p class="bold">PRODUTOS:</p>${renderItems(payload.items || [], profile.itemOptions, isKitchen)}`;
    case 'totals':
      return isKitchen ? '' : renderTotals(payload.totals, typeLabel);
    case 'payment':
      return isKitchen ? '' : renderPayment(payload.payment);
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
  <style>${renderStyles(width, isKitchen, profile)}</style>
</head>
<body>
  ${blocks}
</body>
</html>`;
}

module.exports = { renderJob };
