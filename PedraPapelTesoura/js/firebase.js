import { initializeApp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";
import {
  getDatabase,
  ref,
  set,
  update,
  remove,
  onValue,
  off,
  get,
  child
} from "https://www.gstatic.com/firebasejs/12.13.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyCK4b-gODV6RRbvWnEqc9m417i56tiCEYs",
  authDomain: "pedrapapeltesoura-37e16.firebaseapp.com",
  projectId: "pedrapapeltesoura-37e16",
  storageBucket: "pedrapapeltesoura-37e16.firebasestorage.app",
  messagingSenderId: "181125424511",
  appId: "1:181125424511:web:9e5104165f6de5357ca64a",
  measurementId: "G-NH11JPZ58S"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

function roomRef(roomId) {
  return ref(db, `rooms/${roomId}`);
}

export function generateRoomId() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function createRoom(roomId, playerName) {
  const roomData = {
    player1: { name: playerName, choice: null, score: 0 },
    player2: { name: "", choice: null, score: 0 },
    status: "waiting",
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
    player2: { name: playerName, choice: null, score: 0 },
    status: "playing"
  });
  return { ...data, player2: { name: playerName, choice: null, score: 0 }, status: "playing" };
}

export async function updateRoom(roomId, payload) {
  await update(roomRef(roomId), payload);
}

export async function leaveRoom(roomId, playerKey) {
  const roomSnapshot = await get(roomRef(roomId));
  if (!roomSnapshot.exists()) return;
  const room = roomSnapshot.val();
  const otherKey = playerKey === "player1" ? "player2" : "player1";
  const otherPlayer = room[otherKey];
  const otherActive = otherPlayer && otherPlayer.name;
  const updates = {
    [playerKey]: { name: "", choice: null, score: 0 },
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
