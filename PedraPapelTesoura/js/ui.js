import * as firebase from './firebase.js';
import * as game from './game.js';
import * as audio from './audio.js';

const app = document.getElementById('app');
const toastContainer = document.getElementById('toast-container');

const state = {
  online: false,
  roomId: null,
  playerKey: null,
  playerName: '',
  opponentName: '',
  roomData: null,
  selectedChoice: null,
  lastOutcome: null,
  listening: false
};

let previousOpponent = '';

document.body.addEventListener('click', () => audio.resumeAudio(), { once: true });

function render(html) {
  app.innerHTML = html;
}

function createButton(label, id, classes = '') {
  return `<button id="${id}" class="${classes}">${label}</button>`;
}

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  toastContainer.appendChild(toast);
  setTimeout(() => { toast.classList.add('fade-out'); toast.addEventListener('animationend', () => toast.remove()); }, 3000);
}

function showLoading() {
  render(`
    <section class="screen card">
      <div class="row center">
        <div class="spinner"></div>
      </div>
      <div class="row center">
        <h2 class="title">Carregando...</h2>
      </div>
    </section>
  `);
}

function renderHome() {
  state.online = false;
  state.roomId = null;
  state.playerKey = null;
  state.roomData = null;
  state.selectedChoice = null;
  state.lastOutcome = null;
  firebase.stopListening(state.roomId);
  render(`
    <section class="screen card">
      <div>
        <h1 class="title">Pedra, Papel e Tesoura</h1>
        <p class="subtitle">Escolha um modo e comece a desafiar um amigo ou a IA com visual cyberpunk.</p>
      </div>
      <div class="row">
        ${createButton('Modo Online', 'btn-online')}
        ${createButton('Modo Solo', 'btn-solo')}
      </div>
    </section>
  `);
  document.getElementById('btn-online').addEventListener('click', () => { audio.clickSound(); renderRoomChoice(); });
  document.getElementById('btn-solo').addEventListener('click', () => { audio.clickSound(); renderSoloSetup(); });
}

function renderRoomChoice() {
  render(`
    <section class="screen card">
      <div>
        <h2 class="title">Modo Online</h2>
        <p class="subtitle">Crie uma sala ou entre em uma existente para jogar contra outro jogador.</p>
      </div>
      <div class="row">
        ${createButton('Criar Sala', 'btn-create-room')}
        ${createButton('Entrar Sala', 'btn-join-room')}
      </div>
      <div class="row">
        ${createButton('Voltar', 'btn-back')}
      </div>
    </section>
  `);
  document.getElementById('btn-create-room').addEventListener('click', () => { audio.clickSound(); renderCreateRoom(); });
  document.getElementById('btn-join-room').addEventListener('click', () => { audio.clickSound(); renderJoinRoom(); });
  document.getElementById('btn-back').addEventListener('click', () => { audio.clickSound(); renderHome(); });
}

function renderCreateRoom() {
  render(`
    <section class="screen card">
      <div>
        <h2 class="title">Criar Sala</h2>
        <p class="subtitle">Digite seu nome para receber o código e esperar o oponente.</p>
      </div>
      <div class="row">
        <input id="player-name" type="text" placeholder="Seu nome" maxlength="14" />
      </div>
      <div class="row">
        ${createButton('Criar Sala', 'btn-create')}
        ${createButton('Voltar', 'btn-back')}
      </div>
    </section>
  `);
  document.getElementById('btn-create').addEventListener('click', async () => {
    audio.clickSound();
    const nameInput = document.getElementById('player-name');
    const name = nameInput.value.trim();
    if (!name) { showToast('Informe um nome válido.', 'error'); return; }
    state.playerName = name;
    state.online = true;
    state.playerKey = 'player1';
    await createRoom();
  });
  document.getElementById('btn-back').addEventListener('click', () => { audio.clickSound(); renderRoomChoice(); });
}

function renderJoinRoom() {
  render(`
    <section class="screen card">
      <div>
        <h2 class="title">Entrar na Sala</h2>
        <p class="subtitle">Use o código de 6 dígitos do seu oponente.</p>
      </div>
      <div class="row">
        <input id="player-name" type="text" placeholder="Seu nome" maxlength="14" />
      </div>
      <div class="row">
        <input id="room-code" type="text" placeholder="Código da sala" maxlength="6" />
      </div>
      <div class="row">
        ${createButton('Entrar', 'btn-join')}
        ${createButton('Voltar', 'btn-back')}
      </div>
    </section>
  `);
  document.getElementById('btn-join').addEventListener('click', async () => {
    audio.clickSound();
    const name = document.getElementById('player-name').value.trim();
    const roomId = document.getElementById('room-code').value.trim();
    if (!name || !roomId.match(/^\d{6}$/)) {
      showToast('Informe nome e código válidos.', 'error');
      return;
    }
    state.playerName = name;
    state.online = true;
    state.playerKey = 'player2';
    state.roomId = roomId;
    await joinRoom(roomId);
  });
  document.getElementById('btn-back').addEventListener('click', () => { audio.clickSound(); renderRoomChoice(); });
}

async function createRoom() {
  try {
    const roomId = firebase.generateRoomId();
    state.roomId = roomId;
    await firebase.createRoom(roomId, state.playerName);
    await startListening(roomId);
    renderWaiting();
    showToast(`Sala criada: ${roomId}`, 'success');
  } catch (error) {
    showToast(error.message || 'Erro ao criar sala.', 'error');
  }
}

async function joinRoom(roomId) {
  try {
    await firebase.joinRoom(roomId, state.playerName);
    await startListening(roomId);
    renderWaiting();
    showToast('Conectado à sala.', 'success');
  } catch (error) {
    showToast(error.message || 'Erro ao entrar na sala.', 'error');
  }
}

function renderWaiting() {
  const code = state.roomId || '';
  render(`
    <section class="screen card">
      <div>
        <h2 class="title">Sala ${code}</h2>
        <p class="subtitle">Aguardando oponente...</p>
      </div>
      <div class="row center">
        <div class="spinner"></div>
      </div>
      <div class="row center">
        ${createButton('Voltar ao Menu', 'btn-leave')}
      </div>
    </section>
  `);
  document.getElementById('btn-leave').addEventListener('click', async () => {
    audio.clickSound();
    await leaveRoom();
    renderHome();
  });
}

function renderSoloSetup() {
  render(`
    <section class="screen card">
      <div>
        <h2 class="title">Modo Solo</h2>
        <p class="subtitle">Enfrente a IA e teste seus reflexos estratégicos.</p>
      </div>
      <div class="row center">
        ${createButton('Começar', 'btn-start-solo')}
      </div>
      <div class="row center">
        ${createButton('Voltar', 'btn-back')}
      </div>
    </section>
  `);
  document.getElementById('btn-start-solo').addEventListener('click', () => {
    audio.clickSound();
    state.online = false;
    renderSoloGame();
  });
  document.getElementById('btn-back').addEventListener('click', () => { audio.clickSound(); renderHome(); });
}

function renderSoloGame() {
  state.selectedChoice = null;
  state.lastOutcome = null;
  renderGameScreen();
}

function renderGameScreen() {
  const p1 = state.online ? state.roomData?.player1 : { name: 'Você', score: state.roomData?.player1?.score ?? 0 };
  const p2 = state.online ? state.roomData?.player2 : { name: 'IA', score: state.roomData?.player2?.score ?? 0 };
  const showStatus = state.online ? state.roomData?.status : 'playing';
  const statusLabel = showStatus === 'waiting' ? 'AGUARDANDO' : 'JOGANDO';
  render(`
    <section class="screen card">
      <div class="row center">
        <div>
          <h2 class="title">Rodada ${state.online ? state.roomData?.round : 1}</h2>
          <p class="subtitle">${state.online ? 'Escolha sua jogada e aguarde oponente.' : 'Escolha sua jogada e desafie a IA.'}</p>
        </div>
        <span class="status-pill status-playing">${statusLabel}</span>
      </div>
      <div class="card feedback info">
        <div class="row">
          <div class="badge">${p1.name}: ${p1.score}</div>
          <div class="badge">${p2.name}: ${p2.score}</div>
        </div>
      </div>
      <div class="option-grid">
        ${['rock','paper','scissors'].map(choice => `
          <button class="choice-button" data-choice="${choice}">
            <strong>${game.getOptionLabel(choice)}</strong>
          </button>
        `).join('')}
      </div>
      <div class="row center">
        ${createButton('Voltar ao Menu', 'btn-home')}
      </div>
    </section>
  `);
  document.querySelectorAll('.choice-button').forEach((button) => {
    button.addEventListener('click', async () => {
      const choice = button.dataset.choice;
      audio.clickSound();
      button.classList.add('active');
      state.selectedChoice = choice;
      if (state.online) {
        await submitChoiceOnline(choice);
      } else {
        await playSolo(choice);
      }
    });
  });
  document.getElementById('btn-home').addEventListener('click', async () => {
    audio.clickSound();
    if (state.online) await leaveRoom();
    renderHome();
  });
}

async function playSolo(choice) {
  render(`
    <section class="screen card">
      <div class="row center">
        <div class="spinner"></div>
      </div>
      <div class="row center">
        <h2 class="title">IA está pensando...</h2>
      </div>
    </section>
  `);
  const delay = 1000 + Math.random() * 1000;
  await game.wait(delay);
  const aiChoice = game.randomChoice();
  const outcome = game.computeRound(choice, aiChoice);
  const result = {
    title: outcome.text,
    type: outcome.result === 'draw' ? 'draw' : outcome.result === 'player1' ? 'success' : 'error',
    player1Choice: choice,
    player2Choice: aiChoice,
    player1Name: 'Você',
    player2Name: 'IA'
  };
  if (outcome.result === 'player1') audio.successSound();
  if (outcome.result === 'player2') audio.failureSound();
  if (outcome.result === 'draw') audio.neutralSound();
  renderResult(result, false);
}

async function submitChoiceOnline(choice) {
  try {
    const path = `${state.playerKey}/choice`;
    await firebase.updateRoom(state.roomId, { [path]: choice });
    if (state.roomData?.player1?.choice && state.roomData?.player2?.choice && state.playerKey === 'player1') {
      await resolveOnlineRound(state.roomData);
    }
    renderWaitingForOpponent();
  } catch (error) {
    showToast('Erro ao enviar escolha.', 'error');
  }
}

function renderWaitingForOpponent() {
  render(`
    <section class="screen card">
      <div class="row center">
        <div class="spinner"></div>
      </div>
      <div class="row center">
        <h2 class="title">Esperando oponente...</h2>
      </div>
      <div class="row center">
        ${createButton('Voltar ao Menu', 'btn-home')}
      </div>
    </section>
  `);
  document.getElementById('btn-home').addEventListener('click', async () => {
    audio.clickSound();
    await leaveRoom();
    renderHome();
  });
}

async function resolveOnlineRound(roomData) {
  const outcome = game.computeRound(roomData.player1.choice, roomData.player2.choice);
  const updates = { status: 'reveal' };
  if (outcome.result === 'player1') {
    updates['player1/score'] = roomData.player1.score + 1;
  }
  if (outcome.result === 'player2') {
    updates['player2/score'] = roomData.player2.score + 1;
  }
  await firebase.updateRoom(state.roomId, updates);
}

function renderRevealScreen(roomData) {
  const outcome = game.computeRound(roomData.player1.choice, roomData.player2.choice);
  const resultType = outcome.result === 'draw' ? 'draw' : outcome.result === state.playerKey ? 'success' : 'error';
  const title = outcome.text;
  const player1Name = roomData.player1.name;
  const player2Name = roomData.player2.name;
  const player1Choice = game.getOptionLabel(roomData.player1.choice);
  const player2Choice = game.getOptionLabel(roomData.player2.choice);
  if (resultType === 'success') audio.successSound();
  if (resultType === 'error') audio.failureSound();
  if (resultType === 'draw') audio.neutralSound();
  render(`
    <section class="screen card">
      <div class="row center">
        <h2 class="title ${resultType === 'success' ? 'victory' : resultType === 'error' ? 'defeat' : 'draw'}">${title}</h2>
      </div>
      <div class="card feedback ${resultType === 'success' ? 'success' : resultType === 'error' ? 'error' : 'info'}">
        <p><strong>${player1Name}:</strong> ${player1Choice}</p>
        <p><strong>${player2Name}:</strong> ${player2Choice}</p>
      </div>
      <div class="row center">
        ${createButton('Revanche', 'btn-rematch')}
        ${createButton('Jogar Novamente', 'btn-restart')}
      </div>
      <div class="row center">
        ${createButton('Menu Principal', 'btn-home')}
      </div>
    </section>
  `);
  document.getElementById('btn-rematch').addEventListener('click', async () => {
    audio.clickSound();
    await rematchOnline();
  });
  document.getElementById('btn-restart').addEventListener('click', async () => {
    audio.clickSound();
    if (state.online) {
      await resetOnlineRoom();
      renderWaitingForOpponent();
    } else {
      renderSoloGame();
    }
  });
  document.getElementById('btn-home').addEventListener('click', async () => {
    audio.clickSound();
    if (state.online) await leaveRoom();
    renderHome();
  });
}

function renderResult(result, isOnline = false) {
  render(`
    <section class="screen card">
      <div class="row center">
        <h2 class="title ${result.type === 'success' ? 'victory' : result.type === 'error' ? 'defeat' : 'draw'}">${result.title}</h2>
      </div>
      <div class="card feedback ${result.type === 'success' ? 'success' : result.type === 'error' ? 'error' : 'info'}">
        <p><strong>${result.player1Name}</strong>: ${game.getOptionLabel(result.player1Choice)}</p>
        <p><strong>${result.player2Name}</strong>: ${game.getOptionLabel(result.player2Choice)}</p>
      </div>
      <div class="row center">
        ${createButton('Jogar Novamente', 'btn-restart')}
        ${createButton('Menu Principal', 'btn-home')}
      </div>
    </section>
  `);
  document.getElementById('btn-restart').addEventListener('click', () => {
    audio.clickSound();
    renderSoloGame();
  });
  document.getElementById('btn-home').addEventListener('click', () => { audio.clickSound(); renderHome(); });
}

async function rematchOnline() {
  if (!state.roomData) return;
  const nextRound = (state.roomData.round || 1) + 1;
  await firebase.updateRoom(state.roomId, {
    status: 'playing',
    round: nextRound,
    'player1/choice': null,
    'player2/choice': null
  });
}

async function resetOnlineRoom() {
  if (!state.roomData) return;
  await firebase.updateRoom(state.roomId, {
    status: 'playing',
    round: 1,
    'player1/choice': null,
    'player2/choice': null,
    'player1/score': 0,
    'player2/score': 0
  });
}

async function changePlayerState(roomData) {
  if (state.playerKey === 'player1') {
    state.opponentName = roomData.player2.name;
  } else {
    state.opponentName = roomData.player1.name;
  }
}

async function startListening(roomId) {
  if (state.listening) return;
  state.listening = true;
  firebase.listenRoom(roomId, async (roomData) => {
    state.roomData = roomData;
    if (!roomData) {
      showToast('Sala removida.', 'error');
      await leaveRoom();
      renderHome();
      return;
    }
    await changePlayerState(roomData);
    if (state.playerKey === 'player1' && roomData.status === 'waiting' && roomData.player2?.name) {
      await firebase.updateRoom(roomId, { status: 'playing' });
    }
    if (roomData.status === 'waiting') {
      if (previousOpponent && roomData.player2?.name !== previousOpponent) {
        showToast('Oponente saiu.', 'error');
      }
      renderWaiting();
    } else if (roomData.status === 'playing') {
      if (roomData.player1.choice && roomData.player2.choice && state.playerKey === 'player1') {
        await resolveOnlineRound(roomData);
      }
      renderGameScreen();
    } else if (roomData.status === 'reveal') {
      renderRevealScreen(roomData);
    }
    previousOpponent = roomData.player1.name && roomData.player2.name ? state.opponentName : previousOpponent;
  });
}

async function leaveRoom() {
  if (!state.online || !state.roomId) return;
  try {
    await firebase.leaveRoom(state.roomId, state.playerKey);
  } catch (error) {
    console.warn(error);
  } finally {
    firebase.stopListening(state.roomId);
    state.listening = false;
    state.roomId = null;
    state.playerKey = null;
    state.roomData = null;
    previousOpponent = '';
  }
}

async function initApp() {
  showLoading();
  await game.wait(1500);
  renderHome();
}

initApp();
