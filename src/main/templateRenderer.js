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

function selectionLine(selection = {}) {
  const quantity = Number(selection.quantidade || 1);
  const fraction = Number(selection.fracao || 0);
  const suffix = [
    quantity > 1 ? `x${quantity}` : '',
    fraction > 0 ? `${Math.round(fraction * 100)}%` : '',
  ].filter(Boolean).join(', ');
  const group = text(selection.nomeGrupo);
  const option = text(selection.nomeOpcao) || 'Opção';
  return `${group ? `${group}: ` : ''}${option}${suffix ? ` (${suffix})` : ''}`;
}

function configurationLines(item = {}) {
  if (Array.isArray(item.configurationLines) && item.configurationLines.length > 0) {
    return item.configurationLines.map(text).filter(Boolean);
  }

  const lines = [];
  if (text(item.nomeVariacao)) lines.push(`Tamanho: ${text(item.nomeVariacao)}`);
  for (const selection of item.selecoes || []) {
    lines.push(selectionLine(selection));
  }
  return lines;
}

function renderItems(items = [], showPrices, isKitchen) {
  return items.map((item) => `
    <section class="item">
      <div class="row product">
        <span>${escapeHtml(item.quantidade)}x ${escapeHtml(itemName(item))}</span>
        ${showPrices ? `<span>R$ ${money(item.precoTotal)}</span>` : ''}
      </div>
      ${configurationLines(item).map((line) => `<p class="option">${escapeHtml(line)}</p>`).join('')}
      ${item.observacoes ? `<p class="obs">Obs: ${escapeHtml(item.observacoes)}</p>` : ''}
    </section>
  `).join('') || `<p class="${isKitchen ? 'kitchen-empty' : ''}">Nenhum item selecionado.</p>`;
}

function renderStoreHeader(store = {}, isKitchen) {
  if (isKitchen) return '';
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
      ${order.clienteDocumento ? `<p><span class="bold">Documento:</span> ${escapeHtml(order.clienteDocumento)}</p>` : ''}
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

function renderStyles(width, isKitchen) {
  return `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { width: ${width}mm; min-height: 30mm; margin: 0; padding: 0; }
    body {
      font-family: "Courier New", monospace;
      width: ${width}mm;
      max-width: ${width}mm;
      padding: 3mm;
      color: #000;
      font-size: ${isKitchen ? 19 : 13}px;
      font-weight: ${isKitchen ? 900 : 500};
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body * { color: #000 !important; }
    .center { text-align: center; }
    .bold { font-weight: 900; }
    .large { font-size: ${isKitchen ? 22 : 16}px; }
    .store-line { font-size: 10px; margin-bottom: 2px; }
    .divider { border-top: 1px dashed #000; margin: 8px 0; }
    .solid { border-top: ${isKitchen ? 2 : 1}px solid #000; margin: ${isKitchen ? 10 : 8}px 0; }
    .thin { border-top-width: 1px; }
    .row { display: flex; justify-content: space-between; gap: 8px; margin-bottom: 3px; }
    .row > span:first-child { flex: 1; min-width: 0; overflow-wrap: anywhere; word-break: break-word; }
    .row > span:last-child { white-space: nowrap; }
    .tag { display: inline-block; border: ${isKitchen ? 2 : 1}px solid #000; padding: 1px 6px; font-size: ${isKitchen ? 18 : 12}px; margin: 2px; font-weight: 900; }
    .ticket-number { border: ${isKitchen ? 3 : 1}px solid #000; padding: ${isKitchen ? 9 : 5}px 4px; margin: 8px 0; text-align: center; }
    .ticket-label { font-size: ${isKitchen ? 17 : 12}px; font-weight: 900; }
    .ticket-value { display: block; font-size: ${isKitchen ? 54 : 24}px; line-height: .95; font-weight: 900; margin-top: 3px; }
    .kitchen-meta { border: 2px solid #000; padding: 6px; margin: 8px 0; text-align: left; }
    .kitchen-meta p { font-size: 18px; line-height: 1.16; margin-bottom: 4px; }
    .item { ${isKitchen ? 'border-bottom: 2px solid #000; padding-bottom: 9px; margin-bottom: 10px;' : 'margin-bottom: 7px;'} }
    .product { font-size: ${isKitchen ? 29 : 14}px; line-height: ${isKitchen ? 1.08 : 1.2}; margin-bottom: ${isKitchen ? 7 : 4}px; font-weight: ${isKitchen ? 900 : 700}; }
    .product span, .option, .obs, .address-line, .cash-change, p {
      max-width: 100%;
      overflow-wrap: anywhere;
      word-break: break-word;
      white-space: normal;
    }
    .option { font-size: ${isKitchen ? 22 : 12}px; line-height: ${isKitchen ? 1.1 : 1.2}; margin: 0 0 ${isKitchen ? 5 : 3}px ${isKitchen ? 12 : 12}px; ${isKitchen ? 'padding-left: 8px; border-left: 3px solid #000;' : ''} }
    .obs { ${isKitchen ? 'border: 2px solid #000; padding: 5px; margin: 6px 0 7px 0;' : 'margin: 0 0 5px 12px;'} font-size: ${isKitchen ? 24 : 13}px; line-height: ${isKitchen ? 1.1 : 1.2}; font-style: italic; font-weight: 900; }
    .info-box { border: 1px solid #000; padding: 6px; margin: 7px 0; }
    .address-box, .payment-box { border: 2px solid #000; padding: 7px; margin: 8px 0; }
    .box-title { text-align: center; font-size: ${isKitchen ? 17 : 13}px; font-weight: 900; margin-bottom: 5px; }
    .address-line { font-size: ${isKitchen ? 18 : 14}px; line-height: 1.2; margin-bottom: 4px; }
    .payment-status { border: 1px solid #000; padding: 4px; text-align: center; font-size: ${isKitchen ? 18 : 14}px; font-weight: 900; margin: 5px 0; }
    .cash-change { font-size: ${isKitchen ? 18 : 13}px; line-height: 1.2; margin-bottom: 4px; font-weight: 900; }
    .total { font-size: ${isKitchen ? 20 : 15}px; font-weight: 900; }
    .kitchen-empty { font-size: 20px; font-weight: 900; }
    p { margin-bottom: 4px; }
    @page { size: ${width}mm auto; margin: 0; }
  `;
}

function renderJob(job) {
  const payload = job.payload || {};
  const width = payload.printer?.paperWidthMm || 80;
  const documentType = job.document_type || payload.documentType;
  const isKitchen = ['ORDER_KITCHEN', 'ORDER_ADDITION'].includes(documentType);
  const order = payload.order || {};
  const store = payload.store || {};
  const code = ticketCode(order);
  const typeLabel = order.tipoPedidoLabel || order.tipoPedido || '';
  const title = documentType === 'TEST_PRINT'
    ? 'TESTE DE IMPRESSÃO'
    : isKitchen
      ? documentType === 'ORDER_ADDITION' ? 'ADIÇÃO NA COZINHA' : 'COMANDA DA COZINHA'
      : 'COMANDA DE PEDIDO';

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <style>${renderStyles(width, isKitchen)}</style>
</head>
<body>
  ${renderStoreHeader(store, isKitchen)}
  <div class="center">
    <p class="large bold">${title}</p>
    ${code ? `<div class="ticket-number"><span class="ticket-label">COMANDA DO DIA</span><span class="ticket-value">${escapeHtml(code)}</span></div>` : ''}
    ${typeLabel ? `<span class="tag">${escapeHtml(typeLabel)}</span>` : ''}
    ${order.mesaNumero ? `<span class="tag">MESA ${escapeHtml(order.mesaNumero)}</span>` : ''}
    ${!isKitchen && order.numeroPedido ? `<p>Pedido: <span class="bold">${escapeHtml(order.numeroPedido)}</span></p>` : ''}
    ${!isKitchen && order.agendadoPara ? `<p>Entrega agendada: <span class="bold">${escapeHtml(new Date(order.agendadoPara).toLocaleString('pt-BR'))}</span></p>` : ''}
    <p>${new Date().toLocaleString('pt-BR')}</p>
  </div>
  ${isKitchen ? `
    <div class="kitchen-meta">
      ${order.numeroPedido ? `<p>Pedido: <span class="bold">${escapeHtml(order.numeroPedido)}</span></p>` : ''}
      <p>Cliente: <span class="bold">${escapeHtml(order.clienteNome || 'Não informado')}</span></p>
      ${order.clienteTelefone ? `<p>Telefone: <span class="bold">${escapeHtml(order.clienteTelefone)}</span></p>` : ''}
      ${order.mesaNumero ? `<p>Mesa: <span class="bold">${escapeHtml(order.mesaNumero)}</span></p>` : ''}
    </div>
  ` : ''}
  <div class="solid"></div>
  ${documentType === 'TEST_PRINT' ? `<p>${escapeHtml(payload.message)}</p>` : ''}
  ${documentType !== 'TEST_PRINT' && !isKitchen ? `${renderCustomer(order)}${renderAddress(order)}` : ''}
  ${documentType !== 'TEST_PRINT' ? `<p class="bold">PRODUTOS:</p>${renderItems(payload.items || [], !isKitchen, isKitchen)}` : ''}
  ${!isKitchen ? `${renderTotals(payload.totals, typeLabel)}${renderPayment(payload.payment)}` : ''}
</body>
</html>`;
}

module.exports = { renderJob };
