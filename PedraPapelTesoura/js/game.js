const choices = ["rock", "paper", "scissors"];

export function getOptionLabel(option) {
  if (option === "rock") return "Pedra";
  if (option === "paper") return "Papel";
  if (option === "scissors") return "Tesoura";
  return "?";
}

export function computeRound(player1Choice, player2Choice) {
  if (!player1Choice || !player2Choice) {
    return { result: "waiting", text: "Aguardando escolhas..." };
  }
  if (player1Choice === player2Choice) {
    return { result: "draw", text: "EMPATE" };
  }
  const rules = {
    rock: "scissors",
    paper: "rock",
    scissors: "paper"
  };
  const winner = rules[player1Choice] === player2Choice ? "player1" : "player2";
  return {
    result: winner,
    text: winner === "player1" ? "VITÓRIA" : "DERROTA"
  };
}

export function randomChoice() {
  const index = Math.floor(Math.random() * choices.length);
  return choices[index];
}

export function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
