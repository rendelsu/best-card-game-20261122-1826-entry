// The screenshot scenes behind ?shot=start|play|win|loss. Each one plays the real rules
// forward from a fresh duel for a fixed number of turns, steered by the same AI that
// plays the live rival (aggressive for the winning seat, passive for the losing one), so
// every frame is what a short game really looks like and the same seed always gives the
// same frame. The win and loss scenes end on a real attack that takes the last life.
import { PHASE_OVER, PHASE_PLAY, PHASE_TITLE, attack, endTurn, playCard, startMatch } from './state.js';
import { applyAction, nextAction } from './ai.js';

const PLAY_TURNS = 7;
const MAX_TURNS = 60;
const MAX_ACTIONS_PER_TURN = 50;

/** Play one whole turn for `sideName` with the named AI style, then pass. */
function playTurn(game, sideName, style) {
  for (let count = 0; count < MAX_ACTIONS_PER_TURN; count += 1) {
    if (game.phase !== PHASE_PLAY) return;
    const action = nextAction(game, sideName, style);
    if (action.type === 'end') break;
    applyAction(game, sideName, action);
  }
  if (game.phase === PHASE_PLAY) endTurn(game);
}

/** Play full rounds (both seats) until `stop` says the scene is ready, or the cap hits. */
function playRounds(game, playerStyle, enemyStyle, stop) {
  for (let round = 0; round < MAX_TURNS; round += 1) {
    if (game.phase !== PHASE_PLAY || stop(game)) return;
    playTurn(game, 'player', playerStyle);
    if (game.phase !== PHASE_PLAY || stop(game)) return;
    playTurn(game, 'enemy', enemyStyle);
  }
}

/**
 * Set `game` to the named scene (start, play, win or loss; any other name is start) and
 * return the screen to draw over it.
 */
export function stageShot(name, game) {
  if (name !== 'play' && name !== 'win' && name !== 'loss') {
    game.phase = PHASE_TITLE;
    return { screen: PHASE_TITLE };
  }
  startMatch(game);
  if (name === 'play') {
    playRounds(
      game,
      'aggressive',
      'balanced',
      (state) =>
        state.turnNumber >= PLAY_TURNS &&
        state.player.board.length >= 2 &&
        state.enemy.board.length >= 1 &&
        state.player.hand.length >= 2,
    );
    return { screen: PHASE_PLAY };
  }
  if (name === 'win') {
    playRounds(game, 'aggressive', 'passive', (state) => state.phase === PHASE_OVER);
    if (game.phase !== PHASE_OVER) {
      // The aggressive seat should have won by now; leave the rival one blow from dead
      // and land it with a real attack so the frame is still a played game.
      game.enemy.life = 1;
      const ready = game.player.board.find((creature) => creature.canAttack);
      if (ready) attack(game, 'player', ready.uid, { kind: 'hero', side: 'enemy' });
    }
    return { screen: PHASE_OVER };
  }
  playRounds(game, 'passive', 'aggressive', (state) => state.phase === PHASE_OVER);
  if (game.phase !== PHASE_OVER) {
    game.player.life = 1;
    const ready = game.enemy.board.find((creature) => creature.canAttack);
    if (ready) attack(game, 'enemy', ready.uid, { kind: 'hero', side: 'player' });
  }
  return { screen: PHASE_OVER };
}
