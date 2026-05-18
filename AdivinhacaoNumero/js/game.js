export function isValidGuess(value) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 1 && number <= 100;
}

export function compareGuesses(secret, guess1, guess2) {
  const player1Correct = guess1 === secret;
  const player2Correct = guess2 === secret;
  if (player1Correct && player2Correct) {
    return { result: 'tie', hint: 'Empate! Gerando novo número...', winner: 'tie' };
  }
  if (player1Correct) {
    return { result: 'player1', hint: null, winner: 'player1' };
  }
  if (player2Correct) {
    return { result: 'player2', hint: null, winner: 'player2' };
  }
  const minGuess = Math.min(guess1, guess2);
  const maxGuess = Math.max(guess1, guess2);
  if (secret > maxGuess) {
    return { result: null, hint: 'O número é maior', winner: null };
  }
  if (secret < minGuess) {
    return { result: null, hint: 'O número é menor', winner: null };
  }
  return { result: null, hint: secret > guess1 || secret > guess2 ? 'O número é maior' : 'O número é menor', winner: null };
}

export function evaluateSoloGuess(secret, guess) {
  if (guess === secret) {
    return { correct: true, hint: null };
  }
  return { correct: false, hint: guess < secret ? 'O número é maior' : 'O número é menor' };
}
