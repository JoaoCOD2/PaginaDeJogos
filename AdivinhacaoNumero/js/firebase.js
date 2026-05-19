import { initializeApp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";
import {
  getDatabase,
  ref,
  set,
  update,
  remove,
  onValue,
  off,
  get
} from "https://www.gstatic.com/firebasejs/12.13.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyCV4jJ6vrvQ9WUHW8CIt-5AdmTdILLcXdE",
  authDomain: "adivivinhacao.firebaseapp.com",
  projectId: "adivivinhacao",
  storageBucket: "adivivinhacao.firebasestorage.app",
  messagingSenderId: "865141141059",
  appId: "1:865141141059:web:de4d7283ff64999e83eef6",
  measurementId: "G-H41GQLWR49"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

function roomRef(roomId) {
  return ref(db, `rooms/${roomId}`);
}

export function generateRoomId() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function generateSecretNumber() {
  return Math.floor(Math.random() * 100) + 1;
}

export async function createRoom(roomId, playerName) {
  const roomData = {
    secretNumber: generateSecretNumber(),
    player1: { name: playerName, lastGuess: null, score: 0 },
    player2: { name: "", lastGuess: null, score: 0 },
    status: "waiting",
    hint: null,
    winner: null,
    round: 1
  };
  await set(roomRef(roomId), roomData);
  return roomData;
}

export async function joinRoom(roomId, playerName) {
  const snapshot = await get(roomRef(roomId));
  if (!snapshot.exists()) {
    throw new Error("Sala não encontrada.");
  }
  const data = snapshot.val();
  if (data.status !== "waiting") {
    throw new Error("Sala já está em jogo.");
  }
  if (data.player2?.name) {
    throw new Error("Sala já está cheia.");
  }
  await update(roomRef(roomId), {
    player2: { name: playerName, lastGuess: null, score: 0 },
    status: "playing"
  });
  return { ...data, player2: { name: playerName, lastGuess: null, score: 0 }, status: "playing" };
}

export async function updateRoom(roomId, payload) {
  await update(roomRef(roomId), payload);
}

export async function leaveRoom(roomId, playerKey) {
  const snapshot = await get(roomRef(roomId));
  if (!snapshot.exists()) return;
  const room = snapshot.val();
  const otherKey = playerKey === "player1" ? "player2" : "player1";
  const otherPlayer = room[otherKey];
  const otherActive = otherPlayer && otherPlayer.name;
  const updates = {
    [playerKey]: { name: "", lastGuess: null, score: 0 },
    status: otherActive ? "waiting" : "finished"
  };
  await update(roomRef(roomId), updates);
}

export function listenRoom(roomId, callback) {
  const refRoom = roomRef(roomId);
  onValue(refRoom, (snapshot) => {
    callback(snapshot.exists() ? snapshot.val() : null);
  });
}

export function stopListening(roomId) {
  if (!roomId) return;
  off(roomRef(roomId));
}
