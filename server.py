import os
import random
import string
import threading

from flask import Flask, render_template, request
from flask_socketio import SocketIO, join_room, emit

app = Flask(__name__)
app.config["SECRET_KEY"] = os.getenv(
    "SECRET_KEY",
    "tictactoe-secret-key"
)

socketio = SocketIO(
    app,
    cors_allowed_origins="*",
    async_mode="threading"
)

rooms = {}

game_lock = threading.Lock()


def generate_room_code():
    while True:
        code = "".join(
            random.choices(
                string.ascii_uppercase,
                k=6
            )
        )

        if code not in rooms:
            return code


def check_winner(board):
    winning_combinations = [

        [0,1,2],
        [3,4,5],
        [6,7,8],

        [0,3,6],
        [1,4,7],
        [2,5,8],

        [0,4,8],
        [2,4,6]
    ]

    for combo in winning_combinations:

        a,b,c = combo

        if (
            board[a] is not None and
            board[a] == board[b] == board[c]
        ):
            return board[a], combo

    return None, []


def check_tie(board):
    return all(cell is not None for cell in board)

@app.route("/")
def index():
    return render_template("index.html")


@socketio.on("create_room")
def on_create_room(data=None):

    player_name = "Player"

    if isinstance(data, dict):
        player_name = data.get("player_name", "").strip()

        if not player_name:
            player_name = "Player"

    code = generate_room_code()

    rooms[code] = {

        "players": {
            request.sid: "X"
        },

        "player_names": {
            request.sid: player_name
        },

        "scores": {
            "X": 0,
            "O": 0
        },

        "play_again_votes": set(),

        "board": [None] * 9,

        "current_turn": "X",

        "game_over": False
    }

    join_room(code)

    emit(
        "room_created",
        {
            "room": code,
            "symbol": "X",
            "player_name": player_name,
            "scores": rooms[code]["scores"]
        }
    )


@socketio.on("join_room_request")
def on_join_room(data):

    if not isinstance(data, dict):
        emit("error", {"message": "Invalid request."})
        return

    code = data.get("room", "").strip().upper()
    player_name = data.get("player_name", "").strip()

    if not code:
        emit("error", {"message": "Room code is required."})
        return

    if code not in rooms:
        emit("error", {"message": "Room not found."})
        return

    room = rooms[code]

    if len(room["players"]) >= 2:
        emit("error", {"message": "Room is full."})
        return

    if not player_name:
        player_name = "Player"

    room["players"][request.sid] = "O"
    room["player_names"][request.sid] = player_name

    join_room(code)

    host_sid = None

    for sid, symbol in room["players"].items():
        if symbol == "X":
            host_sid = sid
            break

    host_name = room["player_names"].get(host_sid, "Player")

    emit(
        "room_joined",
        {
            "room": code,
            "symbol": "O",
            "player_name": player_name,
            "opponent_name": host_name,
            "scores": room["scores"]
        }
    )

    players = {
        "X": host_name,
        "O": player_name
    }

    emit(
        "game_start",
        {
            "board": room["board"],
            "current_turn": room["current_turn"],
            "players": players,
            "scores": room["scores"]
        },
        to=code
    )


@socketio.on("make_move")
def on_make_move(data):

    if not isinstance(data, dict):
        emit("error", {"message": "Invalid move data."})
        return

    code = data.get("room", "").strip().upper()
    index = data.get("index")

    if code not in rooms:
        emit("error", {"message": "Room not found."})
        return

    if not isinstance(index, int) or index < 0 or index > 8:
        emit("error", {"message": "Invalid move index."})
        return

    room = rooms[code]

    if request.sid not in room["players"]:
        emit("error", {"message": "You are not in this room."})
        return

    # Server determines the symbol — never trust the client
    my_symbol = room["players"][request.sid]

    if room["game_over"]:
        emit("error", {"message": "Game is already over."})
        return

    if len(room["players"]) < 2:
        emit("error", {"message": "Waiting for opponent."})
        return

    if room["current_turn"] != my_symbol:
        emit("error", {"message": "Not your turn."})
        return

    if room["board"][index] is not None:
        emit("error", {"message": "Cell already taken."})
        return

    with game_lock:
        room["board"][index] = my_symbol

        winner, winning_combo = check_winner(room["board"])

        if winner:
            room["scores"][winner] += 1
            room["game_over"] = True
            emit(
                "game_update",
                {
                    "board": room["board"],
                    "current_turn": room["current_turn"],
                    "scores": room["scores"],
                    "result": "win",
                    "winner": winner,
                    "winning_combo": winning_combo
                },
                to=code
            )
        elif check_tie(room["board"]):
            room["game_over"] = True
            emit(
                "game_update",
                {
                    "board": room["board"],
                    "current_turn": room["current_turn"],
                    "scores": room["scores"],
                    "result": "tie"
                },
                to=code
            )
        else:
            room["current_turn"] = "O" if my_symbol == "X" else "X"
            emit(
                "game_update",
                {
                    "board": room["board"],
                    "current_turn": room["current_turn"],
                    "scores": room["scores"],
                    "result": None
                },
                to=code
            )


@socketio.on("play_again_request")
def on_play_again(data):

    if not isinstance(data, dict):
        emit("error", {"message": "Invalid request."})
        return

    code = data.get("room", "").strip().upper()

    if code not in rooms:
        emit("error", {"message": "Room not found."})
        return

    room = rooms[code]

    if request.sid not in room["players"]:
        emit("error", {"message": "You are not in this room."})
        return

    if not room["game_over"]:
        emit("error", {"message": "Game is not over yet."})
        return

    if len(room["players"]) < 2:
        emit("error", {"message": "Opponent has left."})
        return

    with game_lock:
        room["play_again_votes"].add(request.sid)

        my_symbol = room["players"][request.sid]

        # Determine which SIDs map to X and O
        x_sid = next((s for s, sym in room["players"].items() if sym == "X"), None)
        o_sid = next((s for s, sym in room["players"].items() if sym == "O"), None)

        ready_x = x_sid in room["play_again_votes"]
        ready_o = o_sid in room["play_again_votes"]

        if ready_x and ready_o:
            # Both agreed — reset the round
            room["board"] = [None] * 9
            room["current_turn"] = "X"
            room["game_over"] = False
            room["play_again_votes"] = set()

            players = {
                "X": room["player_names"].get(x_sid, "Player"),
                "O": room["player_names"].get(o_sid, "Player")
            }

            emit(
                "game_start",
                {
                    "board": room["board"],
                    "current_turn": room["current_turn"],
                    "players": players,
                    "scores": room["scores"]
                },
                to=code
            )
        else:
            emit(
                "player_ready",
                {
                    "symbol": my_symbol,
                    "ready_x": ready_x,
                    "ready_o": ready_o
                },
                to=code
            )


@socketio.on("disconnect")
def on_disconnect():

    sid = request.sid
    room_code = None

    # Find which room this player was in
    for code, room in list(rooms.items()):
        if sid in room["players"]:
            room_code = code
            break

    if room_code is None:
        return

    room = rooms[room_code]

    with game_lock:
        room["players"].pop(sid, None)
        room["player_names"].pop(sid, None)
        room["game_over"] = True

        if not room["players"]:
            # No players left — clean up the room entirely
            del rooms[room_code]
            return

    # Notify the remaining player
    emit("opponent_left", {}, to=room_code)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5001))
    socketio.run(app, host="0.0.0.0", port=port, debug=False)
