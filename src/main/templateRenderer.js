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

function renderItems(items = [], showPrices) {
  return items.map((item) => `
    <section class="item">
      <div class="row product">
        <span>${escapeHtml(item.quantidade)}x ${escapeHtml(item.nomeProduto)}${item.nomeVariacao ? ` - ${escapeHtml(item.nomeVariacao)}` : ''}</span>
        ${showPrices ? `<span>R$ ${money(item.precoTotal)}</span>` : ''}
      </div>
      ${(item.selecoes || []).map((selection) => `<p class="option">+ ${escapeHtml(selection.nomeOpcao)}</p>`).join('')}
      ${item.observacoes ? `<p class="obs">Obs: ${escapeHtml(item.observacoes)}</p>` : ''}
    </section>
  `).join('');
}

function renderJob(job) {
  const payload = job.payload || {};
  const width = job.payload?.printer?.paperWidthMm || 80;
  const isKitchen = ['ORDER_KITCHEN', 'ORDER_ADDITION'].includes(job.document_type);
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
  ${renderItems(payload.items || [], !isKitchen)}
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

module.exports = { renderJob };
