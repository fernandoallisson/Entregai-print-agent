const fs = require('fs');
const path = require('path');

const required = [
  'src/main/main.js',
  'src/main/apiClient.js',
  'src/main/agentRuntime.js',
  'src/main/updateService.js',
  'src/main/printLayoutConfig.js',
  'src/main/printerService.js',
  'src/preload/preload.js',
  'src/renderer/index.html',
  'src/renderer/renderer.js',
  'scripts/normalize-update-metadata.js',
  'scripts/validate-release.js',
  '.github/workflows/release.yml',
  'RELEASE.md',
];

for (const file of required) {
  if (!fs.existsSync(path.join(__dirname, '..', file))) {
    throw new Error(`Arquivo obrigatório ausente: ${file}`);
  }
}

console.log('Entregaí Print Agent: verificação concluída.');
