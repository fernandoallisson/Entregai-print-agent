const pairing = document.getElementById('pairing');
const updatePanel = document.getElementById('updatePanel');
const currentVersion = document.getElementById('currentVersion');
const updateStatus = document.getElementById('updateStatus');
const updateProgress = document.getElementById('updateProgress');
const updateError = document.getElementById('updateError');
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
const backendAddress = document.getElementById('backendAddress');
const transportName = document.getElementById('transportName');
const mainPanel = document.getElementById('mainPanel');
const layoutPanel = document.getElementById('layoutPanel');
const connectionPanel = document.getElementById('connectionPanel');
const connectionToggleButton = document.getElementById('connectionToggleButton');
const backendUrl = document.getElementById('backendUrl');
const agentEnvironment = document.getElementById('agentEnvironment');
const printTransport = document.getElementById('printTransport');
const saveConnectionButton = document.getElementById('saveConnectionButton');
const cancelConnectionButton = document.getElementById('cancelConnectionButton');
const connectionMessage = document.getElementById('connectionMessage');
const layoutToggleButton = document.getElementById('layoutToggleButton');
const closeLayoutButton = document.getElementById('closeLayoutButton');
const customerTab = document.getElementById('customerTab');
const kitchenTab = document.getElementById('kitchenTab');
const paperWidth = document.getElementById('paperWidth');
const showPrices = document.getElementById('showPrices');
const showOptions = document.getElementById('showOptions');
const showNotes = document.getElementById('showNotes');
const variationLabel = document.getElementById('variationLabel');
const configurableFontScale = document.getElementById('configurableFontScale');
const observationTitle = document.getElementById('observationTitle');
const observationStyle = document.getElementById('observationStyle');
const uppercaseProduct = document.getElementById('uppercaseProduct');
const showVariation = document.getElementById('showVariation');
const uppercaseVariation = document.getElementById('uppercaseVariation');
const showGroupTitles = document.getElementById('showGroupTitles');
const uppercaseGroupTitles = document.getElementById('uppercaseGroupTitles');
const uppercaseConfigurableOptions = document.getElementById('uppercaseConfigurableOptions');
const showFractions = document.getElementById('showFractions');
const showConfigurableOptionQuantities = document.getElementById('showConfigurableOptionQuantities');
const showConfigurationDivider = document.getElementById('showConfigurationDivider');
const uppercaseObservation = document.getElementById('uppercaseObservation');
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
const exportLayoutButton = document.getElementById('exportLayoutButton');
const importLayoutButton = document.getElementById('importLayoutButton');
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
let activePreviewTarget = null;
let currentStatus = null;
let connectionSettings = null;

const transportLabels = {
  auto: 'Automático',
  supabase_realtime: 'Tempo real seguro',
  polling: 'Polling de contingência',
};

const previewTargetByControl = {
  paperWidth: 'document',
  showPrices: 'items',
  showOptions: 'options',
  showNotes: 'notes',
  variationLabel: 'configurableItems',
  configurableFontScale: 'configurableItems',
  observationTitle: 'configurableItems',
  observationStyle: 'configurableItems',
  uppercaseProduct: 'configurableItems',
  showVariation: 'configurableItems',
  uppercaseVariation: 'configurableItems',
  showGroupTitles: 'configurableItems',
  uppercaseGroupTitles: 'configurableItems',
  uppercaseConfigurableOptions: 'configurableItems',
  showFractions: 'configurableItems',
  showConfigurableOptionQuantities: 'configurableItems',
  showConfigurationDivider: 'configurableItems',
  uppercaseObservation: 'configurableItems',
  showOptionGroups: 'options',
  showOptionQuantities: 'options',
  uppercaseOptions: 'options',
  boldOptions: 'options',
  highlightOptions: 'options',
  optionPrefix: 'options',
  marginTop: 'document',
  marginRight: 'document',
  marginBottom: 'document',
  marginLeft: 'document',
  blockGap: 'blocks',
  lineGap: 'document',
  itemGap: 'items',
  indent: 'options',
  boxPadding: 'boxes',
  printableReduction: 'document',
  baseFont: 'document',
  titleFont: 'title',
  ticketFont: 'title',
  productFont: 'products',
  optionFont: 'options',
  noteFont: 'notes',
  metaFont: 'meta',
  totalFont: 'totals',
  showBorders: 'boxes',
  borderWidth: 'boxes',
  dividerWidth: 'dividers',
  itemDividerWidth: 'items',
  footerText: 'footer',
};

const previewSelectorsByTarget = {
  document: ['body'],
  blocks: ['.print-block'],
  boxes: ['.info-box', '.address-box', '.payment-box', '.ticket-number', '.kitchen-meta', '.tag'],
  dividers: ['.divider', '.solid'],
  items: ['[data-preview-block="items"]', '.item'],
  configurableItems: ['.configurable-item'],
  products: ['.product'],
  options: ['.option'],
  notes: ['.obs'],
  meta: [
    '[data-preview-block="customer"]',
    '[data-preview-block="address"]',
    '[data-preview-block="payment"]',
    '[data-preview-block="kitchenMeta"]',
    '.info-box',
    '.address-box',
    '.payment-box',
    '.kitchen-meta',
  ],
  title: ['[data-preview-block="title"]', '.ticket-number'],
  totals: ['[data-preview-block="totals"]', '.total'],
  footer: ['[data-preview-block="footer"]'],
};

function render(status) {
  currentStatus = status;
  const paired = Boolean(status?.paired);
  pairing.classList.toggle('hidden', paired);
  statusPanel.classList.toggle('hidden', !paired);
  deviceName.textContent = status?.deviceName || '-';
  deviceId.textContent = status?.deviceId || '-';
  agentName.textContent = status?.agent?.nome || status?.agent?.name || '-';
  printers.textContent = String(status?.printers ?? '-');
  lastSeen.textContent = status?.lastSeenAt ? new Date(status.lastSeenAt).toLocaleString('pt-BR') : '-';
  const settings = status?.connectionSettings || connectionSettings;
  if (settings) connectionSettings = settings;
  backendAddress.textContent = settings?.apiBaseUrl || '-';
  transportName.textContent = transportLabels[status?.transport || settings?.transport] || '-';
  statusDot.classList.toggle('online', paired && status?.running && !status?.lastError);
  statusText.textContent = status?.lastError || (paired ? 'Conectado' : 'Aguardando vinculação');
  if (status?.authFailed) message.textContent = 'Credencial revogada. Vincule este computador novamente.';
  if (status?.connectionSaved) {
    message.textContent = status?.requiresRePairing
      ? 'Conexão salva. Como o ambiente mudou, vincule este computador novamente.'
      : 'Configuração de conexão salva.';
  }
}

async function refresh() {
  render(await window.entregaiAgent.getStatus());
}

function renderUpdateStatus(status) {
  currentVersion.textContent = `Versão ${status?.currentVersion || '-'}`;
  updateStatus.textContent = status?.message || 'Atualizações aguardando inicialização.';
  updatePanel.classList.toggle('update-ready', Boolean(status?.ready));
  updatePanel.classList.toggle('update-failed', status?.status === 'error');

  const showProgress = Number.isFinite(status?.progress);
  updateProgress.classList.toggle('hidden', !showProgress);
  if (showProgress) updateProgress.value = status.progress;

  updateError.classList.toggle('hidden', !status?.error);
  updateError.textContent = status?.error ? `Detalhes: ${status.error}` : '';
}

async function loadUpdateStatus() {
  try {
    renderUpdateStatus(await window.entregaiAgent.getUpdateStatus());
  } catch {
    renderUpdateStatus({ message: 'Não foi possível consultar o estado das atualizações.' });
  }
}

function fillConnectionForm(settings) {
  connectionSettings = settings;
  backendUrl.value = settings?.apiBaseUrl || '';
  agentEnvironment.value = settings?.environment || 'development';
  printTransport.value = settings?.transport || 'auto';
}

async function loadConnectionSettings() {
  try {
    fillConnectionForm(await window.entregaiAgent.getConnectionSettings());
  } catch (error) {
    connectionMessage.textContent = error.message || 'Não foi possível carregar a configuração de conexão.';
  }
}

function setConnectionEditorOpen(open) {
  connectionPanel.classList.toggle('hidden', !open);
  connectionToggleButton.textContent = open ? 'Fechar configuração' : 'Configurar conexão';
  connectionMessage.textContent = '';
  if (open && connectionSettings) fillConnectionForm(connectionSettings);
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
  const openBlockIds = new Set(
    Array.from(blockList.querySelectorAll('.block-card[open][data-block-id]'))
      .map((card) => card.dataset.blockId)
      .filter(Boolean)
  );

  blockList.innerHTML = profile.blocks.map((block, index) => `
    <details class="block-card" data-index="${index}" data-block-id="${block.id}" ${openBlockIds.has(block.id) ? 'open' : ''}>
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
  const configurableItems = profile.configurableItems || {};
  updateTabs();
  paperWidth.value = String(profile.paperWidthMm || 80);
  showPrices.checked = Boolean(profile.itemOptions?.showPrices);
  showOptions.checked = profile.itemOptions?.showOptions !== false;
  showNotes.checked = profile.itemOptions?.showNotes !== false;
  variationLabel.value = configurableItems.variation_label || '';
  configurableFontScale.value = configurableItems.font_scale || 'normal';
  observationTitle.value = configurableItems.observation_title || '';
  observationStyle.value = configurableItems.observation_style || 'box';
  uppercaseProduct.checked = configurableItems.uppercase_product !== false;
  showVariation.checked = configurableItems.show_variation !== false;
  uppercaseVariation.checked = configurableItems.uppercase_variation !== false;
  showGroupTitles.checked = configurableItems.show_group_titles !== false;
  uppercaseGroupTitles.checked = configurableItems.uppercase_group_titles !== false;
  uppercaseConfigurableOptions.checked = configurableItems.uppercase_options !== false;
  showFractions.checked = configurableItems.show_fractions !== false;
  showConfigurableOptionQuantities.checked = configurableItems.show_option_quantities !== false;
  showConfigurationDivider.checked = configurableItems.show_configuration_divider !== false;
  uppercaseObservation.checked = configurableItems.uppercase_observation !== false;
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

function updateConfigurableItems(patch, { render = true } = {}) {
  const profile = currentProfile();
  printLayout = clone(printLayout);
  printLayout[activeProfile] = {
    ...profile,
    configurableItems: {
      ...(profile.configurableItems || {}),
      ...patch,
    },
  };
  if (render) renderLayoutForm();
  else schedulePreview();
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

function previewSelectors(target) {
  if (!target) return [];
  if (target.startsWith('block:')) {
    const blockId = target.slice('block:'.length);
    return [`[data-preview-block="${blockId}"]`];
  }
  return previewSelectorsByTarget[target] || [];
}

function clearPreviewHighlight(doc = printPreview.contentDocument) {
  if (!doc) return;
  doc.querySelectorAll('.preview-highlight').forEach((element) => {
    element.classList.remove('preview-highlight');
  });
}

function applyPreviewHighlight({ shouldScroll = false } = {}) {
  const doc = printPreview.contentDocument;
  if (!doc?.body) return;
  clearPreviewHighlight(doc);
  const selectors = previewSelectors(activePreviewTarget);
  if (!selectors.length) return;

  let elements = selectors.flatMap((selector) => Array.from(doc.querySelectorAll(selector)));
  if (!elements.length && ['options', 'notes', 'products'].includes(activePreviewTarget)) {
    elements = Array.from(doc.querySelectorAll('[data-preview-block="items"]'));
  }
  const uniqueElements = [...new Set(elements)];
  uniqueElements.forEach((element) => element.classList.add('preview-highlight'));

  const firstElement = uniqueElements.find((element) => element !== doc.body) || uniqueElements[0];
  if (shouldScroll && firstElement) {
    firstElement.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
  }
}

function previewTargetForControl(control) {
  const blockCard = control.closest('.block-card');
  if (blockCard?.dataset.blockId) return `block:${blockCard.dataset.blockId}`;
  return previewTargetByControl[control.id] || null;
}

function setActivePreviewTarget(control, shouldScroll = true) {
  const target = previewTargetForControl(control);
  if (!target) return;
  activePreviewTarget = target;
  applyPreviewHighlight({ shouldScroll });
}

async function updatePreview() {
  if (!printLayout) return;
  try {
    updatePreviewFrameSize();
    const html = await window.entregaiAgent.previewPrintLayout(activeProfile, printLayout);
    printPreview.addEventListener('load', () => applyPreviewHighlight(), { once: true });
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

connectionToggleButton.addEventListener('click', () => {
  setConnectionEditorOpen(connectionPanel.classList.contains('hidden'));
});

cancelConnectionButton.addEventListener('click', () => {
  setConnectionEditorOpen(false);
});

saveConnectionButton.addEventListener('click', async () => {
  const proposed = {
    apiBaseUrl: backendUrl.value,
    environment: agentEnvironment.value,
    transport: printTransport.value,
  };
  const environmentChanged = connectionSettings?.environment !== proposed.environment;
  if (currentStatus?.paired && environmentChanged) {
    const confirmed = confirm('A mudança de ambiente desvinculará este computador. Deseja continuar?');
    if (!confirmed) return;
  }

  try {
    saveConnectionButton.disabled = true;
    connectionMessage.textContent = '';
    const status = await window.entregaiAgent.saveConnectionSettings(proposed);
    fillConnectionForm(status.connectionSettings);
    render(status);
    setConnectionEditorOpen(false);
  } catch (error) {
    connectionMessage.textContent = error.message || 'Não foi possível salvar a configuração de conexão.';
  } finally {
    saveConnectionButton.disabled = false;
  }
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

variationLabel.addEventListener('input', () => {
  updateConfigurableItems({ variation_label: variationLabel.value }, { render: false });
});

configurableFontScale.addEventListener('change', () => {
  updateConfigurableItems({ font_scale: configurableFontScale.value });
});

observationTitle.addEventListener('input', () => {
  updateConfigurableItems({ observation_title: observationTitle.value }, { render: false });
});

observationStyle.addEventListener('change', () => {
  updateConfigurableItems({ observation_style: observationStyle.value });
});

uppercaseProduct.addEventListener('change', () => {
  updateConfigurableItems({ uppercase_product: uppercaseProduct.checked });
});

showVariation.addEventListener('change', () => {
  updateConfigurableItems({ show_variation: showVariation.checked });
});

uppercaseVariation.addEventListener('change', () => {
  updateConfigurableItems({ uppercase_variation: uppercaseVariation.checked });
});

showGroupTitles.addEventListener('change', () => {
  updateConfigurableItems({ show_group_titles: showGroupTitles.checked });
});

uppercaseGroupTitles.addEventListener('change', () => {
  updateConfigurableItems({ uppercase_group_titles: uppercaseGroupTitles.checked });
});

uppercaseConfigurableOptions.addEventListener('change', () => {
  updateConfigurableItems({ uppercase_options: uppercaseConfigurableOptions.checked });
});

showFractions.addEventListener('change', () => {
  updateConfigurableItems({ show_fractions: showFractions.checked });
});

showConfigurableOptionQuantities.addEventListener('change', () => {
  updateConfigurableItems({ show_option_quantities: showConfigurableOptionQuantities.checked });
});

showConfigurationDivider.addEventListener('change', () => {
  updateConfigurableItems({ show_configuration_divider: showConfigurationDivider.checked });
});

uppercaseObservation.addEventListener('change', () => {
  updateConfigurableItems({ uppercase_observation: uppercaseObservation.checked });
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

layoutPanel.addEventListener('focusin', (event) => {
  const control = event.target.closest('input, select, textarea, button[data-action]');
  if (control) setActivePreviewTarget(control);
});

layoutPanel.addEventListener('click', (event) => {
  const control = event.target.closest('input, select, textarea, button[data-action]');
  if (control) setActivePreviewTarget(control);
});

layoutPanel.addEventListener('input', (event) => {
  const control = event.target.closest('input, select, textarea');
  if (control) setActivePreviewTarget(control, false);
});

layoutPanel.addEventListener('change', (event) => {
  const control = event.target.closest('input, select, textarea');
  if (control) setActivePreviewTarget(control, false);
});

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

exportLayoutButton.addEventListener('click', async () => {
  try {
    exportLayoutButton.disabled = true;
    const result = await window.entregaiAgent.exportPrintLayout(printLayout);
    if (result?.layout) {
      printLayout = result.layout;
      renderLayoutForm();
    }
    if (!result?.canceled) showLayoutMessage('Arquivo de layout baixado.');
  } catch (error) {
    showLayoutMessage(error.message || 'Não foi possível baixar o layout.', true);
  } finally {
    exportLayoutButton.disabled = false;
  }
});

importLayoutButton.addEventListener('click', async () => {
  try {
    importLayoutButton.disabled = true;
    const result = await window.entregaiAgent.importPrintLayout();
    if (result?.layout) {
      printLayout = result.layout;
      renderLayoutForm();
    }
    if (!result?.canceled) showLayoutMessage('Layout compartilhado aplicado.');
  } catch (error) {
    showLayoutMessage(error.message || 'Não foi possível usar o layout compartilhado.', true);
  } finally {
    importLayoutButton.disabled = false;
  }
});

window.entregaiAgent.onStatus(render);
window.entregaiAgent.onUpdateStatus(renderUpdateStatus);
refresh();
loadUpdateStatus();
loadConnectionSettings();
loadPrintLayout();
