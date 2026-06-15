
let boardState = Array(9).fill('');
let currentPlayer = 'X'; 
let gameOver      = false; 

const score = { X: 0, O: 0, draws: 0 };

const WIN_PATTERNS = [
  [0, 1, 2], // top row
  [3, 4, 5], // middle row
  [6, 7, 8], // bottom row
  [0, 3, 6], // left column
  [1, 4, 7], // middle column
  [2, 5, 8], // right column
  [0, 4, 8], // diagonal ↘
  [2, 4, 6], // diagonal ↙
];

// ─── 5. DOM REFERENCES ───────────────────────────────
// Queried once at startup — cheaper than querying on
// every click.
const boardEl      = document.getElementById('board');
const cells        = document.querySelectorAll('.cell');   // NodeList of 9 cells
const statusText   = document.getElementById('status-text');
const statusBanner = document.getElementById('status-banner');
const winsXEl      = document.getElementById('wins-x');
const winsOEl      = document.getElementById('wins-o');
const drawsEl      = document.getElementById('draws');
const scoreXCard   = document.getElementById('score-x');
const scoreOCard   = document.getElementById('score-o');
const btnReset     = document.getElementById('btn-reset');

// ─── 6. CLICK HANDLER (attached to every cell) ──────
// Using event delegation on the board means one
// listener handles all 9 cells instead of 9 separate
// listeners — cleaner and easier to remove/reset.

boardEl.addEventListener('click', function (event) {
  const cell = event.target.closest('.cell');  // handle clicks on child elements too

  // Guard: ignore clicks outside cells, on taken cells, or after game ends
  if (!cell) return;
  if (gameOver) return;

  const index = parseInt(cell.dataset.index, 10);

  if (boardState[index] !== '') return;   // cell already occupied → bail

  // ── Place the current player's mark ──
  boardState[index] = currentPlayer;
  cell.textContent  = currentPlayer;
  cell.classList.add(currentPlayer.toLowerCase(), 'taken');

  // ── Check for a win ──
  const winResult = getWinner();

  if (winResult) {
    handleWin(winResult);
  } else if (boardState.every(cell => cell !== '')) {
    // All 9 cells filled and no winner → draw
    handleDraw();
  } else {
    // Game continues — switch turns
    switchTurn();
  }
});

// ─── 7. WINNER DETECTION ────────────────────────────
// Loops through every winning pattern and checks if
// all three cells hold the same non-empty value.
// Returns { player, line } on a win, or null otherwise.

function getWinner() {
  for (const pattern of WIN_PATTERNS) {
    const [a, b, c] = pattern;

    if (
      boardState[a] !== '' &&
      boardState[a] === boardState[b] &&
      boardState[b] === boardState[c]
    ) {
      return { player: boardState[a], line: pattern };
    }
  }
  return null;   // no winner yet
}

// ─── 8. HANDLE WIN ───────────────────────────────────
function handleWin({ player, line }) {
  gameOver = true;
  boardEl.classList.add('board-locked');  // CSS disables hover on remaining cells

  // Highlight the three winning cells
  line.forEach(index => {
    cells[index].classList.add('winning');
  });

  // Update status banner
  statusText.textContent = `Player ${player} wins! 🎉`;
  statusBanner.className = `status-banner winner-${player.toLowerCase()}`;

  // Update score
  score[player]++;
  refreshScoreboard();
}

// ─── 9. HANDLE DRAW ──────────────────────────────────
function handleDraw() {
  gameOver = true;
  boardEl.classList.add('board-locked');

  statusText.textContent = "It's a draw! 🤝";
  statusBanner.className = 'status-banner draw';

  score.draws++;
  refreshScoreboard();
}

// ─── 10. SWITCH TURNS ────────────────────────────────
// Flips currentPlayer between 'X' and 'O', then
// updates the status text and score-card highlights.

function switchTurn() {
  currentPlayer = (currentPlayer === 'X') ? 'O' : 'X';
  statusText.textContent = `Player ${currentPlayer}'s Turn`;
  statusBanner.className = 'status-banner';   // reset any result styling

  highlightActiveScoreCard();
}

// ─── 11. SCORE-CARD HIGHLIGHT ────────────────────────
// Visually emphasises which player is currently active.

function highlightActiveScoreCard() {
  scoreXCard.classList.toggle('active-x', currentPlayer === 'X');
  scoreOCard.classList.toggle('active-o', currentPlayer === 'O');
}

// ─── 12. SCOREBOARD UPDATE ───────────────────────────
function refreshScoreboard() {
  winsXEl.textContent = score.X;
  winsOEl.textContent = score.O;
  drawsEl.textContent  = score.draws;
}

// ─── 13. RESET / NEW GAME ────────────────────────────
// Resets board state and DOM, but preserves the score.

btnReset.addEventListener('click', resetGame);

function resetGame() {
  // Clear state
  boardState    = Array(9).fill('');
  currentPlayer = 'X';
  gameOver      = false;

  // Reset every cell's appearance
  cells.forEach(cell => {
    cell.textContent = '';
    cell.className   = 'cell';   // removes x / o / taken / winning classes
  });

  // Unlock the board
  boardEl.classList.remove('board-locked');

  // Reset status
  statusText.textContent = `Player ${currentPlayer}'s Turn`;
  statusBanner.className = 'status-banner';

  // Reset score-card highlights so X is active again
  highlightActiveScoreCard();
}

// ─── 14. INITIALISE ──────────────────────────────────
// Kick things off by marking X as the starting player.
highlightActiveScoreCard();