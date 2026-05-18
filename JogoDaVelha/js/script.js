// ========================================
// IMPORTAÇÕES DO FIREBASE
// ========================================

import { ref, set, get, update, onValue, remove, off, child } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-database.js";

// ========================================
// VARIÁVEIS GLOBAIS
// ========================================

let database;
let gameMode = null; // 'solo' ou 'multiplayer'
let currentRoomId = null;
let playerSymbol = null; // 'X' ou 'O'
let currentPlayer = 'X';
let board = ['', '', '', '', '', '', '', '', ''];
let gameActive = false;
let gameWon = false;
let gameOver = false;
let playersConnected = 0;
let onlineStatus = true;
let computerThinking = false;

// Listeners de tempo real
const activeListeners = [];

// Elemento do tabuleiro
const cells = document.querySelectorAll('.cell');
const winLine = document.getElementById('win-line');
const boardElement = document.querySelector('.board');

// Elementos de tela
const startScreen = document.getElementById('startScreen');
const multiplayerScreen = document.getElementById('multiplayerScreen');
const gameScreen = document.getElementById('gameScreen');

// Elementos de tela inicial
const soloBtn = document.getElementById('soloBtn');
const multiplayerBtn = document.getElementById('multiplayerBtn');

// Elementos de multiplayer
const createRoomBtn = document.getElementById('createRoomBtn');
const joinRoomBtn = document.getElementById('joinRoomBtn');
const backToMenuBtn = document.getElementById('backToMenuBtn');
const joinModal = document.getElementById('joinModal');
const roomCodeInput = document.getElementById('roomCodeInput');
const confirmJoinBtn = document.getElementById('confirmJoinBtn');
const cancelJoinBtn = document.getElementById('cancelJoinBtn');
const errorMessage = document.getElementById('errorMessage');

// Elementos de jogo
const gameStatus = document.getElementById('gameStatus');
const roomCodeDisplay = document.getElementById('roomCodeDisplay');
const copyRoomBtn = document.getElementById('copyRoomBtn');
const playerSymbolDisplay = document.getElementById('playerSymbol');
const playerLabel = document.getElementById('playerLabel');
const restartBtn = document.getElementById('restartBtn');
const exitBtn = document.getElementById('exitBtn');
const onlineStatusDot = document.getElementById('onlineStatus');
const onlineText = document.getElementById('onlineText');

// Condições de vitória
const winConditions = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6]
];

// ========================================
// INICIALIZAÇÃO
// ========================================

window.addEventListener('load', () => {
    // Obter database do Firebase inicializado no HTML
    if (window.firebaseConfig) {
        database = window.firebaseConfig.database;
    } else {
        console.error('Firebase não foi inicializado');
        return;
    }

    setupEventListeners();
    setupConnectionMonitoring();
});

// ========================================
// EVENT LISTENERS
// ========================================

function setupEventListeners() {
    // Tela inicial
    soloBtn.addEventListener('click', startSoloGame);
    multiplayerBtn.addEventListener('click', showMultiplayerScreen);
    
    // Tela multiplayer
    createRoomBtn.addEventListener('click', createNewRoom);
    joinRoomBtn.addEventListener('click', openJoinModal);
    backToMenuBtn.addEventListener('click', backToMainMenu);
    confirmJoinBtn.addEventListener('click', confirmJoinRoom);
    cancelJoinBtn.addEventListener('click', closeJoinModal);
    copyRoomBtn.addEventListener('click', copyRoomCode);
    restartBtn.addEventListener('click', restartGame);
    exitBtn.addEventListener('click', exitGame);

    cells.forEach(cell => {
        cell.addEventListener('click', handleCellClick);
    });

    // Fechar modal ao pressionar ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !joinModal.classList.contains('hidden')) {
            closeJoinModal();
        }
    });

    // Enter para entrar em sala
    roomCodeInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            confirmJoinRoom();
        }
    });
}

// ========================================
// MODO SOLO
// ========================================

function startSoloGame() {
    gameMode = 'solo';
    playerSymbol = 'X'; // Jogador é sempre X
    currentPlayer = 'X';
    board = ['', '', '', '', '', '', '', '', ''];
    gameActive = true;
    gameWon = false;
    gameOver = false;
    computerThinking = false;

    showGameScreen();
}

// ========================================
// TELA MULTIPLAYER
// ========================================

function showMultiplayerScreen() {
    startScreen.classList.remove('active');
    multiplayerScreen.classList.add('active');
}

function backToMainMenu() {
    multiplayerScreen.classList.remove('active');
    startScreen.classList.add('active');
}

// ========================================
// CRIAR NOVA SALA (MULTIPLAYER)
// ========================================

async function createNewRoom() {
    try {
        gameMode = 'multiplayer';
        // Gerar código de sala aleatório
        const roomCode = generateRoomCode();
        currentRoomId = roomCode;

        // Estrutura inicial da sala
        const roomData = {
            board: board,
            currentPlayer: 'X',
            players: { x: true, o: false },
            winner: null,
            status: 'waiting', // waiting, playing, finished
            createdAt: Date.now()
        };

        // Criar sala no Firebase
        await set(ref(database, `rooms/${roomCode}`), roomData);

        // Atribuir símbolo X (primeiro jogador)
        playerSymbol = 'X';
        
        // Mostrar tela de jogo
        multiplayerScreen.classList.remove('active');
        showGameScreen();

        // Configurar listeners da sala
        setupRoomListeners();

    } catch (error) {
        console.error('Erro ao criar sala:', error);
        alert('Erro ao criar sala. Tente novamente.');
    }
}

// ========================================
// ENTRAR EM SALA (MULTIPLAYER)
// ========================================

function openJoinModal() {
    joinModal.classList.remove('hidden');
    roomCodeInput.focus();
    roomCodeInput.value = '';
    errorMessage.textContent = '';
}

function closeJoinModal() {
    joinModal.classList.add('hidden');
}

async function confirmJoinRoom() {
    const code = roomCodeInput.value.toUpperCase().trim();

    if (!code || code.length !== 6) {
        errorMessage.textContent = 'Código inválido. Use 6 caracteres.';
        return;
    }

    try {
        gameMode = 'multiplayer';
        // Verificar se sala existe
        const roomRef = ref(database, `rooms/${code}`);
        const snapshot = await get(roomRef);

        if (!snapshot.exists()) {
            errorMessage.textContent = 'Sala não encontrada.';
            return;
        }

        const roomData = snapshot.val();

        // Verificar se já tem 2 jogadores
        if (roomData.players.x && roomData.players.o) {
            errorMessage.textContent = 'Sala cheia. Máximo 2 jogadores.';
            return;
        }

        // Verificar se a sala já começou e se há vencedor
        if (roomData.status === 'finished' && roomData.winner) {
            errorMessage.textContent = 'Jogo já foi finalizado. Crie uma nova sala.';
            return;
        }

        // Atribuir símbolo O (segundo jogador)
        playerSymbol = 'O';
        currentRoomId = code;

        // Atualizar sala com segundo jogador
        await update(roomRef, {
            'players/o': true,
            status: 'playing'
        });

        // Fechar modal e mostrar jogo
        closeJoinModal();
        multiplayerScreen.classList.remove('active');
        showGameScreen();

        // Configurar listeners
        setupRoomListeners();

    } catch (error) {
        console.error('Erro ao entrar de sala:', error);
        errorMessage.textContent = 'Erro ao conectar. Tente novamente.';
    }
}

// ========================================
// LISTENERS DA SALA EM TEMPO REAL
// ========================================

function setupRoomListeners() {
    if (!currentRoomId) return;

    const roomRef = ref(database, `rooms/${currentRoomId}`);

    // Listener para mudanças no tabuleiro
    const boardListener = onValue(roomRef, (snapshot) => {
        if (!snapshot.exists()) {
            // Sala foi deletada, outro jogador saiu
            handlePlayerDisconnected();
            return;
        }

        const roomData = snapshot.val();
        
        // Atualizar tabuleiro local
        board = roomData.board || ['', '', '', '', '', '', '', '', ''];
        currentPlayer = roomData.currentPlayer || 'X';
        gameOver = roomData.status === 'finished';

        // Renderizar tabuleiro
        renderBoard();

        // Atualizar status de jogadores
        playersConnected = (roomData.players.x ? 1 : 0) + (roomData.players.o ? 1 : 0);

        // Atualizar interface
        updateGameStatus();

        // Verificar vitória
        if (roomData.winner) {
            handleGameEnd(roomData.winner);
        }

        // Se status é 'playing' e há 2 jogadores, ativar jogo
        if (roomData.players.x && roomData.players.o && roomData.status === 'playing') {
            gameActive = true;
        }
    });

    activeListeners.push({ ref: roomRef, callback: boardListener });
}

// ========================================
// LIDAR COM CLIQUE EM CÉLULA
// ========================================

async function handleCellClick(e) {
    const index = e.target.dataset.index;

    if (gameMode === 'solo') {
        handleSoloCellClick(index);
    } else {
        handleMultiplayerCellClick(index);
    }
}

async function handleSoloCellClick(index) {
    if (!gameActive || gameWon || gameOver || computerThinking) return;

    // Verificar se célula está vazia
    if (board[index] !== '') return;

    // Jogador faz sua jogada (sempre X)
    board[index] = 'X';
    renderBoard();

    // Verificar vitória do jogador
    const winResult = checkWinner();
    
    if (winResult) {
        gameActive = false;
        gameWon = true;
        gameStatus.textContent = '✅ Você venceu!';
        showWinLine(winResult.condition);
        return;
    }

    // Verificar empate
    if (!board.includes('')) {
        gameActive = false;
        gameOver = true;
        gameStatus.textContent = '🤝 Empate!';
        return;
    }

    // Vez do computador
    currentPlayer = 'O';
    gameStatus.textContent = '⏳ Computador pensando...';
    computerThinking = true;

    // Aguardar um pouco para não parecer instantâneo
    setTimeout(() => {
        makeComputerMove();
    }, 500);
}

async function handleMultiplayerCellClick(index) {
    if (!gameActive || gameWon || gameOver) return;

    // Verificar se célula está vazia
    if (board[index] !== '') return;

    // Verificar se é a vez do jogador
    if (currentPlayer !== playerSymbol) {
        gameStatus.textContent = '❌ Não é sua vez!';
        setTimeout(() => updateGameStatus(), 2000);
        return;
    }

    try {
        // Atualizar tabuleiro
        board[index] = playerSymbol;

        // Verificar vitória local
        const winResult = checkWinner();
        
        if (winResult) {
            // Jogador venceu
            await updateRoomInFirebase(playerSymbol);
            gameActive = false;
            gameWon = true;
            showWinLine(winResult.condition);
            updateGameStatus();
            return;
        }

        // Verificar empate
        if (!board.includes('')) {
            await updateRoomInFirebase('draw');
            gameActive = false;
            gameOver = true;
            updateGameStatus();
            return;
        }

        // Próximo jogador
        currentPlayer = currentPlayer === 'X' ? 'O' : 'X';

        // Atualizar Firebase
        await update(ref(database, `rooms/${currentRoomId}`), {
            board: board,
            currentPlayer: currentPlayer
        });

    } catch (error) {
        console.error('Erro ao fazer jogada:', error);
    }
}

// ========================================
// IA - COMPUTADOR
// ========================================

function makeComputerMove() {
    // Verificar se computador pode vencer
    const winMove = findWinningMove('O');
    if (winMove !== -1) {
        board[winMove] = 'O';
        renderBoard();
        
        const winResult = checkWinner();
        if (winResult) {
            gameActive = false;
            gameWon = false;
            gameStatus.textContent = '❌ Computador venceu!';
            showWinLine(winResult.condition);
            computerThinking = false;
            return;
        }
    } else {
        // Impedir vitória do jogador
        const blockMove = findWinningMove('X');
        if (blockMove !== -1) {
            board[blockMove] = 'O';
            renderBoard();
        } else {
            // Estratégia: centro, cantos, depois meio
            const move = getBestMove();
            board[move] = 'O';
            renderBoard();
        }
    }

    // Verificar empate
    if (!board.includes('')) {
        gameActive = false;
        gameOver = true;
        gameStatus.textContent = '🤝 Empate!';
        computerThinking = false;
        return;
    }

    // Volta a vez do jogador
    currentPlayer = 'X';
    gameStatus.textContent = '🎮 Sua vez';
    computerThinking = false;
}

function findWinningMove(player) {
    for (let i = 0; i < 9; i++) {
        if (board[i] === '') {
            board[i] = player;
            if (checkWinner()) {
                board[i] = '';
                return i;
            }
            board[i] = '';
        }
    }
    return -1;
}

function getBestMove() {
    // Prioridade: centro > cantos > meio
    const priorities = [4, 0, 2, 6, 8, 1, 3, 5, 7];
    
    for (let i of priorities) {
        if (board[i] === '') {
            return i;
        }
    }
    
    return -1;
}


// ========================================
// VERIFICAR VENCEDOR
// ========================================

function checkWinner() {
    for (let condition of winConditions) {
        const [a, b, c] = condition;

        if (
            board[a] &&
            board[a] === board[b] &&
            board[a] === board[c]
        ) {
            return {
                winner: board[a],
                condition: condition
            };
        }
    }

    return null;
}

// ========================================
// RENDERIZAR TABULEIRO
// ========================================

function renderBoard() {
    cells.forEach((cell, index) => {
        cell.textContent = board[index];
        
        // Adicionar classe 'disabled' se jogo acabou
        if (!gameActive && !gameWon && gameMode === 'multiplayer') {
            cell.classList.add('disabled');
        } else if ((gameWon || gameOver) && gameMode === 'solo') {
            cell.classList.add('disabled');
        } else {
            cell.classList.remove('disabled');
        }
    });
}

// ========================================
// ATUALIZAR STATUS DO JOGO
// ========================================

function updateGameStatus() {
    if (gameMode === 'multiplayer') {
        if (playersConnected < 2) {
            gameStatus.textContent = '⏳ Esperando segundo jogador...';
            gameActive = false;
            return;
        }

        if (gameWon) {
            if (playerSymbol === board.find(cell => cell !== '')) {
                gameStatus.textContent = '✅ Você venceu!';
            } else {
                gameStatus.textContent = '❌ Você perdeu!';
            }
            return;
        }

        if (gameOver) {
            gameStatus.textContent = '🤝 Empate!';
            return;
        }

        if (currentPlayer === playerSymbol) {
            gameStatus.textContent = '🎮 Sua vez';
        } else {
            gameStatus.textContent = '⌛ Vez do adversário';
        }
    } else {
        if (gameWon) {
            gameStatus.textContent = '✅ Você venceu!';
            return;
        }

        if (gameOver) {
            gameStatus.textContent = '🤝 Empate!';
            return;
        }

        if (currentPlayer === 'X') {
            gameStatus.textContent = '🎮 Sua vez';
        } else if (!computerThinking) {
            gameStatus.textContent = '⌛ Vez do computador';
        }
    }
}

// ========================================
// MOSTRAR LINHA DE VITÓRIA
// ========================================

function showWinLine(condition) {
    if (!boardElement) return;

    const firstCell = cells[condition[0]];
    const lastCell = cells[condition[2]];
    const boardRect = boardElement.getBoundingClientRect();
    const firstRect = firstCell.getBoundingClientRect();
    const lastRect = lastCell.getBoundingClientRect();

    const startX = firstRect.left + firstRect.width / 2 - boardRect.left;
    const startY = firstRect.top + firstRect.height / 2 - boardRect.top;
    const endX = lastRect.left + lastRect.width / 2 - boardRect.left;
    const endY = lastRect.top + lastRect.height / 2 - boardRect.top;

    const deltaX = endX - startX;
    const deltaY = endY - startY;
    const length = Math.hypot(deltaX, deltaY);
    const angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);

    winLine.style.opacity = "0";
    winLine.style.width = `${length}px`;
    winLine.style.height = `6px`;
    winLine.style.top = `${(startY + endY) / 2}px`;
    winLine.style.left = `${(startX + endX) / 2}px`;
    winLine.style.transform = `translate(-50%, -50%) rotate(${angle}deg) scaleX(0)`;

    requestAnimationFrame(() => {
        winLine.style.opacity = "1";
        winLine.style.transform = `translate(-50%, -50%) rotate(${angle}deg) scaleX(1)`;
    });
}


// ========================================
// FINALIZAR JOGO
// ========================================

async function handleGameEnd(winner) {
    gameActive = false;

    if (winner === 'draw') {
        gameStatus.textContent = '🤝 Empate!';
        gameOver = true;
    } else {
        gameWon = (winner === playerSymbol);

        if (gameWon) {
            gameStatus.textContent = '✅ Você venceu!';
            const winResult = checkWinner();
            if (winResult) {
                showWinLine(winResult.condition);
            }
        } else {
            gameStatus.textContent = '❌ Você perdeu!';
        }

        gameOver = true;
    }

    // Desabilitar células
    cells.forEach(cell => cell.classList.add('disabled'));
}

// ========================================
// ATUALIZAR ROOM NO FIREBASE
// ========================================

async function updateRoomInFirebase(result) {
    try {
        const updateData = {
            board: board,
            status: 'finished'
        };

        if (result !== 'draw') {
            updateData.winner = result;
        } else {
            updateData.winner = 'draw';
        }

        await update(ref(database, `rooms/${currentRoomId}`), updateData);
    } catch (error) {
        console.error('Erro ao atualizar Firebase:', error);
    }
}

// ========================================
// REINICIAR JOGO
// ========================================

async function restartGame() {
    if (gameMode === 'solo') {
        restartSoloGame();
    } else {
        restartMultiplayerGame();
    }
}

function restartSoloGame() {
    try {
        board = ['', '', '', '', '', '', '', '', ''];
        currentPlayer = 'X';
        gameActive = true;
        gameWon = false;
        gameOver = false;
        computerThinking = false;

        winLine.style.opacity = "0";
        winLine.style.transform = "scale(0)";

        cells.forEach(cell => {
            cell.textContent = '';
            cell.classList.remove('disabled');
        });

        renderBoard();
        updateGameStatus();

    } catch (error) {
        console.error('Erro ao reiniciar jogo:', error);
    }
}

async function restartMultiplayerGame() {
    try {
        board = ['', '', '', '', '', '', '', '', ''];
        currentPlayer = 'X';
        gameActive = true;
        gameWon = false;
        gameOver = false;
        playerSymbol === 'X' ? (playerSymbol = 'X') : (playerSymbol = 'O');

        winLine.style.opacity = "0";
        winLine.style.transform = "scale(0)";

        cells.forEach(cell => {
            cell.textContent = '';
            cell.classList.remove('disabled');
        });

        // Atualizar Firebase
        await update(ref(database, `rooms/${currentRoomId}`), {
            board: board,
            currentPlayer: 'X',
            winner: null,
            status: 'playing'
        });

        updateGameStatus();

    } catch (error) {
        console.error('Erro ao reiniciar jogo:', error);
    }
}

// ========================================
// SAIR DO JOGO
// ========================================

async function exitGame() {
    try {
        if (gameMode === 'multiplayer') {
            // Remover listeners
            removeAllListeners();

            // Deletar sala se foi o criador (X)
            if (playerSymbol === 'X' && currentRoomId) {
                await remove(ref(database, `rooms/${currentRoomId}`));
            } else if (currentRoomId) {
                // Apenas remover o jogador O
                await update(ref(database, `rooms/${currentRoomId}`), {
                    'players/o': false,
                    status: 'waiting'
                });
            }
        }

        // Resetar variáveis
        resetGameState();

        // Voltar para tela inicial
        gameScreen.classList.remove('active');
        multiplayerScreen.classList.remove('active');
        startScreen.classList.add('active');

    } catch (error) {
        console.error('Erro ao sair:', error);
    }
}

// ========================================
// COPIAR CÓDIGO DA SALA
// ========================================

async function copyRoomCode() {
    try {
        const code = roomCodeDisplay.textContent;
        await navigator.clipboard.writeText(code);
        
        const originalText = copyRoomBtn.textContent;
        copyRoomBtn.textContent = '✓';
        
        setTimeout(() => {
            copyRoomBtn.textContent = originalText;
        }, 2000);
    } catch (error) {
        console.error('Erro ao copiar:', error);
    }
}

// ========================================
// GERENCIAR DESCONEXÃO DE JOGADOR
// ========================================

async function handlePlayerDisconnected() {
    gameActive = false;
    playersConnected = 1;
    gameStatus.textContent = '❌ Jogador desconectado! Sala fechada.';
    cells.forEach(cell => cell.classList.add('disabled'));
    
    setTimeout(() => {
        exitGame();
    }, 3000);
}

// ========================================
// MONITORAR CONEXÃO ONLINE
// ========================================

function setupConnectionMonitoring() {
    window.addEventListener('online', () => {
        onlineStatus = true;
        updateOnlineStatus();
    });

    window.addEventListener('offline', () => {
        onlineStatus = false;
        updateOnlineStatus();
    });
}

function updateOnlineStatus() {
    if (gameMode === 'multiplayer') {
        if (onlineStatus) {
            onlineStatusDot.className = 'status-dot online';
            onlineText.textContent = 'Online';
        } else {
            onlineStatusDot.className = 'status-dot offline';
            onlineText.textContent = 'Offline';
        }
    }
}

// ========================================
// TELAS
// ========================================

function showGameScreen() {
    startScreen.classList.remove('active');
    multiplayerScreen.classList.remove('active');
    gameScreen.classList.add('active');
    
    if (gameMode === 'multiplayer') {
        // Atualizar displays
        roomCodeDisplay.textContent = currentRoomId;
        playerSymbolDisplay.textContent = playerSymbol;
        playerLabel.textContent = playerSymbol === 'X' ? '(Você começou)' : '(Jogador 2)';
        onlineStatusDot.style.display = 'inline-block';
        onlineText.style.display = 'inline';
        roomCodeDisplay.parentElement.style.display = 'block';
        copyRoomBtn.style.display = 'inline-block';
    } else {
        // Modo solo
        playerSymbolDisplay.textContent = '🎮';
        playerLabel.textContent = 'vs Computador';
        onlineStatusDot.style.display = 'none';
        onlineText.style.display = 'none';
        roomCodeDisplay.parentElement.style.display = 'none';
        copyRoomBtn.style.display = 'none';
    }
    
    renderBoard();
    updateGameStatus();
}

// ========================================
// UTILITÁRIOS
// ========================================

function generateRoomCode() {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return code;
}

function resetGameState() {
    gameMode = null;
    currentRoomId = null;
    playerSymbol = null;
    currentPlayer = 'X';
    board = ['', '', '', '', '', '', '', '', ''];
    gameActive = false;
    gameWon = false;
    gameOver = false;
    playersConnected = 0;
    computerThinking = false;

    winLine.style.opacity = "0";
    winLine.style.transform = "scale(0)";

    cells.forEach(cell => {
        cell.textContent = '';
        cell.classList.remove('disabled');
    });
}

function removeAllListeners() {
    activeListeners.forEach(listener => {
        off(listener.ref, 'value', listener.callback);
    });
    activeListeners.length = 0;
}