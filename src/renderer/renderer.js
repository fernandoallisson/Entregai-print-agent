const pairing = document.getElementById('pairing');
const statusPanel = document.getElementById('status');
const pairingCode = document.getElementById('pairingCode');
const pairButton = document.getElementById('pairButton');
const clearButton = document.getElementById('clearButton');
const message = document.getElementById('message');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const deviceName = document.getElementById('deviceName');
const deviceId = document.getElementById('deviceId');
const agentName = document.getElementById('agentName');
const printers = document.getElementById('printers');
const lastSeen = document.getElementById('lastSeen');
const mainPanel = document.getElementById('mainPanel');
const layoutPanel = document.getElementById('layoutPanel');
const layoutToggleButton = document.getElementById('layoutToggleButton');
const closeLayoutButton = document.getElementById('closeLayoutButton');
const customerTab = document.getElementById('customerTab');
const kitchenTab = document.getElementById('kitchenTab');
const paperWidth = document.getElementById('paperWidth');
const showPrices = document.getElementById('showPrices');
const showOptions = document.getElementById('showOptions');
const showNotes = document.getElementById('showNotes');
const showOptionGroups = document.getElementById('showOptionGroups');
const showOptionQuantities = document.getElementById('showOptionQuantities');
const uppercaseOptions = document.getElementById('uppercaseOptions');
const boldOptions = document.getElementById('boldOptions');
const highlightOptions = document.getElementById('highlightOptions');
const optionPrefix = document.getElementById('optionPrefix');
const marginTop = document.getElementById('marginTop');
const marginRight = document.getElementById('marginRight');
const marginBottom = document.getElementById('marginBottom');
const marginLeft = document.getElementById('marginLeft');
const blockGap = document.getElementById('blockGap');
const lineGap = document.getElementById('lineGap');
const itemGap = document.getElementById('itemGap');
const indent = document.getElementById('indent');
const boxPadding = document.getElementById('boxPadding');
const printableReduction = document.getElementById('printableReduction');
const baseFont = document.getElementById('baseFont');
const titleFont = document.getElementById('titleFont');
const ticketFont = document.getElementById('ticketFont');
const productFont = document.getElementById('productFont');
const optionFont = document.getElementById('optionFont');
const noteFont = document.getElementById('noteFont');
const metaFont = document.getElementById('metaFont');
const totalFont = document.getElementById('totalFont');
const showBorders = document.getElementById('showBorders');
const borderWidth = document.getElementById('borderWidth');
const dividerWidth = document.getElementById('dividerWidth');
const itemDividerWidth = document.getElementById('itemDividerWidth');
const blockList = document.getElementById('blockList');
const footerText = document.getElementById('footerText');
const saveLayoutButton = document.getElementById('saveLayoutButton');
const resetLayoutButton = document.getElementById('resetLayoutButton');
const previewViewport = document.getElementById('previewViewport');
const printPreview = document.getElementById('printPreview');
const layoutMessage = document.getElementById('layoutMessage');

const blockLabels = {
  storeHeader: 'Cabeçalho da loja',
  title: 'Título e comanda',
  kitchenMeta: 'Dados da cozinha',
  customer: 'Dados do cliente',
  address: 'Endereço/retirada',
  items: 'Produtos',
  totals: 'Totais',
  payment: 'Pagamento',
  footer: 'Rodapé',
};

const sizeLabels = {
  small: 'Pequeno',
  normal: 'Normal',
  large: 'Grande',
  huge: 'Muito grande',
};

const alignLabels = {
  left: 'Esquerda',
  center: 'Centro',
  right: 'Direita',
};

let activeProfile = 'customer';
let printLayout = null;
let previewTimer = null;
let layoutEditorOpen = false;

function render(status) {
  const paired = Boolean(status?.paired);
  pairing.classList.toggle('hidden', paired);
  statusPanel.classList.toggle('hidden', !paired);
  deviceName.textContent = status?.deviceName || '-';
  deviceId.textContent = status?.deviceId || '-';
  agentName.textContent = status?.agent?.nome || status?.agent?.name || '-';
  printers.textContent = String(status?.printers ?? '-');
  lastSeen.textContent = status?.lastSeenAt ? new Date(status.lastSeenAt).toLocaleString('pt-BR') : '-';
  statusDot.classList.toggle('online', paired && status?.running && !status?.lastError);
  statusText.textContent = status?.lastError || (paired ? 'Conectado' : 'Aguardando vinculação');
  if (status?.authFailed) message.textContent = 'Credencial revogada. Vincule este computador novamente.';
}

async function refresh() {
  render(await window.entregaiAgent.getStatus());
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function currentProfile() {
  return printLayout[activeProfile];
}

function paperWidthPx(profile) {
  const paperWidthMm = Number(profile?.paperWidthMm || 80);
  return Math.round(paperWidthMm * 96 / 25.4);
}

function numberValue(input) {
  const number = Number(input.value);
  return Number.isFinite(number) ? number : 0;
}

function showLayoutMessage(text, isError = false) {
  layoutMessage.textContent = text;
  layoutMessage.style.color = isError ? '#b91c1c' : '#15803d';
  if (!text) return;
  setTimeout(() => {
    if (layoutMessage.textContent === text) layoutMessage.textContent = '';
  }, 2800);
}

function updateTabs() {
  customerTab.classList.toggle('active', activeProfile === 'customer');
  kitchenTab.classList.toggle('active', activeProfile === 'kitchen');
}

function setLayoutEditorOpen(open) {
  layoutEditorOpen = open;
  mainPanel.classList.toggle('hidden', open);
  layoutPanel.classList.toggle('hidden', !open);
  document.body.classList.toggle('editor-open', open);
  layoutToggleButton.textContent = open ? 'Fechar layout de impressão' : 'Editar layout de impressão';
  if (open) {
    schedulePreview();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

function option(value, label, selected) {
  return `<option value="${value}" ${value === selected ? 'selected' : ''}>${label}</option>`;
}

function renderBlockControls() {
  const profile = currentProfile();
  blockList.innerHTML = profile.blocks.map((block, index) => `
    <details class="block-card" data-index="${index}">
      <summary class="block-summary">
        <span>${blockLabels[block.id] || block.id}</span>
      </summary>
      <div class="block-actions">
        <label class="block-enable">
          <input type="checkbox" data-action="enabled" ${block.enabled ? 'checked' : ''} />
          <span>Mostrar este bloco</span>
        </label>
        <div class="move-buttons">
          <button class="icon-button" type="button" data-action="up" title="Mover para cima" ${index === 0 ? 'disabled' : ''}>&uarr;</button>
          <button class="icon-button" type="button" data-action="down" title="Mover para baixo" ${index === profile.blocks.length - 1 ? 'disabled' : ''}>&darr;</button>
        </div>
      </div>
      <div class="block-controls">
        <select data-action="size" aria-label="Tamanho do bloco">
          ${Object.entries(sizeLabels).map(([value, label]) => option(value, label, block.size)).join('')}
        </select>
        <select data-action="align" aria-label="Alinhamento do bloco">
          ${Object.entries(alignLabels).map(([value, label]) => option(value, label, block.align)).join('')}
        </select>
        <label class="check-line">
          <input type="checkbox" data-action="bold" ${block.bold ? 'checked' : ''} />
          <span>Negrito</span>
        </label>
      </div>
    </details>
  `).join('');
}

function renderLayoutForm() {
  if (!printLayout) return;
  const profile = currentProfile();
  const layout = profile.layout || {};
  const margins = layout.marginsMm || {};
  updateTabs();
  paperWidth.value = String(profile.paperWidthMm || 80);
  showPrices.checked = Boolean(profile.itemOptions?.showPrices);
  showOptions.checked = profile.itemOptions?.showOptions !== false;
  showNotes.checked = profile.itemOptions?.showNotes !== false;
  showOptionGroups.checked = profile.itemOptions?.showOptionGroups !== false;
  showOptionQuantities.checked = profile.itemOptions?.showOptionQuantities !== false;
  uppercaseOptions.checked = Boolean(profile.itemOptions?.uppercaseOptions);
  boldOptions.checked = Boolean(profile.itemOptions?.boldOptions);
  highlightOptions.checked = Boolean(profile.itemOptions?.highlightOptions);
  optionPrefix.value = profile.itemOptions?.optionPrefix || '';
  marginTop.value = margins.top ?? 0;
  marginRight.value = margins.right ?? 0;
  marginBottom.value = margins.bottom ?? 0;
  marginLeft.value = margins.left ?? 0;
  blockGap.value = layout.blockGapPx ?? 0;
  lineGap.value = layout.lineGapPx ?? 0;
  itemGap.value = layout.itemGapPx ?? 0;
  indent.value = layout.indentPx ?? 0;
  boxPadding.value = layout.boxPaddingPx ?? 0;
  printableReduction.value = layout.printableReductionMm ?? 0;
  baseFont.value = layout.baseFontPx ?? 0;
  titleFont.value = layout.titleFontPx ?? 0;
  ticketFont.value = layout.ticketFontPx ?? 0;
  productFont.value = layout.productFontPx ?? 0;
  optionFont.value = layout.optionFontPx ?? 0;
  noteFont.value = layout.noteFontPx ?? 0;
  metaFont.value = layout.metaFontPx ?? 0;
  totalFont.value = layout.totalFontPx ?? 0;
  showBorders.checked = layout.showBorders !== false;
  borderWidth.value = layout.borderWidthPx ?? 0;
  dividerWidth.value = layout.dividerWidthPx ?? 0;
  itemDividerWidth.value = layout.itemDividerWidthPx ?? 0;
  footerText.value = profile.footerText || '';
  renderBlockControls();
  updatePreviewFrameSize();
  schedulePreview();
}

function updateProfile(patch) {
  printLayout = clone(printLayout);
  printLayout[activeProfile] = {
    ...printLayout[activeProfile],
    ...patch,
  };
  renderLayoutForm();
}

function updateItemOptions(patch) {
  const profile = currentProfile();
  updateProfile({
    itemOptions: {
      ...profile.itemOptions,
      ...patch,
    },
  });
}

function updateLayout(patch) {
  const profile = currentProfile();
  const layout = profile.layout || {};
  updateProfile({
    layout: {
      ...layout,
      ...patch,
      marginsMm: {
        ...(layout.marginsMm || {}),
        ...(patch.marginsMm || {}),
      },
    },
  });
}

function updateBlock(index, patch) {
  const profile = currentProfile();
  const blocks = profile.blocks.map((block, currentIndex) => (
    currentIndex === index ? { ...block, ...patch } : block
  ));
  updateProfile({ blocks });
}

function moveBlock(index, direction) {
  const profile = currentProfile();
  const target = index + direction;
  if (target < 0 || target >= profile.blocks.length) return;
  const blocks = [...profile.blocks];
  [blocks[index], blocks[target]] = [blocks[target], blocks[index]];
  updateProfile({ blocks });
}

function schedulePreview() {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(updatePreview, 180);
}

function updatePreviewFrameSize() {
  if (!printLayout) return;
  const width = paperWidthPx(currentProfile());
  printPreview.style.width = `${width}px`;
  previewViewport.style.setProperty('--paper-width', `${width}px`);
}

async function updatePreview() {
  if (!printLayout) return;
  try {
    updatePreviewFrameSize();
    const html = await window.entregaiAgent.previewPrintLayout(activeProfile, printLayout);
    printPreview.srcdoc = html;
  } catch (error) {
    showLayoutMessage(error.message || 'Não foi possível gerar o preview.', true);
  }
}

async function loadPrintLayout() {
  try {
    printLayout = await window.entregaiAgent.getPrintLayout();
    renderLayoutForm();
  } catch (error) {
    showLayoutMessage(error.message || 'Não foi possível carregar o layout.', true);
  }
}

pairingCode.addEventListener('input', () => {
  const digits = pairingCode.value.replace(/\D/g, '').slice(0, 6);
  pairingCode.value = digits.length > 3 ? `${digits.slice(0, 3)} ${digits.slice(3)}` : digits;
});

pairButton.addEventListener('click', async () => {
  try {
    message.textContent = '';
    pairButton.disabled = true;
    render(await window.entregaiAgent.pair(pairingCode.value));
  } catch (error) {
    message.textContent = error.message || 'Não foi possível vincular este computador.';
  } finally {
    pairButton.disabled = false;
  }
});

clearButton.addEventListener('click', async () => {
  if (!confirm('Desvincular este computador?')) return;
  render(await window.entregaiAgent.clear());
});

layoutToggleButton.addEventListener('click', () => {
  setLayoutEditorOpen(!layoutEditorOpen);
});

closeLayoutButton.addEventListener('click', () => {
  setLayoutEditorOpen(false);
});

customerTab.addEventListener('click', () => {
  activeProfile = 'customer';
  renderLayoutForm();
});

kitchenTab.addEventListener('click', () => {
  activeProfile = 'kitchen';
  renderLayoutForm();
});

paperWidth.addEventListener('change', () => {
  updateProfile({ paperWidthMm: Number(paperWidth.value) });
});

showPrices.addEventListener('change', () => {
  updateItemOptions({ showPrices: showPrices.checked });
});

showOptions.addEventListener('change', () => {
  updateItemOptions({ showOptions: showOptions.checked });
});

showNotes.addEventListener('change', () => {
  updateItemOptions({ showNotes: showNotes.checked });
});

showOptionGroups.addEventListener('change', () => {
  updateItemOptions({ showOptionGroups: showOptionGroups.checked });
});

showOptionQuantities.addEventListener('change', () => {
  updateItemOptions({ showOptionQuantities: showOptionQuantities.checked });
});

uppercaseOptions.addEventListener('change', () => {
  updateItemOptions({ uppercaseOptions: uppercaseOptions.checked });
});

boldOptions.addEventListener('change', () => {
  updateItemOptions({ boldOptions: boldOptions.checked });
});

highlightOptions.addEventListener('change', () => {
  updateItemOptions({ highlightOptions: highlightOptions.checked });
});

optionPrefix.addEventListener('input', () => {
  const profile = currentProfile();
  printLayout = clone(printLayout);
  printLayout[activeProfile] = {
    ...profile,
    itemOptions: {
      ...profile.itemOptions,
      optionPrefix: optionPrefix.value,
    },
  };
  schedulePreview();
});

marginTop.addEventListener('change', () => updateLayout({ marginsMm: { top: numberValue(marginTop) } }));
marginRight.addEventListener('change', () => updateLayout({ marginsMm: { right: numberValue(marginRight) } }));
marginBottom.addEventListener('change', () => updateLayout({ marginsMm: { bottom: numberValue(marginBottom) } }));
marginLeft.addEventListener('change', () => updateLayout({ marginsMm: { left: numberValue(marginLeft) } }));
blockGap.addEventListener('change', () => updateLayout({ blockGapPx: numberValue(blockGap) }));
lineGap.addEventListener('change', () => updateLayout({ lineGapPx: numberValue(lineGap) }));
itemGap.addEventListener('change', () => updateLayout({ itemGapPx: numberValue(itemGap) }));
indent.addEventListener('change', () => updateLayout({ indentPx: numberValue(indent) }));
boxPadding.addEventListener('change', () => updateLayout({ boxPaddingPx: numberValue(boxPadding) }));
printableReduction.addEventListener('change', () => updateLayout({ printableReductionMm: numberValue(printableReduction) }));
baseFont.addEventListener('change', () => updateLayout({ baseFontPx: numberValue(baseFont) }));
titleFont.addEventListener('change', () => updateLayout({ titleFontPx: numberValue(titleFont) }));
ticketFont.addEventListener('change', () => updateLayout({ ticketFontPx: numberValue(ticketFont) }));
productFont.addEventListener('change', () => updateLayout({ productFontPx: numberValue(productFont) }));
optionFont.addEventListener('change', () => updateLayout({ optionFontPx: numberValue(optionFont) }));
noteFont.addEventListener('change', () => updateLayout({ noteFontPx: numberValue(noteFont) }));
metaFont.addEventListener('change', () => updateLayout({ metaFontPx: numberValue(metaFont) }));
totalFont.addEventListener('change', () => updateLayout({ totalFontPx: numberValue(totalFont) }));
showBorders.addEventListener('change', () => updateLayout({ showBorders: showBorders.checked }));
borderWidth.addEventListener('change', () => updateLayout({ borderWidthPx: numberValue(borderWidth) }));
dividerWidth.addEventListener('change', () => updateLayout({ dividerWidthPx: numberValue(dividerWidth) }));
itemDividerWidth.addEventListener('change', () => updateLayout({ itemDividerWidthPx: numberValue(itemDividerWidth) }));

footerText.addEventListener('input', () => {
  printLayout = clone(printLayout);
  printLayout[activeProfile] = {
    ...printLayout[activeProfile],
    footerText: footerText.value,
  };
  schedulePreview();
});

blockList.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const card = button.closest('.block-card');
  const index = Number(card?.dataset.index);
  if (!Number.isInteger(index)) return;
  if (button.dataset.action === 'up') moveBlock(index, -1);
  if (button.dataset.action === 'down') moveBlock(index, 1);
});

blockList.addEventListener('change', (event) => {
  const control = event.target.closest('[data-action]');
  if (!control) return;
  const card = control.closest('.block-card');
  const index = Number(card?.dataset.index);
  if (!Number.isInteger(index)) return;

  if (control.dataset.action === 'enabled') updateBlock(index, { enabled: control.checked });
  if (control.dataset.action === 'bold') updateBlock(index, { bold: control.checked });
  if (control.dataset.action === 'size') updateBlock(index, { size: control.value });
  if (control.dataset.action === 'align') updateBlock(index, { align: control.value });
});

saveLayoutButton.addEventListener('click', async () => {
  try {
    saveLayoutButton.disabled = true;
    printLayout = await window.entregaiAgent.savePrintLayout(printLayout);
    renderLayoutForm();
    showLayoutMessage('Layout salvo.');
  } catch (error) {
    showLayoutMessage(error.message || 'Não foi possível salvar o layout.', true);
  } finally {
    saveLayoutButton.disabled = false;
  }
});

resetLayoutButton.addEventListener('click', async () => {
  if (!confirm('Restaurar o layout padrão de impressão?')) return;
  try {
    resetLayoutButton.disabled = true;
    printLayout = await window.entregaiAgent.resetPrintLayout();
    renderLayoutForm();
    showLayoutMessage('Layout restaurado.');
  } catch (error) {
    showLayoutMessage(error.message || 'Não foi possível restaurar o layout.', true);
  } finally {
    resetLayoutButton.disabled = false;
  }
});

window.entregaiAgent.onStatus(render);
refresh();
loadPrintLayout();
