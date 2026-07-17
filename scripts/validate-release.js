const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const outputDirectory = path.resolve(projectRoot, process.argv[2] || 'dist');
const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
const version = process.argv[3] || packageJson.version;
const installerName = `entregai-print-agent-setup-${version}.exe`;
const installerPath = path.join(outputDirectory, installerName);
const blockmapPath = `${installerPath}.blockmap`;
const metadataPath = path.join(outputDirectory, 'latest.yml');

for (const requiredPath of [installerPath, blockmapPath, metadataPath]) {
  if (!fs.existsSync(requiredPath)) {
    throw new Error(`Artefato obrigatório ausente: ${requiredPath}`);
  }
}

const metadata = fs.readFileSync(metadataPath, 'utf8');
const metadataVersion = metadata.match(/^version:\s*['"]?([^'"\r\n]+)['"]?\s*$/m)?.[1]?.trim();
const metadataUrlValue = metadata.match(/^\s*-\s+url:\s*['"]?([^'"\r\n]+)['"]?\s*$/m)?.[1]?.trim();
const metadataPathValue = metadata.match(/^path:\s*['"]?([^'"\r\n]+)['"]?\s*$/m)?.[1]?.trim();
const metadataHash = metadata.match(/^sha512:\s*['"]?([^'"\r\n]+)['"]?\s*$/m)?.[1]?.trim();
const installerHash = crypto.createHash('sha512').update(fs.readFileSync(installerPath)).digest('base64');

if (metadataVersion !== version) {
  throw new Error(`Versão inválida em latest.yml: esperado ${version}, recebido ${metadataVersion || 'ausente'}`);
}
if (metadataUrlValue !== installerName || metadataPathValue !== installerName) {
  throw new Error(
    `URL/caminho inválido em latest.yml: esperado ${installerName}, ` +
    `recebido URL=${metadataUrlValue || 'ausente'} e caminho=${metadataPathValue || 'ausente'}`,
  );
}
if (metadataHash !== installerHash) {
  throw new Error('O hash SHA-512 do instalador não corresponde ao latest.yml.');
}

console.log(`Release ${version} validada: ${installerName}, blockmap e latest.yml.`);
