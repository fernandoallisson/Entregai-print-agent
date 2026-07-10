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

window.entregaiAgent.onStatus(render);
refresh();
