# Sound Effects Directory (`frontend/public/sounds/`)

Place audio files (e.g., `.mp3`, `.wav`, `.ogg`) in this directory and register them in `sounds.json`.
Vite serves files in `frontend/public/sounds/` at `/sounds/<filename>`.

## Structure of `sounds.json`

- **`gameSounds`**: Sound effects triggered automatically by game events in code:
  - `your_turn`: Played when it becomes the local player's turn.
  - `card_play`: Played when a normal card combination is played.
  - `bomb`: Played when a bomb (`FOUR_OF_A_KIND_BOMB`, `FIVE_PLUS_BOMB`, `STRAIGHT_FLUSH_BOMB`, or `JOKER_BOMB`) is played.
  - `pass`: Played when a player passes.
  - `round_win`: Played when a round finishes.
  - `game_win`: Played when the game ends (`ENDED`).
- **`textSounds`**: Sound effects triggered when a player types a matching word or phrase in the table chat (case-insensitive):
  - Example keys: `gg`, `hurry`, `nice`, `oops`, `blub`.

## Behavior

- **Single Active Sound (Cut Short)**: Any newly triggered sound immediately stops and resets the currently playing sound before playing.
- **5-Second Cooldown**: Sound triggers enforce a 5-second (`5000ms`) client-side cooldown per source/player.
