/**
 * Tic-Tac-Toe Multiplayer Client
 * 
 * Features:
 * - Player name input and validation
 * - Real-time game board updates
 * - Live scoreboard tracking
 * - Mutual play-again confirmation
 * - Comprehensive error handling
 * - Responsive UI with smooth animations
 */

(function () {
  "use strict";

  const socket = io();

  // =========================================================================
  // STATE MANAGEMENT
  // =========================================================================

  let state = {
    mySymbol: null,
    myRoom: null,
    myName: null,
    opponentName: null,
    boardState: Array(9).fill(null),
    currentTurn: "X",
    gameOver: false,
    scores: {
      X: 0,
      O: 0,
    },
    playAgainRequested: false,
    opponentPlayAgainRequested: false,
  };

  // =========================================================================
  // UI UTILITY FUNCTIONS
  // =========================================================================

  /**
   * Show the specified screen and hide all others.
   * @param {string} id - The ID of the screen to show
   */
  function showScreen(id) {
    document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
    document.getElementById(id).classList.add("active");
  }

  /**
   * Display a temporary toast notification.
   * @param {string} msg - The message to display
   * @param {string} type - The message type: "info", "success", or "error"
   */
  function showToast(msg, type = "info") {
    const t = document.getElementById("toast");
    t.textContent = msg;
    t.className = `toast ${type}`;
    t.classList.add("show");
    setTimeout(() => t.classList.remove("show"), 2500);
  }

  /**
   * Display error message in the lobby.
   * @param {string} msg - The error message
   */
  function showLobbyError(msg) {
    document.getElementById("lobby-error").textContent = msg;
  }

  /**
   * Clear error messages from the lobby.
   */
  function clearLobbyError() {
    document.getElementById("lobby-error").textContent = "";
  }

  /**
   * Update the scoreboard display.
   */
  function updateScoreboard() {
    document.getElementById("score-x").textContent = state.scores.X;
    document.getElementById("score-o").textContent = state.scores.O;
  }

  // =========================================================================
  // GAME BOARD RENDERING
  // =========================================================================

  /**
   * Render the game board based on current state.
   * @param {Array} board - The board state
   * @param {Array} winningCombo - The winning combination indices (if any)
   */
  function renderBoard(board, winningCombo = []) {
    const container = document.getElementById("board");
    container.innerHTML = "";
    
    // Determine if the board is frozen (not the player's turn or game over)
    const frozen = state.currentTurn !== state.mySymbol || state.gameOver;

    board.forEach((cell, i) => {
      const div = document.createElement("div");
      div.className = "cell";
      div.dataset.index = i;

      // Set cell content and classes
      if (cell === "X") {
        div.textContent = "✕";
        div.classList.add("x-mark", "taken");
      } else if (cell === "O") {
        div.textContent = "◯";
        div.classList.add("o-mark", "taken");
      } else if (frozen) {
        div.classList.add("frozen");
      }

      // Highlight winning combination
      if (winningCombo && winningCombo.includes(i) && cell) {
        div.classList.add("winning");
      }

      // Attach click handler for valid moves
      div.addEventListener("click", function () {
        if (div.classList.contains("taken") || div.classList.contains("frozen") || state.gameOver) {
          return;
        }
        if (state.currentTurn !== state.mySymbol) {
          showToast("Not your turn!", "error");
          return;
        }
        
        // Send move to server
        socket.emit("make_move", {
          room: state.myRoom,
          index: i,
          symbol: state.mySymbol,
        });
      });

      container.appendChild(div);
    });
  }

  /**
   * Update the turn indicator UI.
   */
  function updateTurnUI() {
    document.getElementById("badge-x").classList.toggle("active", state.currentTurn === "X");
    document.getElementById("badge-o").classList.toggle("active", state.currentTurn === "O");
    
    const turnText = document.getElementById("turn-text");
    if (state.gameOver) {
      turnText.textContent = "";
    } else if (state.currentTurn === state.mySymbol) {
      turnText.textContent = "Your turn";
    } else {
      turnText.textContent = "Opponent's turn";
    }
  }

  /**
   * Set player labels based on current player.
   */
  function setPlayerLabels() {
    const labelX = document.getElementById("label-x");
    const labelO = document.getElementById("label-o");
    
    if (state.mySymbol === "X") {
      labelX.textContent = `You (${state.myName})`;
      labelO.textContent = state.opponentName || "Opponent";
    } else {
      labelX.textContent = state.opponentName || "Opponent";
      labelO.textContent = `You (${state.myName})`;
    }
  }

  /**
   * Update the play-again button UI based on ready states.
   */
  function updatePlayAgainUI() {
    const btn = document.getElementById("play-again-btn");
    const statusDiv = document.getElementById("play-again-status");

    if (!state.gameOver) {
      btn.style.display = "none";
      statusDiv.style.display = "none";
      return;
    }

    btn.style.display = "block";

    // Show ready status
    if (state.playAgainRequested && state.opponentPlayAgainRequested) {
      statusDiv.style.display = "none";
    } else if (state.playAgainRequested) {
      statusDiv.style.display = "block";
      statusDiv.textContent = "Waiting for opponent...";
      statusDiv.className = "play-again-status waiting";
    } else {
      statusDiv.style.display = "none";
    }
  }

  /**
   * Reset play-again states when starting a new game.
   */
  function resetPlayAgainStates() {
    state.playAgainRequested = false;
    state.opponentPlayAgainRequested = false;
    updatePlayAgainUI();
  }

  // =========================================================================
  // INPUT VALIDATION
  // =========================================================================

  /**
   * Validate player name.
   * @param {string} name - The name to validate
   * @returns {Object} { valid: boolean, error: string }
   */
  function validatePlayerName(name) {
    const trimmed = name.trim();
    
    if (!trimmed) {
      return { valid: false, error: "Player name is required." };
    }
    
    if (trimmed.length > 20) {
      return { valid: false, error: "Player name must be 20 characters or less." };
    }
    
    if (trimmed.length < 1) {
      return { valid: false, error: "Player name is too short." };
    }
    
    return { valid: true, error: null };
  }

  /**
   * Validate room code.
   * @param {string} code - The room code to validate
   * @returns {Object} { valid: boolean, error: string }
   */
  function validateRoomCode(code) {
    const trimmed = code.trim().toUpperCase();
    
    if (!trimmed) {
      return { valid: false, error: "Please enter a room code." };
    }
    
    if (trimmed.length !== 6) {
      return { valid: false, error: "Room code must be exactly 6 characters." };
    }
    
    if (!/^[A-Z0-9]+$/.test(trimmed)) {
      return { valid: false, error: "Room code must contain only letters and numbers." };
    }
    
    return { valid: true, error: null };
  }

  // =========================================================================
  // BUTTON EVENT HANDLERS
  // =========================================================================

  /**
   * Handle create room button click.
   */
  document.getElementById("create-btn").addEventListener("click", function () {
    const nameInput = document.getElementById("player-name-input");
    const name = nameInput.value;
    
    const validation = validatePlayerName(name);
    if (!validation.valid) {
      showLobbyError(validation.error);
      return;
    }
    
    clearLobbyError();
    state.myName = name.trim();
    socket.emit("create_room", { player_name: state.myName });
  });

  /**
   * Handle join room button click.
   */
  document.getElementById("join-btn").addEventListener("click", function () {
    const nameInput = document.getElementById("player-name-input");
    const roomInput = document.getElementById("room-input");
    const name = nameInput.value;
    const code = roomInput.value;
    
    const nameValidation = validatePlayerName(name);
    if (!nameValidation.valid) {
      showLobbyError(nameValidation.error);
      return;
    }
    
    const roomValidation = validateRoomCode(code);
    if (!roomValidation.valid) {
      showLobbyError(roomValidation.error);
      return;
    }
    
    clearLobbyError();
    state.myName = name.trim();
    socket.emit("join_room_request", {
      room: code.toUpperCase(),
      player_name: state.myName,
    });
  });

  /**
   * Handle Enter key in room input.
   */
  document.getElementById("room-input").addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      document.getElementById("join-btn").click();
    }
  });

  /**
   * Handle Enter key in player name input.
   */
  document.getElementById("player-name-input").addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      // Check if join input has value
      const roomInput = document.getElementById("room-input");
      if (roomInput.value.trim()) {
        document.getElementById("join-btn").click();
      } else {
        document.getElementById("create-btn").click();
      }
    }
  });

  /**
   * Handle room code display click (copy to clipboard).
   */
  document.getElementById("waiting-code").addEventListener("click", function () {
    if (state.myRoom) {
      navigator.clipboard.writeText(state.myRoom).then(() => {
        showToast("Room code copied!", "success");
      });
    }
  });

  /**
   * Handle room code pill click (copy to clipboard).
   */
  document.getElementById("room-pill").addEventListener("click", function () {
    if (state.myRoom) {
      navigator.clipboard.writeText(state.myRoom).then(() => {
        showToast("Room code copied!", "success");
      });
    }
  });

  /**
   * Handle play again button click.
   */
  document.getElementById("play-again-btn").addEventListener("click", function () {
    if (!state.gameOver) return;
    
    state.playAgainRequested = true;
    updatePlayAgainUI();
    
    socket.emit("play_again_request", {
      room: state.myRoom,
      symbol: state.mySymbol,
    });
  });

  /**
   * Handle back to lobby button click (from disconnect modal).
   */
  document.getElementById("modal-home-btn").addEventListener("click", function () {
    document.getElementById("disconnect-modal").classList.remove("active");
    
    // Reset state
    state = {
      mySymbol: null,
      myRoom: null,
      myName: null,
      opponentName: null,
      boardState: Array(9).fill(null),
      currentTurn: "X",
      gameOver: false,
      scores: { X: 0, O: 0 },
      playAgainRequested: false,
      opponentPlayAgainRequested: false,
    };
    
    // Clear UI
    document.getElementById("room-input").value = "";
    document.getElementById("player-name-input").value = "";
    clearLobbyError();
    
    showScreen("lobby-screen");
  });

  // =========================================================================
  // LOGGER — defined first so it's available to all event handlers below
  // =========================================================================

  /**
   * Simple logger for debugging.
   */
  const logger = {
    info: (msg) => console.log(`[INFO] ${msg}`),
    warning: (msg) => console.warn(`[WARN] ${msg}`),
    error: (msg) => console.error(`[ERROR] ${msg}`),
  };

  // =========================================================================
  // SOCKET.IO EVENT HANDLERS
  // =========================================================================

  /**
   * Handle room creation confirmation.
   */
  socket.on("room_created", function (data) {
    state.myRoom = data.room;
    state.mySymbol = data.symbol;
    state.myName = data.player_name;
    state.scores = data.scores;
    
    document.getElementById("waiting-code").textContent = state.myRoom;
    document.getElementById("waiting-player-name").textContent = state.myName;
    
    showScreen("waiting-screen");
    showToast(`Room created! Share code: ${state.myRoom}`, "success");
  });

  /**
   * Handle successful room join.
   */
  socket.on("room_joined", function (data) {
    state.myRoom = data.room;
    state.mySymbol = data.symbol;
    state.myName = data.player_name;
    state.opponentName = data.opponent_name;
    state.scores = data.scores;
    
    showToast(`Joined room! Ready to play.`, "success");
  });

  /**
   * Handle error messages from server.
   */
  socket.on("error", function (data) {
    showLobbyError(data.message);
    logger.warning(`Error from server: ${data.message}`);
  });

  /**
   * Handle game start.
   */
  socket.on("game_start", function (data) {
    state.boardState = data.board;
    state.currentTurn = data.current_turn;
    state.gameOver = false;
    state.opponentName = data.players.O === state.myName ? data.players.X : data.players.O;
    state.scores = data.scores;
    
    resetPlayAgainStates();
    
    document.getElementById("play-again-btn").style.display = "none";
    document.getElementById("status-bar").textContent = "";
    document.getElementById("status-bar").className = "status-bar";
    document.getElementById("pill-code").textContent = state.myRoom;
    
    setPlayerLabels();
    updateScoreboard();
    renderBoard(state.boardState, []);
    updateTurnUI();
    
    showScreen("game-screen");
    showToast("Game started!", "success");
  });

  /**
   * Handle game updates (moves, results).
   */
  socket.on("game_update", function (data) {
    state.boardState = data.board;
    state.currentTurn = data.current_turn;
    state.scores = data.scores;
    
    const statusBar = document.getElementById("status-bar");
    const winningCombo = data.winning_combo || [];

    if (data.result === "win") {
      state.gameOver = true;
      const isMyWin = data.winner === state.mySymbol;
      statusBar.textContent = isMyWin ? "🎉 You won!" : "😢 Opponent wins!";
      statusBar.className = `status-bar ${isMyWin ? "win" : "loss"}`;
      renderBoard(state.boardState, winningCombo);
      showToast(isMyWin ? "You won!" : "You lost!", isMyWin ? "success" : "error");
    } else if (data.result === "tie") {
      state.gameOver = true;
      statusBar.textContent = "🤝 It's a draw!";
      statusBar.className = "status-bar tie";
      renderBoard(state.boardState, []);
      showToast("It's a draw!", "info");
    } else {
      renderBoard(state.boardState, []);
    }
    
    updateScoreboard();
    updateTurnUI();
    updatePlayAgainUI();
  });

  /**
   * Handle opponent ready status for play again.
   */
  socket.on("player_ready", function (data) {
    if (data.symbol === state.mySymbol) {
      state.playAgainRequested = true;
    } else {
      state.opponentPlayAgainRequested = data.symbol === "X" ? data.ready_x : data.ready_o;
    }
    updatePlayAgainUI();
  });

  /**
   * Handle opponent disconnection.
   */
  socket.on("opponent_left", function () {
    state.gameOver = true;
    document.getElementById("disconnect-modal").classList.add("active");
    showToast("Opponent disconnected!", "error");
  });

  /**
   * Handle socket connection.
   */
  socket.on("connect", function () {
    logger.info("Connected to server");
  });

  /**
   * Handle socket disconnection.
   */
  socket.on("disconnect", function () {
    logger.warning("Disconnected from server");
  });

})();