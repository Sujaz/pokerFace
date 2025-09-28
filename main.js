const settingsToggle = document.querySelector('#settings-toggle');
const settingsPanel = document.querySelector('#settings-panel');
const settingsOverlay = document.querySelector('#settings-overlay');
const closeSettingsBtn = document.querySelector('#close-settings');

const hostNameInput = document.querySelector('#host-name');
const locationInput = document.querySelector('#host-location');
const datetimeInput = document.querySelector('#session-datetime');
const expenseInput = document.querySelector('#table-expense');
const reportedFinalInput = document.querySelector('#reported-final');
const currencySelect = document.querySelector('#currency-select');
const sessionStatusSelect = document.querySelector('#session-status');

const addPlayerBtn = document.querySelector('#add-player-btn');
const playersBody = document.querySelector('#players-body');
const resetBtn = document.querySelector('#reset-btn');
const playerLinkSpan = document.querySelector('#player-link');
const playerModeBanner = document.querySelector('#player-mode-banner');
const sessionStatusIndicator = document.querySelector('#session-status-indicator');

const totalBuyinsEl = document.querySelector('#total-buyins');
const totalFinalEl = document.querySelector('#total-final');
const tableDeltaEl = document.querySelector('#table-delta');
const summaryExpensesEl = document.querySelector('#summary-expenses');
const amountLeftEl = document.querySelector('#amount-left');
const winsLossesEl = document.querySelector('#wins-losses');

const displayHostEl = document.querySelector('#display-host');
const displayLocationEl = document.querySelector('#display-location');
const displayDatetimeEl = document.querySelector('#display-datetime');
const displayReportedFinalEl = document.querySelector('#display-reported-final');
const displayExpensesEl = document.querySelector('#display-expenses');

const STORAGE_KEY = 'poker-night-tracker';
const CURRENCY_SYMBOLS = {
  USD: '$',
  EUR: '€',
  ILS: '₪',
};

const searchParams = new URLSearchParams(window.location.search);
const isPlayerView = searchParams.get('role') === 'player';

function getCurrencySymbol() {
  return CURRENCY_SYMBOLS[currencySelect.value] ?? '$';
}

function formatCurrency(value) {
  const number = Number(value) || 0;
  const currency = currencySelect.value in CURRENCY_SYMBOLS ? currencySelect.value : 'USD';
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(number);
}

function generateId() {
  return `player-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}

function getPlayersData() {
  return Array.from(playersBody.querySelectorAll('tr')).map((row) => {
    const name = row.querySelector('.player-name').value.trim();
    const buyins = Number(row.querySelector('.player-buyins').value) || 0;
    const final = Number(row.querySelector('.player-final').value) || 0;
    return {
      id: row.dataset.id,
      name,
      buyins,
      final,
    };
  });
}

function persistState() {
  const state = {
    settings: {
      hostName: hostNameInput.value,
      location: locationInput.value,
      datetime: datetimeInput.value,
      expenses: expenseInput.value,
      reportedFinal: reportedFinalInput.value,
      currency: currencySelect.value,
      sessionStatus: sessionStatusSelect.value,
    },
    players: getPlayersData(),
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function restoreState() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return;

  try {
    const state = JSON.parse(stored);
    const settings = state.settings ?? {};

    hostNameInput.value = settings.hostName ?? '';
    locationInput.value = settings.location ?? '';
    datetimeInput.value = settings.datetime ?? '';
    expenseInput.value = settings.expenses ?? '';
    reportedFinalInput.value = settings.reportedFinal ?? '';

    if (settings.currency && settings.currency in CURRENCY_SYMBOLS) {
      currencySelect.value = settings.currency;
    } else {
      currencySelect.value = 'USD';
    }

    if (settings.sessionStatus === 'closed') {
      sessionStatusSelect.value = 'closed';
    } else {
      sessionStatusSelect.value = 'open';
    }

    playersBody.innerHTML = '';
    (state.players ?? []).forEach((player) => {
      const row = createPlayerRow(player);
      playersBody.appendChild(row);
    });
  } catch (error) {
    console.error('Failed to restore tracker state', error);
  }
}

function updateEventDetails() {
  displayHostEl.textContent = hostNameInput.value.trim() || '—';
  displayLocationEl.textContent = locationInput.value.trim() || '—';

  if (datetimeInput.value) {
    const date = new Date(datetimeInput.value);
    if (!Number.isNaN(date.valueOf())) {
      displayDatetimeEl.textContent = new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(date);
    } else {
      displayDatetimeEl.textContent = '—';
    }
  } else {
    displayDatetimeEl.textContent = '—';
  }

  displayReportedFinalEl.textContent = formatCurrency(reportedFinalInput.value);
  displayExpensesEl.textContent = formatCurrency(expenseInput.value);
}

function updateSessionStatusUI() {
  const isClosed = sessionStatusSelect.value === 'closed';
  if (sessionStatusIndicator) {
    sessionStatusIndicator.textContent = isClosed ? 'Session closed' : 'Session open';
    sessionStatusIndicator.classList.toggle('closed', isClosed);
  }

  const disablePlayerInputs = isClosed;
  playersBody.querySelectorAll('input').forEach((input) => {
    input.disabled = disablePlayerInputs;
  });
  playersBody.querySelectorAll('.remove-player').forEach((button) => {
    button.disabled = disablePlayerInputs;
    button.classList.toggle('disabled', disablePlayerInputs);
  });

  if (addPlayerBtn) {
    addPlayerBtn.disabled = isClosed;
    addPlayerBtn.classList.toggle('disabled', isClosed);
  }
}

function updateCurrencySymbols() {
  const symbol = getCurrencySymbol();
  document.querySelectorAll('.currency-symbol').forEach((span) => {
    span.textContent = symbol;
  });
  updateEventDetails();
}

function updateSummary() {
  const players = getPlayersData();
  const totalBuyins = players.reduce((sum, player) => sum + player.buyins, 0);
  const totalFinal = players.reduce((sum, player) => sum + player.final, 0);
  const expenses = Number(expenseInput.value) || 0;
  const tableDelta = totalFinal - totalBuyins;
  const amountLeft = totalFinal - expenses;
  const wins = players.filter((player) => player.final - player.buyins > 0).length;
  const losses = players.filter((player) => player.final - player.buyins < 0).length;

  totalBuyinsEl.textContent = formatCurrency(totalBuyins);
  totalFinalEl.textContent = formatCurrency(totalFinal);
  tableDeltaEl.textContent = formatCurrency(tableDelta);
  tableDeltaEl.classList.toggle('alert', Math.abs(tableDelta) > 0.0001);
  summaryExpensesEl.textContent = formatCurrency(expenses);
  amountLeftEl.textContent = formatCurrency(amountLeft);
  winsLossesEl.textContent = `${wins} / ${losses}`;
}

function updatePlayerLink() {
  if (!playerLinkSpan) return;
  const url = new URL(window.location.href);
  url.searchParams.set('role', 'player');
  playerLinkSpan.innerHTML = `<a href="${url.toString()}" target="_blank" rel="noopener">${url.toString()}</a>`;
}

function attachInputListeners(element, handler) {
  element.addEventListener('input', handler);
  element.addEventListener('change', handler);
}

function handlePlayerInputChange(row) {
  const buyinsInput = row.querySelector('.player-buyins');
  const finalInput = row.querySelector('.player-final');
  const nameInput = row.querySelector('.player-name');
  const netCell = row.querySelector('.net-result');
  const outcomeCell = row.querySelector('.outcome');

  const buyins = Number(buyinsInput.value) || 0;
  const final = Number(finalInput.value) || 0;
  const net = final - buyins;

  netCell.textContent = formatCurrency(net);
  netCell.classList.remove('positive', 'negative');
  outcomeCell.classList.remove('positive', 'negative');

  if (net > 0) {
    netCell.classList.add('positive');
    outcomeCell.textContent = 'Win';
    outcomeCell.classList.add('positive');
  } else if (net < 0) {
    netCell.classList.add('negative');
    outcomeCell.textContent = 'Loss';
    outcomeCell.classList.add('negative');
  } else if (nameInput.value.trim()) {
    outcomeCell.textContent = 'Break even';
  } else {
    outcomeCell.textContent = '–';
  }

  persistState();
  updateSummary();
}

function createPlayerRow(player = {}) {
  const template = document.querySelector('#player-row-template');
  const row = template.content.firstElementChild.cloneNode(true);
  row.dataset.id = player.id ?? generateId();

  const nameInput = row.querySelector('.player-name');
  const buyinsInput = row.querySelector('.player-buyins');
  const finalInput = row.querySelector('.player-final');
  const removeBtn = row.querySelector('.remove-player');

  nameInput.value = player.name ?? '';
  buyinsInput.value = player.buyins ?? '';
  finalInput.value = player.final ?? '';

  row.querySelectorAll('.currency-symbol').forEach((span) => {
    span.textContent = getCurrencySymbol();
  });

  const updateRow = () => handlePlayerInputChange(row);

  [nameInput, buyinsInput, finalInput].forEach((input) => {
    input.addEventListener('input', updateRow);
    input.addEventListener('change', updateRow);
  });

  removeBtn.addEventListener('click', () => {
    if (isPlayerView) return;
    row.remove();
    persistState();
    updateSummary();
  });

  if (isPlayerView) {
    removeBtn.classList.add('hidden');
  }

  handlePlayerInputChange(row);

  return row;
}

function refreshAllRows() {
  playersBody.querySelectorAll('tr').forEach((row) => {
    handlePlayerInputChange(row);
  });
}

function resetAll() {
  const confirmation = confirm('Reset host info and remove all players?');
  if (!confirmation) {
    return;
  }

  hostNameInput.value = '';
  locationInput.value = '';
  datetimeInput.value = '';
  expenseInput.value = '';
  reportedFinalInput.value = '';
  currencySelect.value = 'USD';
  sessionStatusSelect.value = 'open';

  playersBody.innerHTML = '';
  addPlayerRow();
  persistState();
  updateCurrencySymbols();
  updateSummary();
  updateEventDetails();
  updateSessionStatusUI();
}

function addPlayerRow(player = {}) {
  const row = createPlayerRow(player);
  playersBody.appendChild(row);
  return row;
}

function setupSettingsPanel() {
  if (!settingsToggle || !settingsPanel || !settingsOverlay) {
    return;
  }

  const openPanel = () => {
    settingsPanel.classList.add('open');
    settingsOverlay.classList.add('visible');
    settingsPanel.setAttribute('aria-hidden', 'false');
    settingsOverlay.setAttribute('aria-hidden', 'false');
  };

  const closePanel = () => {
    settingsPanel.classList.remove('open');
    settingsOverlay.classList.remove('visible');
    settingsPanel.setAttribute('aria-hidden', 'true');
    settingsOverlay.setAttribute('aria-hidden', 'true');
  };

  settingsToggle.addEventListener('click', () => {
    const isOpen = settingsPanel.classList.contains('open');
    if (isOpen) {
      closePanel();
    } else {
      openPanel();
    }
  });

  closeSettingsBtn?.addEventListener('click', closePanel);
  settingsOverlay.addEventListener('click', closePanel);
}

function updateViewForRole() {
  if (isPlayerView) {
    settingsToggle?.classList.add('hidden');
    settingsPanel?.classList.add('player-hidden');
    playerModeBanner?.removeAttribute('hidden');
    if (addPlayerBtn) {
      addPlayerBtn.textContent = 'Register player';
    }
    if (resetBtn) {
      resetBtn.disabled = true;
      resetBtn.classList.add('disabled');
    }
  }
}

function init() {
  restoreState();

  if (playersBody.children.length === 0) {
    addPlayerRow();
  }

  updateViewForRole();
  setupSettingsPanel();
  updateCurrencySymbols();
  updateEventDetails();
  updateSummary();
  updateSessionStatusUI();
  updatePlayerLink();

  attachInputListeners(hostNameInput, () => {
    updateEventDetails();
    persistState();
  });
  attachInputListeners(locationInput, () => {
    updateEventDetails();
    persistState();
  });
  attachInputListeners(datetimeInput, () => {
    updateEventDetails();
    persistState();
  });
  attachInputListeners(expenseInput, () => {
    updateEventDetails();
    persistState();
    updateSummary();
  });
  attachInputListeners(reportedFinalInput, () => {
    updateEventDetails();
    persistState();
  });
  attachInputListeners(currencySelect, () => {
    updateCurrencySymbols();
    refreshAllRows();
    persistState();
    updateSummary();
  });
  attachInputListeners(sessionStatusSelect, () => {
    updateSessionStatusUI();
    persistState();
  });

  addPlayerBtn?.addEventListener('click', () => {
    const row = addPlayerRow();
    if (sessionStatusSelect.value === 'closed') {
      updateSessionStatusUI();
      return;
    }
    row.querySelector('.player-name')?.focus();
    persistState();
    updateSummary();
  });

  resetBtn?.addEventListener('click', resetAll);
}

window.addEventListener('DOMContentLoaded', init);
