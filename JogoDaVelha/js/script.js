// ========================================
// IMPORTAÇÕES DO FIREBASE
// ========================================

import { ref, set, get, update, onValue, remove, off, child } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-database.js";

// ========================================
// VARIÁVEIS GLOBAIS
// ========================================

let database;
let currentRoomId = null;
let playerSymbol = null; // 'X' ou 'O'
let currentPlayer = 'X';
let board = ['', '', '', '', '', '', '', '', ''];
let gameActive = false;
let gameWon = false;
let gameOver = false;
let playersConnected = 0;
let onlineStatus = true;

// Listeners de tempo real
const activeListeners = [];

// Elemento do tabuleiro
const cells = document.querySelectorAll('.cell');
const winLine = document.getElementById('win-line');

// Elementos de tela
const startScreen = document.getElementById('startScreen');
const gameScreen = document.getElementById('gameScreen');

// Elementos de tela inicial
const createRoomBtn = document.getElementById('createRoomBtn');
const joinRoomBtn = document.getElementById('joinRoomBtn');
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
    createRoomBtn.addEventListener('click', createNewRoom);
    joinRoomBtn.addEventListener('click', openJoinModal);
    confirmJoinBtn.addEventListener('click', confirmJoinRoom);
    cancelJoinBtn.addEventListener('click', closeJoinModal);
    copyRoomBtn.addEventListener('click', copyRoomCode);
    restartBtn.addEventListener('click', restartGameOnline);
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
// CRIAR NOVA SALA
// ========================================

async function createNewRoom() {
    try {
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
        showGameScreen();

        // Configurar listeners da sala
        setupRoomListeners();

    } catch (error) {
        console.error('Erro ao criar sala:', error);
        alert('Erro ao criar sala. Tente novamente.');
    }
}

// ========================================
// ENTRAR EM SALA
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
        showGameScreen();

        // Configurar listeners
        setupRoomListeners();

    } catch (error) {
        console.error('Erro ao entrar em sala:', error);
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
    if (!gameActive || gameWon || gameOver) return;

    const index = e.target.dataset.index;

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
        if (!gameActive && !gameWon) {
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
}

// ========================================
// MOSTRAR LINHA DE VITÓRIA
// ========================================

function showWinLine(condition) {
    const lines = {
        "0,1,2": {
            width: "380px",
            height: "6px",
            top: "60px",
            left: "0px",
            rotate: "0deg"
        },
        "3,4,5": {
            width: "380px",
            height: "6px",
            top: "190px",
            left: "0px",
            rotate: "0deg"
        },
        "6,7,8": {
            width: "380px",
            height: "6px",
            top: "320px",
            left: "0px",
            rotate: "0deg"
        },
        "0,3,6": {
            width: "6px",
            height: "380px",
            top: "0px",
            left: "60px",
            rotate: "0deg"
        },
        "1,4,7": {
            width: "6px",
            height: "380px",
            top: "0px",
            left: "190px",
            rotate: "0deg"
        },
        "2,5,8": {
            width: "6px",
            height: "380px",
            top: "0px",
            left: "320px",
            rotate: "0deg"
        },
        "0,4,8": {
            width: "500px",
            height: "6px",
            top: "188px",
            left: "-60px",
            rotate: "45deg"
        },
        "2,4,6": {
            width: "500px",
            height: "6px",
            top: "188px",
            left: "-60px",
            rotate: "-45deg"
        }
    };

    const key = condition.join(",");
    const line = lines[key];

    winLine.style.opacity = "0";
    winLine.style.width = line.width;
    winLine.style.height = line.height;
    winLine.style.top = line.top;
    winLine.style.left = line.left;
    winLine.style.transform = `rotate(${line.rotate}) scale(0)`;

    setTimeout(() => {
        winLine.style.opacity = "1";
        winLine.style.transform = `rotate(${line.rotate}) scale(1)`;
    }, 10);
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
// REINICIAR JOGO ONLINE
// ========================================

async function restartGameOnline() {
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

        // Resetar variáveis
        resetGameState();

        // Voltar para tela inicial
        startScreen.classList.add('active');
        gameScreen.classList.remove('active');

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
    if (onlineStatus) {
        onlineStatusDot.className = 'status-dot online';
        onlineText.textContent = 'Online';
    } else {
        onlineStatusDot.className = 'status-dot offline';
        onlineText.textContent = 'Offline';
    }
}

// ========================================
// TELAS
// ========================================

function showGameScreen() {
    startScreen.classList.remove('active');
    gameScreen.classList.add('active');
    
    // Atualizar displays
    roomCodeDisplay.textContent = currentRoomId;
    playerSymbolDisplay.textContent = playerSymbol;
    playerLabel.textContent = playerSymbol === 'X' ? '(Você comçou)' : '(Jogador 2)';
    
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
    currentRoomId = null;
    playerSymbol = null;
    currentPlayer = 'X';
    board = ['', '', '', '', '', '', '', '', ''];
    gameActive = false;
    gameWon = false;
    gameOver = false;
    playersConnected = 0;
}

function removeAllListeners() {
    activeListeners.forEach(({ ref: listenerRef, callback }) => {
        off(listenerRef, 'value', callback);
    });
    activeListeners.length = 0;
}