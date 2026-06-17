javascript

/* ============================================================
   NEXUS CUP — script.js
   Sistema de inscrição para torneios de eSports
   Armazenamento: LocalStorage | Exportação: XLSX + PDF
   ============================================================ */

'use strict';

/* ------------------------------------------------------------
   CONSTANTES E ESTADO GLOBAL
   ------------------------------------------------------------ */
const STORAGE_KEY = 'nexuscup_registrations';
const THEME_KEY = 'nexuscup_theme';
const MAX_PLAYERS = 10;
const MIN_PLAYERS = 1;

let playerCount = 0;          // contador de jogadores no formulário atual
let editingId = null;         // id da inscrição em edição
let pendingDeleteId = null;   // id pendente de exclusão (modal de confirmação)

/* ------------------------------------------------------------
   INICIALIZAÇÃO
   ------------------------------------------------------------ */
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  addPlayer(); // adiciona o primeiro jogador automaticamente
  attachFormHandler();
  attachLiveValidation();
  refreshDashboard();
  renderTeamsTable();
  document.getElementById('footer-date').textContent = new Date().getFullYear();
});

/* ------------------------------------------------------------
   NAVEGAÇÃO ENTRE VIEWS (Home / Admin)
   ------------------------------------------------------------ */
function showView(view) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

  document.getElementById(`view-${view}`).classList.add('active');
  document.querySelector(`.nav-btn[data-view="${view}"]`).classList.add('active');

  if (view === 'admin') {
    refreshDashboard();
    renderTeamsTable();
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ------------------------------------------------------------
   TEMA (Dark / Light)
   ------------------------------------------------------------ */
function initTheme() {
  const saved = localStorage.getItem(THEME_KEY) || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
  updateThemeIcon(saved);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem(THEME_KEY, next);
  updateThemeIcon(next);
}

function updateThemeIcon(theme) {
  document.querySelector('.theme-icon').textContent = theme === 'dark' ? '🌙' : '☀️';
}

/* ------------------------------------------------------------
   GERENCIAMENTO DE JOGADORES (formulário dinâmico)
   ------------------------------------------------------------ */

/**
 * Adiciona um novo bloco de campos para jogador (até o limite MAX_PLAYERS)
 */
function addPlayer() {
  if (playerCount >= MAX_PLAYERS) return;

  playerCount++;
  const list = document.getElementById('players-list');

  const card = document.createElement('div');
  card.className = 'player-card';
  card.dataset.playerIndex = playerCount;
  card.innerHTML = `
    <div class="player-card-header">
      <span>Jogador ${playerCount}</span>
      <button type="button" class="remove-player-btn" onclick="removePlayer(this)" title="Remover jogador" aria-label="Remover jogador">✕</button>
    </div>
    <div class="player-grid">
      <div class="field-group">
        <label>Nome Completo <span class="req">*</span></label>
        <input type="text" name="playerName" placeholder="Nome do jogador" required />
      </div>
      <div class="field-group">
        <label>Nickname <span class="req">*</span></label>
        <input type="text" name="playerNick" placeholder="Ex: Sh4d0w" required />
      </div>
      <div class="field-group">
        <label>ID do Jogo <span class="req">*</span></label>
        <input type="text" name="playerId" placeholder="Ex: #BR123456" required />
      </div>
    </div>
  `;
  list.appendChild(card);

  updatePlayerCountLabel();
  updateAddButtonState();
}

/**
 * Remove um bloco de jogador, desde que o mínimo seja respeitado
 */
function removePlayer(btn) {
  const list = document.getElementById('players-list');
  if (list.children.length <= MIN_PLAYERS) {
    showToast('É necessário pelo menos 1 jogador na equipe.', 'error');
    return;
  }
  const card = btn.closest('.player-card');
  card.style.opacity = '0';
  card.style.transform = 'translateX(8px)';
  setTimeout(() => {
    card.remove();
    playerCount--;
    renumberPlayers();
    updatePlayerCountLabel();
    updateAddButtonState();
  }, 150);
}

/** Renomeia os cabeçalhos "Jogador N" após remoção */
function renumberPlayers() {
  const cards = document.querySelectorAll('#players-list .player-card');
  cards.forEach((card, i) => {
    card.querySelector('.player-card-header span').textContent = `Jogador ${i + 1}`;
  });
}

function updatePlayerCountLabel() {
  const count = document.querySelectorAll('#players-list .player-card').length;
  const label = document.getElementById('player-count-label');
  label.textContent = `(${count} ${count === 1 ? 'jogador' : 'jogadores'})`;
}

function updateAddButtonState() {
  const count = document.querySelectorAll('#players-list .player-card').length;
  const btn = document.getElementById('add-player-btn');
  btn.disabled = count >= MAX_PLAYERS;
  btn.querySelector('svg')?.nextSibling; // no-op placeholder for clarity
  if (count >= MAX_PLAYERS) {
    btn.lastChild.textContent = ' Limite de 10 jogadores atingido';
  } else {
    btn.lastChild.textContent = ' Adicionar Jogador';
  }
}

/* ------------------------------------------------------------
   VALIDAÇÃO DO FORMULÁRIO
   ------------------------------------------------------------ */

/** Liga validação em tempo real (ao sair do campo) para feedback imediato */
function attachLiveValidation() {
  const form = document.getElementById('registration-form');
  form.addEventListener('blur', (e) => {
    if (e.target.matches('input, select')) {
      validateField(e.target);
    }
  }, true);
}

/**
 * Valida um campo individual e exibe/limpa mensagem de erro.
 * Retorna true se válido.
 */
function validateField(field) {
  let isValid = true;
  let message = '';

  if (field.hasAttribute('required') && !field.value.trim()) {
    isValid = false;
    message = 'Este campo é obrigatório.';
  } else if (field.type === 'email' && field.value.trim()) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(field.value.trim())) {
      isValid = false;
      message = 'Informe um e-mail válido.';
    }
  } else if (field.type === 'tel' && field.value.trim()) {
    const digits = field.value.replace(/\D/g, '');
    if (digits.length < 10) {
      isValid = false;
      message = 'Informe um WhatsApp válido com DDD.';
    }
  } else if (field.id === 'team-tag' && field.value.trim()) {
    if (field.value.trim().length > 5) {
      isValid = false;
      message = 'A tag deve ter até 5 caracteres.';
    }
  }

  field.classList.toggle('error', !isValid);
  const errorEl = document.getElementById(`err-${field.id}`);
  if (errorEl) errorEl.textContent = isValid ? '' : message;

  return isValid;
}

/** Valida o formulário inteiro antes do envio */
function validateForm(form) {
  let valid = true;

  // Campos padrão com id
  const idFields = [
    'team-name', 'team-tag', 'game', 'city', 'state', 'country',
    'cap-name', 'cap-nick', 'cap-email', 'cap-whatsapp'
  ];
  idFields.forEach(id => {
    const field = document.getElementById(id);
    if (!validateField(field)) valid = false;
  });

  // Jogadores (sem id fixo, validados manualmente)
  const playerCards = document.querySelectorAll('#players-list .player-card');
  playerCards.forEach(card => {
    card.querySelectorAll('input').forEach(input => {
      if (!input.value.trim()) {
        input.classList.add('error');
        valid = false;
      } else {
        input.classList.remove('error');
      }
    });
  });

  // Termos
  const termRules = document.getElementById('term-rules');
  const errTerms = document.getElementById('err-terms');
  if (!termRules.checked) {
    errTerms.textContent = 'Você deve aceitar o regulamento para se inscrever.';
    valid = false;
  } else {
    errTerms.textContent = '';
  }

  return valid;
}

/* ------------------------------------------------------------
   ENVIO DO FORMULÁRIO
   ------------------------------------------------------------ */
function attachFormHandler() {
  const form = document.getElementById('registration-form');
  form.addEventListener('submit', handleFormSubmit);
}

function handleFormSubmit(e) {
  e.preventDefault();
  const form = e.target;

  if (!validateForm(form)) {
    showToast('Corrija os campos destacados antes de continuar.', 'error');
    // rola até o primeiro erro
    const firstError = form.querySelector('.error');
    if (firstError) firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  const teamName = document.getElementById('team-name').value.trim();

  // Evita duplicidade de equipes (mesmo nome, case-insensitive)
  const registrations = getRegistrations();
  const isDuplicate = registrations.some(r =>
    r.equipe.toLowerCase() === teamName.toLowerCase() &&
    r.jogo === document.getElementById('game').value
  );
  if (isDuplicate) {
    showToast(`Já existe uma equipe "${teamName}" inscrita neste jogo.`, 'error');
    return;
  }

  // Monta objeto de jogadores
  const players = [];
  document.querySelectorAll('#players-list .player-card').forEach(card => {
    const inputs = card.querySelectorAll('input');
    players.push({
      nome: inputs[0].value.trim(),
      nick: inputs[1].value.trim(),
      id: inputs[2].value.trim()
    });
  });

  // Monta registro completo seguindo a estrutura JSON solicitada
  const newRegistration = {
    id: generateUniqueId(),
    data: new Date().toISOString().split('T')[0],
    horario: new Date().toLocaleTimeString('pt-BR'),
    equipe: teamName,
    tag: document.getElementById('team-tag').value.trim().toUpperCase(),
    jogo: document.getElementById('game').value,
    cidade: document.getElementById('city').value.trim(),
    estado: document.getElementById('state').value.trim().toUpperCase(),
    pais: document.getElementById('country').value.trim(),
    capitao: {
      nome: document.getElementById('cap-name').value.trim(),
      nick: document.getElementById('cap-nick').value.trim(),
      email: document.getElementById('cap-email').value.trim(),
      whatsapp: document.getElementById('cap-whatsapp').value.trim()
    },
    jogadores: players,
    aceiteRegulamento: document.getElementById('term-rules').checked,
    autorizacaoImagem: document.getElementById('term-image').checked
  };

  registrations.push(newRegistration);
  saveRegistrations(registrations);

  showToast(`Equipe "${teamName}" inscrita com sucesso! 🏆`, 'success');
  resetForm();
  refreshDashboard();
}

/** Reseta o formulário ao estado inicial (1 jogador) */
function resetForm() {
  const form = document.getElementById('registration-form');
  form.reset();
  document.getElementById('country').value = 'Brasil';
  document.getElementById('players-list').innerHTML = '';
  playerCount = 0;
  addPlayer();
  form.querySelectorAll('.error').forEach(el => el.classList.remove('error'));
  form.querySelectorAll('.field-error').forEach(el => el.textContent = '');
}

/* ------------------------------------------------------------
   GERAÇÃO DE ID ÚNICO
   ------------------------------------------------------------ */
function generateUniqueId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/* ------------------------------------------------------------
   PERSISTÊNCIA (LocalStorage)
   ------------------------------------------------------------ */
function getRegistrations() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error('Erro ao ler inscrições do LocalStorage:', err);
    return [];
  }
}

function saveRegistrations(registrations) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(registrations));
  } catch (err) {
    console.error('Erro ao salvar inscrições:', err);
    showToast('Erro ao salvar dados. Armazenamento pode estar cheio.', 'error');
  }
}

/* ------------------------------------------------------------
   DASHBOARD (estatísticas)
   ------------------------------------------------------------ */
function refreshDashboard() {
  const data = getRegistrations();
  const totalTeams = data.length;
  const totalPlayers = data.reduce((sum, r) => sum + (r.jogadores?.length || 0), 0);
  const popularGame = getMostPopularGame(data);

  // Hero (home)
  setText('stat-teams', totalTeams);
  setText('stat-players', totalPlayers);
  setText('stat-game', popularGame);

  // Admin dashboard
  setText('dash-teams', totalTeams);
  setText('dash-players', totalPlayers);
  setText('dash-popular', popularGame);
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function getMostPopularGame(data) {
  if (!data.length) return '—';
  const counts = {};
  data.forEach(r => { counts[r.jogo] = (counts[r.jogo] || 0) + 1; });
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

/* ------------------------------------------------------------
   PAINEL ADMINISTRATIVO — Tabela de equipes
   ------------------------------------------------------------ */
function renderTeamsTable() {
  const tbody = document.getElementById('teams-tbody');
  const emptyState = document.getElementById('empty-state');
  const data = applyFilters(getRegistrations());

  tbody.innerHTML = '';

  if (data.length === 0) {
    emptyState.classList.add('visible');
    document.getElementById('teams-table').style.display = 'none';
    return;
  }

  emptyState.classList.remove('visible');
  document.getElementById('teams-table').style.display = 'table';

  data.forEach((reg, index) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${index + 1}</td>
      <td class="team-name-cell">${escapeHtml(reg.equipe)}</td>
      <td><span class="tag-badge">${escapeHtml(reg.tag)}</span></td>
      <td><span class="game-badge">${escapeHtml(reg.jogo)}</span></td>
      <td>${escapeHtml(reg.capitao.nome)}</td>
      <td>
        <div style="display:flex;flex-direction:column;gap:2px;">
          <span style="font-size:.8rem;">${escapeHtml(reg.capitao.email)}</span>
          <span style="font-size:.75rem;color:var(--text-muted);">${escapeHtml(reg.capitao.whatsapp)}</span>
        </div>
      </td>
      <td><span class="player-count-badge">${reg.jogadores.length}/10</span></td>
      <td><span class="date-cell">${formatDate(reg.data)}</span></td>
      <td>
        <div class="action-btns">
          <button class="action-btn edit" onclick="openEditModal('${reg.id}')" title="Editar" aria-label="Editar inscrição">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.85 2.83 0 114 4L7.5 20.5 2 22l1.5-5.5z"/></svg>
          </button>
          <button class="action-btn del" onclick="requestDelete('${reg.id}', '${escapeHtml(reg.equipe)}')" title="Excluir" aria-label="Excluir inscrição">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function formatDate(isoDate) {
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

/* ------------------------------------------------------------
   BUSCA E FILTRO
   ------------------------------------------------------------ */
function applyFilters(data) {
  const search = document.getElementById('search-input').value.trim().toLowerCase();
  const game = document.getElementById('filter-game').value;

  return data.filter(reg => {
    const matchesSearch = !search || reg.equipe.toLowerCase().includes(search);
    const matchesGame = !game || reg.jogo === game;
    return matchesSearch && matchesGame;
  });
}

function filterTeams() {
  renderTeamsTable();
}

/* ------------------------------------------------------------
   EXCLUSÃO DE INSCRIÇÕES (com confirmação)
   ------------------------------------------------------------ */
function requestDelete(id, teamName) {
  pendingDeleteId = id;
  document.getElementById('confirm-title').textContent = 'Confirmar exclusão';
  document.getElementById('confirm-message').textContent =
    `Tem certeza que deseja excluir a inscrição da equipe "${teamName}"? Essa ação não pode ser desfeita.`;

  const okBtn = document.getElementById('confirm-ok-btn');
  okBtn.textContent = 'Excluir';
  okBtn.onclick = confirmDeleteSingle;

  openConfirmModal();
}

function confirmDeleteSingle() {
  if (!pendingDeleteId) return;
  const registrations = getRegistrations().filter(r => r.id !== pendingDeleteId);
  saveRegistrations(registrations);
  pendingDeleteId = null;
  closeConfirm();
  renderTeamsTable();
  refreshDashboard();
  showToast('Inscrição excluída com sucesso.', 'success');
}

function clearAllRegistrations() {
  const data = getRegistrations();
  if (data.length === 0) {
    showToast('Não há inscrições para limpar.', 'info');
    return;
  }

  document.getElementById('confirm-title').textContent = 'Limpar todas as inscrições';
  document.getElementById('confirm-message').textContent =
    `Tem certeza que deseja excluir TODAS as ${data.length} inscrições? Essa ação é irreversível.`;

  const okBtn = document.getElementById('confirm-ok-btn');
  okBtn.textContent = 'Limpar Tudo';
  okBtn.onclick = confirmClearAll;

  openConfirmModal();
}

function confirmClearAll() {
  localStorage.removeItem(STORAGE_KEY);
  closeConfirm();
  renderTeamsTable();
  refreshDashboard();
  showToast('Todas as inscrições foram removidas.', 'success');
}

/* ------------------------------------------------------------
   EDIÇÃO DE INSCRIÇÕES
   ------------------------------------------------------------ */
function openEditModal(id) {
  const reg = getRegistrations().find(r => r.id === id);
  if (!reg) return;

  editingId = id;
  document.getElementById('edit-id').value = id;
  document.getElementById('edit-team-name').value = reg.equipe;
  document.getElementById('edit-team-tag').value = reg.tag;
  document.getElementById('edit-game').value = reg.jogo;
  document.getElementById('edit-city').value = reg.cidade;
  document.getElementById('edit-state').value = reg.estado;
  document.getElementById('edit-cap-name').value = reg.capitao.nome;
  document.getElementById('edit-cap-nick').value = reg.capitao.nick;
  document.getElementById('edit-cap-email').value = reg.capitao.email;
  document.getElementById('edit-cap-whatsapp').value = reg.capitao.whatsapp;

  document.getElementById('edit-modal').classList.add('open');
}

function saveEdit() {
  const id = document.getElementById('edit-id').value;
  const registrations = getRegistrations();
  const index = registrations.findIndex(r => r.id === id);
  if (index === -1) return;

  const teamName = document.getElementById('edit-team-name').value.trim();
  const teamTag = document.getElementById('edit-team-tag').value.trim();

  if (!teamName || !teamTag) {
    showToast('Nome e tag da equipe são obrigatórios.', 'error');
    return;
  }

  registrations[index] = {
    ...registrations[index],
    equipe: teamName,
    tag: teamTag.toUpperCase(),
    jogo: document.getElementById('edit-game').value,
    cidade: document.getElementById('edit-city').value.trim(),
    estado: document.getElementById('edit-state').value.trim().toUpperCase(),
    capitao: {
      ...registrations[index].capitao,
      nome: document.getElementById('edit-cap-name').value.trim(),
      nick: document.getElementById('edit-cap-nick').value.trim(),
      email: document.getElementById('edit-cap-email').value.trim(),
      whatsapp: document.getElementById('edit-cap-whatsapp').value.trim()
    }
  };

  saveRegistrations(registrations);
  closeModal();
  renderTeamsTable();
  refreshDashboard();
  showToast('Inscrição atualizada com sucesso.', 'success');
}

function closeModal() {
  document.getElementById('edit-modal').classList.remove('open');
  editingId = null;
}

/* ------------------------------------------------------------
   MODAL DE CONFIRMAÇÃO (genérico)
   ------------------------------------------------------------ */
function openConfirmModal() {
  document.getElementById('confirm-modal').classList.add('open');
}

function closeConfirm() {
  document.getElementById('confirm-modal').classList.remove('open');
  pendingDeleteId = null;
}

// Fecha modais ao clicar fora da caixa
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('open');
  }
});

// Fecha modais com ESC
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeModal();
    closeConfirm();
  }
});

/* ------------------------------------------------------------
   TOAST (mensagens de sucesso/erro/info)
   ------------------------------------------------------------ */
let toastTimeout;
function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  clearTimeout(toastTimeout);

  toast.textContent = message;
  toast.className = `toast show ${type}`;

  toastTimeout = setTimeout(() => {
    toast.classList.remove('show');
  }, 3500);
}

/* ------------------------------------------------------------
   EXPORTAÇÃO — EXCEL (.xlsx via SheetJS)
   ------------------------------------------------------------ */
function exportCSV() {
  const data = getRegistrations();
  if (data.length === 0) {
    showToast('Não há inscrições para exportar.', 'error');
    return;
  }

  // Monta uma linha por jogador para detalhar o elenco completo,
  // repetindo os dados da equipe/capitão em cada linha.
  const rows = [];
  data.forEach(reg => {
    if (reg.jogadores.length === 0) {
      rows.push(buildExportRow(reg, null));
    } else {
      reg.jogadores.forEach(player => rows.push(buildExportRow(reg, player)));
    }
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);

  // Largura de colunas aproximada para melhor leitura
  worksheet['!cols'] = [
    { wch: 12 }, { wch: 22 }, { wch: 8 }, { wch: 18 }, { wch: 16 },
    { wch: 8 }, { wch: 20 }, { wch: 16 }, { wch: 26 }, { wch: 16 },
    { wch: 20 }, { wch: 16 }, { wch: 16 }
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Inscrições NEXUS CUP');

  const fileName = `nexuscup_inscricoes_${getTimestampForFile()}.xlsx`;
  XLSX.writeFile(workbook, fileName);

  showToast('Planilha Excel exportada com sucesso!', 'success');
}

function buildExportRow(reg, player) {
  return {
    'ID': reg.id,
    'Equipe': reg.equipe,
    'Tag': reg.tag,
    'Jogo': reg.jogo,
    'Cidade': reg.cidade,
    'Estado': reg.estado,
    'País': reg.pais,
    'Capitão': reg.capitao.nome,
    'E-mail Capitão': reg.capitao.email,
    'WhatsApp Capitão': reg.capitao.whatsapp,
    'Jogador': player ? player.nome : '—',
    'Nickname Jogador': player ? player.nick : '—',
    'ID do Jogo (Jogador)': player ? player.id : '—',
    'Data de Inscrição': formatDate(reg.data)
  };
}

/* ------------------------------------------------------------
   EXPORTAÇÃO — PDF (via jsPDF + autoTable)
   ------------------------------------------------------------ */
function exportPDF() {
  const data = getRegistrations();
  if (data.length === 0) {
    showToast('Não há inscrições para exportar.', 'error');
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  const now = new Date();
  const exportDateTime = now.toLocaleDateString('pt-BR') + ' às ' + now.toLocaleTimeString('pt-BR');

  // ---- Cabeçalho ----
  doc.setFillColor(10, 11, 15);
  doc.rect(0, 0, 297, 28, 'F');

  doc.setTextColor(0, 229, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('NEXUS CUP 2026', 14, 14);

  doc.setTextColor(180, 185, 200);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('Relatório Oficial de Equipes Inscritas', 14, 21);

  doc.setFontSize(9);
  doc.text(`Exportado em: ${exportDateTime}`, 297 - 14, 14, { align: 'right' });
  doc.text(`Total de equipes: ${data.length}`, 297 - 14, 21, { align: 'right' });

  // ---- Tabela principal ----
  const tableRows = data.map((reg, i) => [
    i + 1,
    reg.equipe,
    reg.tag,
    reg.jogo,
    `${reg.cidade}/${reg.estado}`,
    reg.capitao.nome,
    reg.capitao.email,
    reg.capitao.whatsapp,
    reg.jogadores.length,
    formatDate(reg.data)
  ]);

  doc.autoTable({
    startY: 34,
    head: [['#', 'Equipe', 'Tag', 'Jogo', 'Local', 'Capitão', 'E-mail', 'WhatsApp', 'Jog.', 'Data']],
    body: tableRows,
    theme: 'grid',
    headStyles: {
      fillColor: [16, 18, 26],
      textColor: [0, 229, 255],
      fontStyle: 'bold',
      fontSize: 9
    },
    bodyStyles: { fontSize: 8.5, textColor: [30, 30, 30] },
    alternateRowStyles: { fillColor: [240, 244, 250] },
    styles: { cellPadding: 2.2 },
    margin: { left: 14, right: 14 }
  });

  // ---- Detalhamento de jogadores (uma seção por equipe) ----
  let cursorY = doc.lastAutoTable.finalY + 10;

  data.forEach(reg => {
    if (cursorY > 180) {
      doc.addPage();
      cursorY = 20;
    }

    doc.setFontSize(11);
    doc.setTextColor(20, 20, 20);
    doc.setFont('helvetica', 'bold');
    doc.text(`${reg.equipe} [${reg.tag}] — ${reg.jogo}`, 14, cursorY);

    const playerRows = reg.jogadores.map((p, idx) => [idx + 1, p.nome, p.nick, p.id]);

    doc.autoTable({
      startY: cursorY + 3,
      head: [['#', 'Nome', 'Nickname', 'ID do Jogo']],
      body: playerRows.length ? playerRows : [['—', 'Sem jogadores cadastrados', '', '']],
      theme: 'striped',
      headStyles: { fillColor: [156, 39, 255], textColor: [255, 255, 255], fontSize: 8.5 },
      bodyStyles: { fontSize: 8 },
      margin: { left: 14, right: 14 },
      tableWidth: 140
    });

    cursorY = doc.lastAutoTable.finalY + 10;
  });

  // ---- Rodapé em todas as páginas ----
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `NEXUS CUP 2026 · Documento gerado automaticamente · Página ${i} de ${pageCount}`,
      148.5, 205, { align: 'center' }
    );
  }

  const fileName = `nexuscup_relatorio_${getTimestampForFile()}.pdf`;
  doc.save(fileName);

  showToast('Relatório PDF exportado com sucesso!', 'success');
}

/* ------------------------------------------------------------
   UTILITÁRIOS
   ------------------------------------------------------------ */
function getTimestampForFile() {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
}