const TEXT_SIZES = ['small', 'normal', 'large', 'huge'];
const ALIGNMENTS = ['left', 'center', 'right'];

const DEFAULT_PRINT_LAYOUT = {
  version: 1,
  customer: {
    paperWidthMm: 80,
    footerText: '',
    layout: {
      marginsMm: { top: 3, right: 2, bottom: 3, left: 3 },
      printableReductionMm: 5,
      blockGapPx: 6,
      lineGapPx: 4,
      itemGapPx: 7,
      boxPaddingPx: 6,
      indentPx: 12,
      baseFontPx: 13,
      titleFontPx: 16,
      ticketFontPx: 24,
      productFontPx: 14,
      optionFontPx: 12,
      noteFontPx: 13,
      metaFontPx: 14,
      totalFontPx: 15,
      showBorders: true,
      borderWidthPx: 1,
      dividerWidthPx: 1,
      itemDividerWidthPx: 1,
    },
    itemOptions: {
      showPrices: true,
      showOptions: true,
      showNotes: true,
      showOptionGroups: true,
      showOptionQuantities: true,
      optionPrefix: '',
      uppercaseOptions: false,
      boldOptions: false,
      highlightOptions: false,
    },
    blocks: [
      { id: 'storeHeader', enabled: true, size: 'normal', bold: false, align: 'center' },
      { id: 'title', enabled: true, size: 'large', bold: true, align: 'center' },
      { id: 'customer', enabled: true, size: 'normal', bold: false, align: 'left' },
      { id: 'address', enabled: true, size: 'normal', bold: false, align: 'left' },
      { id: 'items', enabled: true, size: 'normal', bold: false, align: 'left' },
      { id: 'totals', enabled: true, size: 'large', bold: true, align: 'left' },
      { id: 'payment', enabled: true, size: 'normal', bold: false, align: 'left' },
      { id: 'footer', enabled: false, size: 'normal', bold: false, align: 'center' },
    ],
  },
  kitchen: {
    paperWidthMm: 80,
    footerText: '',
    layout: {
      marginsMm: { top: 3, right: 2, bottom: 3, left: 3 },
      printableReductionMm: 5,
      blockGapPx: 8,
      lineGapPx: 5,
      itemGapPx: 10,
      boxPaddingPx: 7,
      indentPx: 12,
      baseFontPx: 19,
      titleFontPx: 22,
      ticketFontPx: 54,
      productFontPx: 29,
      optionFontPx: 22,
      noteFontPx: 24,
      metaFontPx: 18,
      totalFontPx: 20,
      showBorders: true,
      borderWidthPx: 2,
      dividerWidthPx: 2,
      itemDividerWidthPx: 2,
    },
    itemOptions: {
      showPrices: false,
      showOptions: true,
      showNotes: true,
      showOptionGroups: true,
      showOptionQuantities: true,
      optionPrefix: '',
      uppercaseOptions: false,
      boldOptions: true,
      highlightOptions: true,
    },
    blocks: [
      { id: 'title', enabled: true, size: 'huge', bold: true, align: 'center' },
      { id: 'kitchenMeta', enabled: true, size: 'large', bold: true, align: 'left' },
      { id: 'items', enabled: true, size: 'huge', bold: true, align: 'left' },
      { id: 'footer', enabled: false, size: 'large', bold: true, align: 'center' },
    ],
  },
};

const BLOCK_LABELS = {
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

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function validChoice(value, valid, fallback) {
  return valid.includes(value) ? value : fallback;
}

function clampNumber(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function normalizeMargins(input = {}, fallback = {}) {
  return {
    top: clampNumber(input.top, fallback.top, 0, 20),
    right: clampNumber(input.right, fallback.right, 0, 20),
    bottom: clampNumber(input.bottom, fallback.bottom, 0, 20),
    left: clampNumber(input.left, fallback.left, 0, 20),
  };
}

function normalizeLayout(input = {}, fallback = {}) {
  return {
    marginsMm: normalizeMargins(input.marginsMm, fallback.marginsMm),
    printableReductionMm: clampNumber(input.printableReductionMm, fallback.printableReductionMm, 0, 20),
    blockGapPx: clampNumber(input.blockGapPx, fallback.blockGapPx, 0, 48),
    lineGapPx: clampNumber(input.lineGapPx, fallback.lineGapPx, 0, 24),
    itemGapPx: clampNumber(input.itemGapPx, fallback.itemGapPx, 0, 64),
    boxPaddingPx: clampNumber(input.boxPaddingPx, fallback.boxPaddingPx, 0, 32),
    indentPx: clampNumber(input.indentPx, fallback.indentPx, 0, 48),
    baseFontPx: clampNumber(input.baseFontPx, fallback.baseFontPx, 8, 40),
    titleFontPx: clampNumber(input.titleFontPx, fallback.titleFontPx, 8, 56),
    ticketFontPx: clampNumber(input.ticketFontPx, fallback.ticketFontPx, 12, 96),
    productFontPx: clampNumber(input.productFontPx, fallback.productFontPx, 8, 64),
    optionFontPx: clampNumber(input.optionFontPx, fallback.optionFontPx, 8, 48),
    noteFontPx: clampNumber(input.noteFontPx, fallback.noteFontPx, 8, 56),
    metaFontPx: clampNumber(input.metaFontPx, fallback.metaFontPx, 8, 48),
    totalFontPx: clampNumber(input.totalFontPx, fallback.totalFontPx, 8, 56),
    showBorders: typeof input.showBorders === 'boolean' ? input.showBorders : fallback.showBorders,
    borderWidthPx: clampNumber(input.borderWidthPx, fallback.borderWidthPx, 0, 8),
    dividerWidthPx: clampNumber(input.dividerWidthPx, fallback.dividerWidthPx, 0, 8),
    itemDividerWidthPx: clampNumber(input.itemDividerWidthPx, fallback.itemDividerWidthPx, 0, 8),
  };
}

function normalizeBlock(block = {}, fallback = {}) {
  return {
    id: fallback.id,
    enabled: typeof block.enabled === 'boolean' ? block.enabled : fallback.enabled,
    size: validChoice(block.size, TEXT_SIZES, fallback.size),
    bold: typeof block.bold === 'boolean' ? block.bold : fallback.bold,
    align: validChoice(block.align, ALIGNMENTS, fallback.align),
  };
}

function normalizeProfile(input = {}, fallback) {
  const blocksById = new Map((Array.isArray(input.blocks) ? input.blocks : []).map((block) => [block.id, block]));
  const orderedIds = Array.isArray(input.blocks)
    ? input.blocks.map((block) => block.id).filter((id) => fallback.blocks.some((item) => item.id === id))
    : [];
  const missingIds = fallback.blocks.map((block) => block.id).filter((id) => !orderedIds.includes(id));
  const ids = [...orderedIds, ...missingIds];
  const fallbackById = new Map(fallback.blocks.map((block) => [block.id, block]));

  return {
    paperWidthMm: Number.isFinite(Number(input.paperWidthMm)) ? Number(input.paperWidthMm) : fallback.paperWidthMm,
    footerText: typeof input.footerText === 'string' ? input.footerText.slice(0, 240) : fallback.footerText,
    layout: normalizeLayout(input.layout, fallback.layout),
    itemOptions: {
      showPrices: typeof input.itemOptions?.showPrices === 'boolean'
        ? input.itemOptions.showPrices
        : fallback.itemOptions.showPrices,
      showOptions: typeof input.itemOptions?.showOptions === 'boolean'
        ? input.itemOptions.showOptions
        : fallback.itemOptions.showOptions,
      showNotes: typeof input.itemOptions?.showNotes === 'boolean'
        ? input.itemOptions.showNotes
        : fallback.itemOptions.showNotes,
      showOptionGroups: typeof input.itemOptions?.showOptionGroups === 'boolean'
        ? input.itemOptions.showOptionGroups
        : fallback.itemOptions.showOptionGroups,
      showOptionQuantities: typeof input.itemOptions?.showOptionQuantities === 'boolean'
        ? input.itemOptions.showOptionQuantities
        : fallback.itemOptions.showOptionQuantities,
      optionPrefix: typeof input.itemOptions?.optionPrefix === 'string'
        ? input.itemOptions.optionPrefix.slice(0, 12)
        : fallback.itemOptions.optionPrefix,
      uppercaseOptions: typeof input.itemOptions?.uppercaseOptions === 'boolean'
        ? input.itemOptions.uppercaseOptions
        : fallback.itemOptions.uppercaseOptions,
      boldOptions: typeof input.itemOptions?.boldOptions === 'boolean'
        ? input.itemOptions.boldOptions
        : fallback.itemOptions.boldOptions,
      highlightOptions: typeof input.itemOptions?.highlightOptions === 'boolean'
        ? input.itemOptions.highlightOptions
        : fallback.itemOptions.highlightOptions,
    },
    blocks: ids.map((id) => normalizeBlock(blocksById.get(id), fallbackById.get(id))),
  };
}

function normalizePrintLayoutConfig(config = {}) {
  return {
    version: 1,
    customer: normalizeProfile(config.customer, DEFAULT_PRINT_LAYOUT.customer),
    kitchen: normalizeProfile(config.kitchen, DEFAULT_PRINT_LAYOUT.kitchen),
  };
}

module.exports = {
  BLOCK_LABELS,
  DEFAULT_PRINT_LAYOUT,
  normalizePrintLayoutConfig,
};
