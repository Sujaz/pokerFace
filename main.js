const API_BASE = '/api';
const SAVE_DEBOUNCE_MS = 500;

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
const startSessionBtn = document.querySelector('#start-session-btn');

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

const scoreboardScopeSelect = document.querySelector('#scoreboard-scope');
const scoreboardSessionWrapper = document.querySelector('#scoreboard-session-wrapper');
const scoreboardYearWrapper = document.querySelector('#scoreboard-year-wrapper');
const scoreboardSessionSelect = document.querySelector('#scoreboard-session');
const scoreboardYearSelect = document.querySelector('#scoreboard-year');
const scoreboardProfitName = document.querySelector('#scoreboard-profit-name');
const scoreboardProfitValue = document.querySelector('#scoreboard-profit-value');
const scoreboardWinsName = document.querySelector('#scoreboard-wins-name');
const scoreboardWinsValue = document.querySelector('#scoreboard-wins-value');
const scoreboardTableBody = document.querySelector('#scoreboard-table');
const scoreboardNote = document.querySelector('#scoreboard-note');

const CURRENCY_SYMBOLS = {
  USD: '$',
  EUR: '€',
  ILS: '₪',
};

const searchParams = new URLSearchParams(window.location.search);
const isPlayerView = searchParams.get('role') === 'player';

let sessions = [];
let currentSession = null;
let isRestoring = false;
let saveTimeoutId = null;

function sanitizeCurrency(code) {
  return code && code in CURRENCY_SYMBOLS ? code : 'USD';
}

function getCurrencySymbol(code = currencySelect?.value) {
  return CURRENCY_SYMBOLS[sanitizeCurrency(code)] ?? '$';
}

function formatCurrency(value, currencyCode = currencySelect?.value) {
  const number = Number(value) || 0;
  const code = sanitizeCurrency(currencyCode);
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: code,
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
      id: row.dataset.id || generateId(),
      name,
      buyins,
      final,
    };
  });
}

function collectCurrentSessionData() {
  return {
    id: currentSession?.id,
    settings: {
      hostName: hostNameInput.value,
      location: locationInput.value,
      datetime: datetimeInput.value,
      expenses: expenseInput.value,
      reportedFinal: reportedFinalInput.value,
      currency: sanitizeCurrency(currencySelect.value),
      sessionStatus: sessionStatusSelect.value === 'closed' ? 'closed' : 'open',
    },
    players: getPlayersData(),
  };
}

function mergeCurrentSessionDraft() {
  if (!currentSession) return;
  const draft = collectCurrentSessionData();
  currentSession = {
    ...currentSession,
    ...draft,
    settings: {
      ...currentSession.settings,
      ...draft.settings,
    },
    players: draft.players,
  };
  const index = sessions.findIndex((session) => session.id === currentSession.id);
  if (index !== -1) {
    sessions[index] = currentSession;
  } else {
    sessions.push(currentSession);
  }
}

async function saveSessionNow() {
  if (!currentSession) return;
  mergeCurrentSessionDraft();
  refreshScoreboardFilters();
  updateScoreboard();

  try {
    const response = await fetch(`${API_BASE}/sessions/${currentSession.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(currentSession),
    });

    if (!response.ok) {
      throw new Error(`Failed to save session: ${response.status}`);
    }

    const updated = await response.json();
    currentSession = updated;
    const index = sessions.findIndex((session) => session.id === updated.id);
    if (index !== -1) {
      sessions[index] = updated;
    } else {
      sessions.push(updated);
    }
    refreshScoreboardFilters();
    updateScoreboard();
  } catch (error) {
    console.error(error);
  }
}

function scheduleSave(immediate = false) {
  if (isRestoring || !currentSession) {
    return;
  }
  if (saveTimeoutId) {
    clearTimeout(saveTimeoutId);
  }
  if (immediate) {
    saveSessionNow();
    return;
  }
  saveTimeoutId = setTimeout(() => {
    saveTimeoutId = null;
    saveSessionNow();
  }, SAVE_DEBOUNCE_MS);
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

  if (net > 0.0001) {
    netCell.classList.add('positive');
    outcomeCell.textContent = 'Win';
    outcomeCell.classList.add('positive');
  } else if (net < -0.0001) {
    netCell.classList.add('negative');
    outcomeCell.textContent = 'Loss';
    outcomeCell.classList.add('negative');
  } else if (nameInput.value.trim()) {
    outcomeCell.textContent = 'Break even';
  } else {
    outcomeCell.textContent = '–';
  }

  updateSummary();
  if (!isRestoring) {
    scheduleSave();
  }
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
    updateSummary();
    scheduleSave(true);
  });

  if (isPlayerView) {
    removeBtn.classList.add('hidden');
  }

  handlePlayerInputChange(row);

  return row;
}

function addPlayerRow(player = {}) {
  const row = createPlayerRow(player);
  playersBody.appendChild(row);
  return row;
}

function refreshAllRows() {
  playersBody.querySelectorAll('tr').forEach((row) => {
    handlePlayerInputChange(row);
  });
}

function updateSessionStatusUI() {
  const isClosed = sessionStatusSelect.value === 'closed';
  if (sessionStatusIndicator) {
    sessionStatusIndicator.textContent = isClosed ? 'Session closed' : 'Session open';
    sessionStatusIndicator.classList.toggle('closed', isClosed);
  }

  playersBody.querySelectorAll('input').forEach((input) => {
    input.disabled = isClosed;
  });
  playersBody.querySelectorAll('.remove-player').forEach((button) => {
    button.disabled = isClosed;
    button.classList.toggle('disabled', isClosed);
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
  refreshAllRows();
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
    if (startSessionBtn) {
      startSessionBtn.disabled = true;
      startSessionBtn.classList.add('disabled');
    }
  }
}

function resetCurrentSession() {
  if (!currentSession || isPlayerView) return;
  const confirmation = confirm('Clear host info and remove all players from this session?');
  if (!confirmation) {
    return;
  }

  isRestoring = true;
  hostNameInput.value = '';
  locationInput.value = '';
  datetimeInput.value = '';
  expenseInput.value = '';
  reportedFinalInput.value = '';
  currencySelect.value = 'USD';
  sessionStatusSelect.value = 'open';
  playersBody.innerHTML = '';
  addPlayerRow();
  isRestoring = false;

  updateCurrencySymbols();
  updateEventDetails();
  updateSummary();
  updateSessionStatusUI();
  scheduleSave(true);
}

async function createSessionOnServer() {
  const response = await fetch(`${API_BASE}/sessions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  });

  if (!response.ok) {
    throw new Error(`Failed to create session: ${response.status}`);
  }

  return response.json();
}

async function startNewSession() {
  if (!startSessionBtn || isPlayerView) return;
  if (currentSession && currentSession.settings?.sessionStatus !== 'closed') {
    alert('Close the current session before starting a new one.');
    return;
  }

  try {
    const session = await createSessionOnServer();
    sessions.push(session);
    currentSession = session;
    populateSession(session);
    refreshScoreboardFilters();
    updateScoreboard();
  } catch (error) {
    console.error(error);
  }
}

function getSessionDate(session) {
  const value = session?.settings?.datetime || session?.createdAt;
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return null;
  return date;
}

function formatSessionLabel(session) {
  const date = getSessionDate(session);
  const host = session?.settings?.hostName?.trim();
  const dateLabel = date
    ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
    : 'No date';
  return host ? `${dateLabel} · ${host}` : dateLabel;
}

function getSessionYear(session) {
  const date = getSessionDate(session);
  if (!date) return 'Unknown';
  return String(date.getFullYear());
}

function refreshScoreboardFilters() {
  if (!scoreboardScopeSelect) return;

  const previousSession = scoreboardSessionSelect?.value;
  const previousYear = scoreboardYearSelect?.value;

  if (scoreboardSessionSelect) {
    scoreboardSessionSelect.innerHTML = '';
    const sortedSessions = [...sessions].sort((a, b) => {
      const dateA = getSessionDate(a)?.getTime() ?? 0;
      const dateB = getSessionDate(b)?.getTime() ?? 0;
      return dateB - dateA;
    });

    sortedSessions.forEach((session) => {
      const option = document.createElement('option');
      option.value = session.id;
      option.textContent = formatSessionLabel(session);
      scoreboardSessionSelect.appendChild(option);
    });

    if (previousSession && Array.from(scoreboardSessionSelect.options).some((opt) => opt.value === previousSession)) {
      scoreboardSessionSelect.value = previousSession;
    } else if (scoreboardSessionSelect.options.length > 0) {
      scoreboardSessionSelect.value = scoreboardSessionSelect.options[0].value;
    }
    scoreboardSessionSelect.disabled = scoreboardSessionSelect.options.length === 0;
  }

  if (scoreboardYearSelect) {
    scoreboardYearSelect.innerHTML = '';
    const years = new Set();
    sessions.forEach((session) => {
      years.add(getSessionYear(session));
    });
    const sortedYears = Array.from(years).sort((a, b) => {
      if (a === 'Unknown') return 1;
      if (b === 'Unknown') return -1;
      return Number(b) - Number(a);
    });
    sortedYears.forEach((year) => {
      const option = document.createElement('option');
      option.value = year;
      option.textContent = year;
      scoreboardYearSelect.appendChild(option);
    });

    if (previousYear && Array.from(scoreboardYearSelect.options).some((opt) => opt.value === previousYear)) {
      scoreboardYearSelect.value = previousYear;
    } else if (scoreboardYearSelect.options.length > 0) {
      scoreboardYearSelect.value = scoreboardYearSelect.options[0].value;
    }
    scoreboardYearSelect.disabled = scoreboardYearSelect.options.length === 0;
  }

  handleScoreboardScopeChange();
}

function handleScoreboardScopeChange() {
  if (!scoreboardScopeSelect) return;
  const scope = scoreboardScopeSelect.value;
  if (scoreboardSessionWrapper) {
    scoreboardSessionWrapper.hidden = scope !== 'session';
  }
  if (scoreboardYearWrapper) {
    scoreboardYearWrapper.hidden = scope !== 'year';
  }
  updateScoreboard();
}

function determineCurrencyForSessions(selectedSessions) {
  const currencies = new Set();
  selectedSessions.forEach((session) => {
    const code = sanitizeCurrency(session?.settings?.currency);
    currencies.add(code);
  });
  if (currencies.size === 1) {
    return currencies.values().next().value;
  }
  return null;
}

function computePlayerStats(selectedSessions) {
  const stats = new Map();

  selectedSessions.forEach((session) => {
    const sessionId = session.id;
    (session.players ?? []).forEach((player) => {
      const name = player.name?.trim() || 'Unnamed player';
      const buyins = Number(player.buyins) || 0;
      const final = Number(player.final) || 0;
      const net = final - buyins;
      const entry = stats.get(name) || {
        name,
        totalBuyins: 0,
        totalFinal: 0,
        totalNet: 0,
        wins: 0,
        losses: 0,
        sessions: new Set(),
      };

      entry.totalBuyins += buyins;
      entry.totalFinal += final;
      entry.totalNet += net;
      entry.sessions.add(sessionId);
      if (net > 0.0001) {
        entry.wins += 1;
      } else if (net < -0.0001) {
        entry.losses += 1;
      }
      stats.set(name, entry);
    });
  });

  return Array.from(stats.values()).map((entry) => ({
    ...entry,
    sessionsPlayed: entry.sessions.size,
  }));
}

function updateScoreboard() {
  if (!scoreboardTableBody || !scoreboardScopeSelect) return;

  const scope = scoreboardScopeSelect.value;
  let selectedSessions = [];
  let contextLabel = '';

  if (scope === 'session') {
    const sessionId = scoreboardSessionSelect?.value;
    if (sessionId) {
      const session = sessions.find((item) => item.id === sessionId);
      if (session) {
        selectedSessions = [session];
        contextLabel = formatSessionLabel(session);
      }
    }
  } else if (scope === 'year') {
    const year = scoreboardYearSelect?.value;
    if (year) {
      selectedSessions = sessions.filter((session) => getSessionYear(session) === year);
      contextLabel = year === 'Unknown' ? 'Sessions without a set date' : `Year ${year}`;
    }
  } else {
    selectedSessions = [...sessions];
    contextLabel = 'All sessions';
  }

  if (selectedSessions.length === 0) {
    scoreboardTableBody.innerHTML = '<tr><td colspan="5" class="empty">No results yet</td></tr>';
    scoreboardProfitName.textContent = '—';
    scoreboardProfitValue.textContent = '—';
    scoreboardWinsName.textContent = '—';
    scoreboardWinsValue.textContent = '—';
    scoreboardNote.textContent = sessions.length === 0 ? 'No sessions recorded yet.' : 'No sessions available for the selected view.';
    return;
  }

  const playerStats = computePlayerStats(selectedSessions);
  if (playerStats.length === 0) {
    scoreboardTableBody.innerHTML = '<tr><td colspan="5" class="empty">No player results yet</td></tr>';
    scoreboardProfitName.textContent = '—';
    scoreboardProfitValue.textContent = '—';
    scoreboardWinsName.textContent = '—';
    scoreboardWinsValue.textContent = '—';
    scoreboardNote.textContent = `${contextLabel || 'Selected view'} has no player data yet.`;
    return;
  }

  playerStats.sort((a, b) => {
    if (b.totalNet !== a.totalNet) {
      return b.totalNet - a.totalNet;
    }
    return a.name.localeCompare(b.name);
  });

  const currencyForScope = determineCurrencyForSessions(selectedSessions);

  const profitLeader = playerStats[0];
  scoreboardProfitName.textContent = profitLeader.name;
  scoreboardProfitValue.textContent = currencyForScope
    ? formatCurrency(profitLeader.totalNet, currencyForScope)
    : `${profitLeader.totalNet.toFixed(2)} (mixed)`;

  const winLeader = playerStats.reduce((best, candidate) => {
    if (!best) return candidate;
    if (candidate.wins > best.wins) return candidate;
    if (candidate.wins === best.wins) {
      if (candidate.totalNet > best.totalNet) return candidate;
      if (candidate.totalNet === best.totalNet) {
        return candidate.name.localeCompare(best.name) < 0 ? candidate : best;
      }
    }
    return best;
  }, null);

  if (winLeader) {
    scoreboardWinsName.textContent = winLeader.name;
    scoreboardWinsValue.textContent = `${winLeader.wins} win${winLeader.wins === 1 ? '' : 's'}`;
  } else {
    scoreboardWinsName.textContent = '—';
    scoreboardWinsValue.textContent = '—';
  }

  scoreboardTableBody.innerHTML = '';
  playerStats.forEach((entry) => {
    const row = document.createElement('tr');
    const values = [
      entry.name,
      String(entry.sessionsPlayed),
      String(entry.wins),
      String(entry.losses),
      currencyForScope ? formatCurrency(entry.totalNet, currencyForScope) : `${entry.totalNet.toFixed(2)} (mixed)`,
    ];

    values.forEach((value) => {
      const cell = document.createElement('td');
      cell.textContent = value;
      row.appendChild(cell);
    });

    scoreboardTableBody.appendChild(row);
  });

  const totalSessions = selectedSessions.length;
  const sessionWord = totalSessions === 1 ? 'session' : 'sessions';
  const currencyNote = currencyForScope
    ? `Values shown in ${currencyForScope}.`
    : 'Results span multiple currencies.';
  scoreboardNote.textContent = `${contextLabel || 'Selected view'} · ${totalSessions} ${sessionWord}. ${currencyNote}`;
}

function populateSession(session) {
  if (!session) return;
  isRestoring = true;

  const settings = session.settings ?? {};
  hostNameInput.value = settings.hostName ?? '';
  locationInput.value = settings.location ?? '';
  datetimeInput.value = settings.datetime ?? '';
  expenseInput.value = settings.expenses ?? '';
  reportedFinalInput.value = settings.reportedFinal ?? '';
  currencySelect.value = sanitizeCurrency(settings.currency);
  sessionStatusSelect.value = settings.sessionStatus === 'closed' ? 'closed' : 'open';

  playersBody.innerHTML = '';
  if (Array.isArray(session.players) && session.players.length > 0) {
    session.players.forEach((player) => addPlayerRow(player));
  } else {
    addPlayerRow();
  }

  updateCurrencySymbols();
  updateEventDetails();
  updateSummary();
  updateSessionStatusUI();
  updatePlayerLink();

  isRestoring = false;
}

async function loadSessions() {
  try {
    const response = await fetch(`${API_BASE}/sessions`);
    if (!response.ok) {
      throw new Error(`Failed to load sessions: ${response.status}`);
    }
    const data = await response.json();
    sessions = Array.isArray(data.sessions) ? data.sessions : [];

    currentSession = sessions.find((session) => session.settings?.sessionStatus === 'open');
    if (!currentSession) {
      sessions.sort((a, b) => {
        const dateA = getSessionDate(a)?.getTime() ?? 0;
        const dateB = getSessionDate(b)?.getTime() ?? 0;
        return dateB - dateA;
      });
      currentSession = sessions[0] ?? null;
    }

    if (!currentSession) {
      currentSession = await createSessionOnServer();
      sessions.push(currentSession);
    }

    populateSession(currentSession);
    refreshScoreboardFilters();
    updateScoreboard();
  } catch (error) {
    console.error(error);
  }
}

function attachInputListeners(element, handler) {
  if (!element) return;
  element.addEventListener('input', handler);
  element.addEventListener('change', handler);
}

function initEventListeners() {
  attachInputListeners(hostNameInput, () => {
    updateEventDetails();
    scheduleSave();
  });
  attachInputListeners(locationInput, () => {
    updateEventDetails();
    scheduleSave();
  });
  attachInputListeners(datetimeInput, () => {
    updateEventDetails();
    scheduleSave();
    refreshScoreboardFilters();
  });
  attachInputListeners(expenseInput, () => {
    updateEventDetails();
    updateSummary();
    scheduleSave();
  });
  attachInputListeners(reportedFinalInput, () => {
    updateEventDetails();
    scheduleSave();
  });
  attachInputListeners(currencySelect, () => {
    updateCurrencySymbols();
    scheduleSave();
  });
  attachInputListeners(sessionStatusSelect, () => {
    updateSessionStatusUI();
    scheduleSave(true);
  });

  addPlayerBtn?.addEventListener('click', () => {
    const row = addPlayerRow();
    if (sessionStatusSelect.value === 'closed') {
      updateSessionStatusUI();
      return;
    }
    row.querySelector('.player-name')?.focus();
    scheduleSave();
  });

  resetBtn?.addEventListener('click', resetCurrentSession);
  startSessionBtn?.addEventListener('click', startNewSession);

  scoreboardScopeSelect?.addEventListener('change', handleScoreboardScopeChange);
  scoreboardSessionSelect?.addEventListener('change', updateScoreboard);
  scoreboardYearSelect?.addEventListener('change', updateScoreboard);
}

async function init() {
  updateViewForRole();
  setupSettingsPanel();
  await loadSessions();
  initEventListeners();
}

window.addEventListener('DOMContentLoaded', init);
