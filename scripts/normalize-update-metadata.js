const fs = require('fs');
const path = require('path');

function normalizeUpdateMetadata({ projectRoot = path.resolve(__dirname, '..') } = {}) {
  const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
  const outputDirectory = path.join(projectRoot, packageJson.build.directories?.output || 'dist');
  const installerName = `${packageJson.build.productName} Setup ${packageJson.version}.exe`;
  const installerPath = path.join(outputDirectory, installerName);
  const metadataPath = path.join(outputDirectory, 'latest.yml');

  if (!fs.existsSync(installerPath)) throw new Error(`Instalador ausente: ${installerPath}`);
  if (!fs.existsSync(metadataPath)) throw new Error(`Metadado ausente: ${metadataPath}`);

  const original = fs.readFileSync(metadataPath, 'utf8');
  if (!/^\s*-\s+url:\s*.+$/m.test(original) || !/^path:\s*.+$/m.test(original)) {
    throw new Error('Não foi possível localizar URL e caminho em latest.yml.');
  }
  const normalized = original
    .replace(/^(\s*-\s+url:\s*).+$/m, `$1${installerName}`)
    .replace(/^(path:\s*).+$/m, `$1${installerName}`);

  if (normalized !== original) fs.writeFileSync(metadataPath, normalized, 'utf8');
  console.log(`latest.yml confirmado para o asset: ${installerName}`);
  return { installerName, metadataPath };
}

if (require.main === module) normalizeUpdateMetadata();

module.exports = normalizeUpdateMetadata;
