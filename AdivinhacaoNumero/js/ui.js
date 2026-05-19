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
  soloSecret: null,
  soloAttempts: 0,
  soloHint: '',
  resettingTie: false
};

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
  setTimeout(() => { toast.remove(); }, 3200);
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
  state.soloSecret = null;
  state.soloAttempts = 0;
  state.soloHint = '';
  state.resettingTie = false;
  firebase.stopListening(state.roomId);
  render(`
    <section class="screen card">
      <div>
        <h1 class="title">Adivinhação de Número</h1>
        <p class="subtitle">Escolha entre enfrentar outro jogador ou a IA.</p>
      </div>
      <div class="row">
        ${createButton('Modo Online', 'btn-online')}
        ${createButton('Modo Solo', 'btn-solo')}
      </div>
    </section>
  `);
  document.getElementById('btn-online').addEventListener('click', () => { audio.clickSound(); renderRoomChoice(); });
  document.getElementById('btn-solo').addEventListener('click', () => { audio.clickSound(); startSoloGame(); });
}

function renderRoomChoice() {
  render(`
    <section class="screen card">
      <div>
        <h2 class="title">Modo Online</h2>
        <p class="subtitle">Crie uma sala ou entre em um código de 6 dígitos.</p>
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
        <p class="subtitle">Informe seu nome e gere um código para o oponente.</p>
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
    const name = document.getElementById('player-name').value.trim();
    if (!name) { showToast('Digite seu nome.', 'error'); return; }
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
        <h2 class="title">Entrar Sala</h2>
        <p class="subtitle">Cole o código da sala e aguarde o início.</p>
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
      showToast('Nome e código devem ser válidos.', 'error');
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
    showToast('Entrou na sala.', 'success');
  } catch (error) {
    showToast(error.message || 'Erro ao entrar na sala.', 'error');
  }
}

function renderWaiting() {
  render(`
    <section class="screen card">
      <div>
        <h2 class="title">Sala ${state.roomId}</h2>
        <p class="subtitle">Aguardando oponente...</p>
      </div>
      <div class="row center">
        <div class="spinner"></div>
      </div>
      <div class="row center">
        ${createButton('Menu Principal', 'btn-home')}
      </div>
    </section>
  `);
  document.getElementById('btn-home').addEventListener('click', async () => {
    audio.clickSound();
    await leaveRoom();
    renderHome();
  });
}

function startSoloGame() {
  state.online = false;
  state.soloSecret = firebase.generateSecretNumber();
  state.soloAttempts = 0;
  state.soloHint = '';
  renderSoloRound();
}

function renderSoloRound() {
  render(`
    <section class="screen card">
      <div>
        <h2 class="title">Modo Solo</h2>
        <p class="subtitle">Tente adivinhar o número entre 1 e 100.</p>
      </div>
      <div class="card feedback info">
        <p>Tentativas: ${state.soloAttempts}</p>
        <p>${state.soloHint || 'Faça seu primeiro palpite.'}</p>
      </div>
      <div class="row">
        <input id="guess-input" type="number" min="1" max="100" placeholder="Digite um número" />
      </div>
      <div class="row">
        ${createButton('Enviar Palpite', 'btn-submit')}
        ${createButton('Voltar', 'btn-home')}
      </div>
    </section>
  `);
  document.getElementById('btn-submit').addEventListener('click', () => {
    audio.clickSound();
    const value = Number(document.getElementById('guess-input').value);
    if (!game.isValidGuess(value)) {
      showToast('Digite um número entre 1 e 100.', 'error');
      return;
    }
    state.soloAttempts += 1;
    const result = game.evaluateSoloGuess(state.soloSecret, value);
    if (result.correct) {
      audio.successSound();
      renderSoloResult(value);
      return;
    }
    audio.neutralSound();
    state.soloHint = result.hint;
    renderSoloRound();
  });
  document.getElementById('btn-home').addEventListener('click', () => { audio.clickSound(); renderHome(); });
}

function renderSoloResult(number) {
  render(`
    <section class="screen card">
      <div class="row center">
        <h2 class="title victory">VITÓRIA</h2>
      </div>
      <div class="card feedback success">
        <p>Você acertou o número <strong>${number}</strong> em <strong>${state.soloAttempts}</strong> tentativas.</p>
      </div>
      <div class="row">
        ${createButton('Jogar Novamente', 'btn-restart')}
        ${createButton('Menu Principal', 'btn-home')}
      </div>
    </section>
  `);
  document.getElementById('btn-restart').addEventListener('click', () => { audio.clickSound(); startSoloGame(); });
  document.getElementById('btn-home').addEventListener('click', () => { audio.clickSound(); renderHome(); });
}

function getOtherKey() {
  return state.playerKey === 'player1' ? 'player2' : 'player1';
}

function getPlayerLabel(key) {
  return key === 'player1' ? state.roomData.player1.name : state.roomData.player2.name;
}

function renderOnlineGame() {
  if (!state.roomData) return;
  const current = state.roomData[state.playerKey];
  const other = state.roomData[getOtherKey()];
  const status = state.roomData.status === 'waiting' ? 'Aguardando oponente' : 'Jogando';
  const hint = state.roomData.hint || 'Faça seu palpite.';
  render(`
    <section class="screen card">
      <div class="row center">
        <div>
          <h2 class="title">Rodada ${state.roomData.round}</h2>
          <p class="subtitle">${status}</p>
        </div>
        <span class="status-pill ${state.roomData.status === 'waiting' ? 'status-waiting' : 'status-playing'}">${status.toUpperCase()}</span>
      </div>
      <div class="card feedback info">
        <p>${state.roomData.player1.name}: ${state.roomData.player1.score}</p>
        <p>${state.roomData.player2.name}: ${state.roomData.player2.score}</p>
      </div>
      <div class="card feedback ${state.roomData.hint ? 'info' : 'success'}">
        <p>${hint}</p>
      </div>
      ${current.lastGuess ? `
        <div class="card feedback info">
          <p>Você já palpitaram: <strong>${current.lastGuess}</strong></p>
          <p>Aguardando ${other.name}...</p>
        </div>
      ` : `
        <div class="row">
          <input id="guess-input" type="number" min="1" max="100" placeholder="Digite seu palpite" />
        </div>
        <div class="row">
          ${createButton('Enviar Palpite', 'btn-submit')}
        </div>
      `}
      <div class="row">
        ${createButton('Menu Principal', 'btn-home')}
      </div>
    </section>
  `);
  if (!current.lastGuess) {
    document.getElementById('btn-submit').addEventListener('click', async () => {
      audio.clickSound();
      const value = Number(document.getElementById('guess-input').value);
      if (!game.isValidGuess(value)) {
        showToast('Número inválido. Use 1 a 100.', 'error');
        return;
      }
      await submitGuess(value);
    });
  }
  document.getElementById('btn-home').addEventListener('click', async () => {
    audio.clickSound();
    await leaveRoom();
    renderHome();
  });
}

function renderOnlineResult(resultData) {
  const isTie = resultData.winner === 'tie';
  const subtitle = isTie ? 'Empate! Gerando novo número...' : resultData.winner === state.playerKey ? 'VITÓRIA' : 'DERROTA';
  const typeClass = isTie ? 'draw' : resultData.winner === state.playerKey ? 'victory' : 'defeat';
  if (resultData.winner === state.playerKey) audio.successSound();
  else if (resultData.winner === 'tie') audio.neutralSound();
  else audio.failureSound();
  render(`
    <section class="screen card">
      <div class="row center">
        <h2 class="title ${typeClass}">${subtitle}</h2>
      </div>
      <div class="card feedback ${isTie ? 'info' : resultData.winner === state.playerKey ? 'success' : 'error'}">
        ${isTie ? `<p>Ambos acertaram. Novo número gerado automaticamente.</p>` : `<p>${getPlayerLabel(resultData.winner)} venceu o jogo.</p>`}
      </div>
      <div class="row">
        ${createButton('Jogar Novamente', 'btn-restart')}
        ${createButton('Menu Principal', 'btn-home')}
      </div>
    </section>
  `);
  document.getElementById('btn-restart').addEventListener('click', async () => {
    audio.clickSound();
    if (state.online) {
      await resetOnlineMatch();
      renderWaiting();
    }
  });
  document.getElementById('btn-home').addEventListener('click', async () => {
    audio.clickSound();
    await leaveRoom();
    renderHome();
  });
}

async function submitGuess(value) {
  const path = `${state.playerKey}/lastGuess`;
  await firebase.updateRoom(state.roomId, { [path]: value });
  state.roomData = {
    ...state.roomData,
    [state.playerKey]: {
      ...state.roomData[state.playerKey],
      lastGuess: value
    }
  };
  renderOnlineGame();
  if (state.roomData?.player1?.lastGuess && state.roomData?.player2?.lastGuess && state.playerKey === 'player1') {
    await resolveGuesses(state.roomData);
  }
}

async function resolveGuesses(roomData) {
  if (!roomData.player1.lastGuess || !roomData.player2.lastGuess) return;
  const compare = game.compareGuesses(roomData.secretNumber, Number(roomData.player1.lastGuess), Number(roomData.player2.lastGuess));
  if (compare.result === 'tie') {
    await firebase.updateRoom(state.roomId, {
      winner: 'tie',
      hint: compare.hint,
      status: 'finished'
    });
    scheduleTieReset(roomData);
    return;
  }
  if (compare.result) {
    const winnerKey = compare.result;
    const scorePath = `${winnerKey}/score`;
    const winnerScore = roomData[winnerKey].score + 1;
    await firebase.updateRoom(state.roomId, {
      winner: winnerKey,
      status: 'finished',
      [scorePath]: winnerScore,
      hint: null
    });
    return;
  }
  await firebase.updateRoom(state.roomId, {
    hint: compare.hint,
    round: roomData.round + 1,
    'player1/lastGuess': null,
    'player2/lastGuess': null
  });
}

function scheduleTieReset(roomData) {
  if (state.playerKey !== 'player1' || state.resettingTie) return;
  state.resettingTie = true;
  setTimeout(async () => {
    const newSecret = firebase.generateSecretNumber();
    await firebase.updateRoom(state.roomId, {
      secretNumber: newSecret,
      status: 'playing',
      winner: null,
      hint: null,
      round: roomData.round + 1,
      'player1/lastGuess': null,
      'player2/lastGuess': null
    });
    state.resettingTie = false;
  }, 1800);
}

async function resetOnlineMatch() {
  if (!state.roomData) return;
  await firebase.updateRoom(state.roomId, {
    secretNumber: firebase.generateSecretNumber(),
    winner: null,
    hint: null,
    status: 'playing',
    round: 1,
    'player1/lastGuess': null,
    'player2/lastGuess': null,
    'player1/score': 0,
    'player2/score': 0
  });
}

async function changeOpponent(roomData) {
  if (state.playerKey === 'player1') {
    state.opponentName = roomData.player2.name;
  } else {
    state.opponentName = roomData.player1.name;
  }
}

async function startListening(roomId) {
  firebase.listenRoom(roomId, async (roomData) => {
    if (!roomData) {
      showToast('Sala removida.', 'error');
      await leaveRoom();
      renderHome();
      return;
    }
    state.roomData = roomData;
    await changeOpponent(roomData);
    if (state.playerKey === 'player1' && roomData.status === 'waiting' && roomData.player2?.name) {
      await firebase.updateRoom(roomId, { status: 'playing' });
    }
    if (roomData.status === 'waiting') {
      renderWaiting();
      return;
    }
    if (roomData.status === 'playing') {
      renderOnlineGame();
      return;
    }
    if (roomData.status === 'finished') {
      renderOnlineResult(roomData);
      return;
    }
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
    state.roomId = null;
    state.playerKey = null;
    state.roomData = null;
    state.opponentName = '';
  }
}

async function initApp() {
  showLoading();
  setTimeout(() => renderHome(), 1500);
}

initApp();
