const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const normalizeUpdateMetadata = require('../scripts/normalize-update-metadata');

const projectRoot = path.join(__dirname, '..');
const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
const workflow = fs.readFileSync(path.join(projectRoot, '.github/workflows/release.yml'), 'utf8');
const updateService = fs.readFileSync(path.join(projectRoot, 'src/main/updateService.js'), 'utf8');

test('configura GitHub Releases público sem credencial no aplicativo', () => {
  assert.equal(packageJson.dependencies['electron-updater'], '^6.6.2');
  assert.deepEqual(packageJson.build.publish, [{
    provider: 'github',
    owner: 'fernandoallisson',
    repo: 'Entregai-print-agent',
    releaseType: 'release',
  }]);
  assert.doesNotMatch(updateService, /GH_TOKEN|GITHUB_TOKEN|github_pat_|service_role/i);
  assert.equal(packageJson.build.win.artifactName, 'entregai-print-agent-setup-${version}.${ext}');
});

test('workflow publica somente por tag validada e inclui os três artefatos', () => {
  assert.match(workflow, /tags:\s*\r?\n\s+- 'v\*\.\*\.\*'/);
  assert.doesNotMatch(workflow, /workflow_dispatch/);
  assert.match(workflow, /permissions:\s*\r?\n\s+contents: write/);
  assert.match(workflow, /npm ci/);
  assert.match(workflow, /npm test/);
  assert.match(workflow, /npm run release:validate/);
  assert.match(workflow, /entregai-print-agent-setup-\*\.exe/);
  assert.match(workflow, /entregai-print-agent-setup-\*\.exe\.blockmap/);
  assert.match(workflow, /dist\/latest\.yml/);
  assert.match(workflow, /github\.ref_name.*-ne \$expectedTag/);
  assert.match(workflow, /fetch-depth: 0/);
  assert.match(workflow, /make_latest: true/);
  assert.match(workflow, /highestVersion/);
});

test('serviço instala automaticamente somente após a verificação de ociosidade', () => {
  assert.match(updateService, /idleProvider/);
  assert.match(updateService, /\.quitAndInstall\s*\(false, true\)/);
  assert.match(updateService, /autoInstallOnAppQuit = true/);
  assert.match(updateService, /allowDowngrade = false/);
});

test('normaliza latest.yml para o nome técnico preservado pelo GitHub', () => {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'entregai-release-'));
  const dist = path.join(temporaryRoot, 'dist');
  fs.mkdirSync(dist);
  fs.writeFileSync(path.join(temporaryRoot, 'package.json'), JSON.stringify({
    version: '1.2.3',
    build: { productName: 'Entregaí Print Agent', directories: { output: 'dist' } },
  }));
  fs.writeFileSync(path.join(dist, 'entregai-print-agent-setup-1.2.3.exe'), 'installer');
  fs.writeFileSync(path.join(dist, 'latest.yml'), [
    'version: 1.2.3',
    'files:',
    '  - url: nome-incompatível.exe',
    'path: nome-incompatível.exe',
  ].join('\n'));

  try {
    normalizeUpdateMetadata({ projectRoot: temporaryRoot });
    const metadata = fs.readFileSync(path.join(dist, 'latest.yml'), 'utf8');
    assert.match(metadata, /url: entregai-print-agent-setup-1\.2\.3\.exe/);
    assert.match(metadata, /path: entregai-print-agent-setup-1\.2\.3\.exe/);
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
});
