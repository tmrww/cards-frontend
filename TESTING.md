# Frontend tests

Run from `frontend/`:

```
npm test                      # run everything once (vitest run)
npm run test:watch            # watch mode
npx vitest run src/utils      # one folder
npx vitest run -t "wildcard"  # tests whose name matches
```

- Runner: Vitest 5 with jsdom and React Testing Library (`vitest.config.ts`, setup in `src/test/setup.ts`).
- Tests sit next to the code as `*.test.ts(x)`. Shared helpers: `src/test/factories.ts` (`card(id, suit, value)` and `makeView()`).
- Suit ids in tests: 0 ♠, 1 ♥, 2 ♦, 3 ♣, -1 small joker, -2 big joker. Value 1 is the Ace.
- **Every new test must be added to this file in the same change** (and to the changelog at the bottom).

Total: 15 files, 142 tests.

---

## `src/utils/cards.test.ts` (12)
| Test | Purpose | Expected |
| :--- | :--- | :--- |
| formats 1, 14, 11, 12, 13, 2, 10 (7 cases) | `formatStageRank` labels | A, A, J, Q, K, 2, 10 |
| maps the four suits and both jokers | `getSuitSymbol` | ♠ ♥ ♦ ♣, jokers ★ |
| returns an empty string for unknown suits | unknown suit id 99 | `""` |
| identifies jokers by negative suit ids | `isJokerCard` | -1/-2 true, spade false |
| colors hearts, diamonds and the big joker red | `isRedCard` | red for ♥ ♦ big joker; black for ♠ ♣ small joker |
| shows a mask for jokers and the rank otherwise | `getCardShortValue` | 🎭 for jokers, `K`, `A` otherwise |

## `src/utils/wsUrl.test.ts` (11)
| Test | Purpose | Expected |
| :--- | :--- | :--- |
| uses VITE_WS_URL verbatim when set | explicit URL wins | returns it unchanged |
| throws without a host | missing config | throws `VITE_WS_HOST` error |
| derives the protocol from the page protocol | http/https | `ws://h` / `wss://h` |
| falls back to VITE_HOST and VITE_PORT | legacy vars | `ws://h:9000` |
| prefers the WS-specific host and port variables | precedence | `ws://b:2` |
| includes a custom port and honors an explicit protocol | `VITE_WS_PROTOCOL` | `wss://h:8080` |
| omits the port for wss 443, ws 80, "none", "" (4 cases) | default/blank ports dropped | `proto//h` |
| keeps a default port of the other protocol | `ws:` + 443 | `ws://h:443` |

## `src/utils/sound.test.ts` (8)
Uses a fake `Audio`, fake timers and a fresh module per test (cooldown state is module-level).

| Test | Purpose | Expected |
| :--- | :--- | :--- |
| matches an exact key | `triggerTextSound("mi_bomba")` | plays `/sounds/mi_bomba.mp3`, returns true |
| matches a message written as spaced words with punctuation | "Well, Done!" | plays `well_done.wav` |
| matches a key inside a longer message, with spaces or underscores | "wow mi bomba is coming", "say well_done to him" | both play |
| is case-insensitive | "MI BOMBA" | true |
| ignores blank and unmatched messages | "   ", "hello there" | false, nothing plays |
| applies a per-sender cooldown | same sender twice, other sender, after 5s | false, true, true |
| plays a configured sound and ignores unknown keys | `playGameSound` | only known key plays |
| applies a cooldown per source and defaults the source to the sound key | same source repeated | second call per source suppressed |

## `src/games/registry.test.ts` (4)
| Test | Purpose | Expected |
| :--- | :--- | :--- |
| has unique ids, labels and a View for every module | registry integrity | no duplicates, all complete |
| registers guandan and the dev-only placeholder | expected modules | guandan not dev-only; placeholder dev-only |
| returns undefined for unknown or missing ids | lookup misses | `undefined` |
| hides dev-only games from the lobby unless requested, with guandan first | dropdown source | `[guandan]` / `[guandan, placeholder]` |

## `src/games/guandan/rules.test.ts` (25)
| Test | Purpose | Expected |
| :--- | :--- | :--- |
| isWildcard: only the heart of the current stage | wildcard detection | true for ♥ stage only |
| getCardRank: orders 2..K < Ace < stage < small joker < big joker | rank table | 13, 14, 15, 16, 17 |
| getCardRank: Ace stage is the stage card | stage = Ace | 15 |
| formatComboType returns readable labels | labels | "Full House (3+2)", "Four Jokers (Max Bomb)" |
| sortCardsLowToHigh: sorts by rank, stage cards then jokers last | default sort | three, king, ace, stage, small, big |
| sortCardsLowToHigh: wildcard right of other stage cards, then suit | tie-breaks | spade, club, wild |
| sortCardsLowToHigh: no mutation, empty hand | purity/edge | input untouched; `[]` |
| sortBombsToEnd: no bombs | plain sort | sorted, empty group map |
| sortBombsToEnd: empty hand | edge case | empty results |
| sortBombsToEnd: four of a kind to the end | bomb grouping | non-bombs first, bomb in group 0 |
| sortBombsToEnd: orders bombs by size then rank | bomb order | `ssssnnnnttttt` (4×7, 4×9, 5×3); groups 0, 1, 2 |
| sortBombsToEnd: five-card straight flush | straight flush | grouped, non-bomb first |
| sortBombsToEnd: ace-high and ace-low straight flush | wrap-around | both detected |
| sortBombsToEnd: wildcard not used in straight flush | wildcard exclusion | no group |
| sortBombsToEnd: four jokers strongest | joker bomb | jokers last, group index after 4×2 |
| sortBombsToEnd: three jokers is not a bomb | edge case | no group |
| isValidBombGroup: rejects groups smaller than four | size check | false |
| isValidBombGroup: accepts four or more of a kind | n-of-a-kind | true |
| isValidBombGroup: wildcard stands in for a natural | wildcard | true |
| isValidBombGroup: rejects mixed values and mixed jokers | invalid sets | false |
| isValidBombGroup: accepts exactly four jokers | joker bomb | true |
| isValidBombGroup: straight flush valid/broken/mixed suit | straight flush | true / false / false |
| getSeatIndex finds the seat or falls back to 0 | seat lookup | 2, 0, 0 |
| selectTeams orients stage and strikes to the viewer's team | team view | mine/opp swap by seat parity; defaults 2/0 for null view |
| didMyTeamWin compares the first player out's team | round result | true for same parity, false otherwise/no winner |

## `src/games/guandan/reconcileHand.test.ts` (16)
| Test | Purpose | Expected |
| :--- | :--- | :--- |
| isNewDeal: empty previous order | new deal | true |
| isNewDeal: server hand grew | new deal | true |
| isNewDeal: WAITING → PLAYING | new deal | true |
| isNewDeal: cards only removed | not a deal | false |
| reconcileHand: keeps custom order for survivors | order preserved | `c, a, b` |
| reconcileHand: drops cards the server no longer has | removal | `c, a` |
| reconcileHand: appends new cards after existing, sorted | additions | `b, a, e, d` |
| reconcileHand: played card removed in place | exact removal | no twin swap |
| reconcileHand: swaps identical twins | two-deck twin problem | played card's slot disappears, twin moves to the freed slot, `twinMap q→p` |
| reconcileHand: does not swap different suit/value | twin guard | no swap |
| reconcileHand: does not mutate its inputs | purity | inputs unchanged |
| reconcileBombGroups: empty map returned untouched | fast path | same Map instance |
| reconcileBombGroups: keeps groups still bombs | validation | unchanged |
| reconcileBombGroups: drops a broken group | validation | empty |
| reconcileBombGroups: ignores gone cards, keeps other groups | multi-group | only the intact group remains |
| reconcileBombGroups: carries a group over to the kept twin | twin remap | twin id in group, old id not |

## `src/hooks/useGameSocket.test.ts` (8)
| Test | Purpose | Expected |
| :--- | :--- | :--- |
| ROOM_CREATED / ROOM_JOINED (2 cases) | enter a room | roomId, gameType set; chat and error reset |
| ROOM_LEFT | server leave | back to initial state, room list kept |
| LEFT_LOCALLY | client leave | room cleared, error kept |
| ROOM_LIST | room list | stored |
| STATE_UPDATE | game view | opaque view and room id stored |
| CHAT_MESSAGE | chat | appended in order, unique ids |
| ERROR and SET_ERROR | errors | set and cleared |

## `src/hooks/useTurnPopup.test.ts` (8)
| Test | Purpose | Expected |
| :--- | :--- | :--- |
| hidden until my turn | initial state | hidden, no callback |
| shows and notifies on turn start, auto-hides after 5s | basic lifecycle | visible at 4999ms, hidden at 5000ms |
| speeds up on mouse move, halving remaining time | fast mode | 1s elapsed → hides 2s later |
| caps the fast duration at 2.5s | fast cap | hides at 2500ms |
| leave animation 200ms after click | dismiss | `leaving` then hidden at 200ms |
| ignores mouse movement while leaving | guard | `fast` stays false |
| hides immediately when the turn ends | turn end | hidden |
| shows again on the next turn | re-trigger | shown, callback twice |

## `src/hooks/useHandOrder.test.ts` (4)
| Test | Purpose | Expected |
| :--- | :--- | :--- |
| sets the order and keeps the ref in sync | state/ref | both updated |
| supports functional updates on the latest order | batching | `a, b` |
| moves a card from one index to another | drag reorder | `b, c, a, d` then `d, b, c, a` |
| toggles, clears and prunes the selection | selection | `a, c` → `a` → empty |

## `src/components/common/HandRow.test.tsx` (11)
| Test | Purpose | Expected |
| :--- | :--- | :--- |
| computeOverlap: 0 or 1 card | no overlap | 0 |
| computeOverlap: cards fit | default | -20 |
| computeOverlap: narrower rows overlap more, capped | scaling | -43, capped at -46 |
| computeOverlap: never less than 18 px once cards stop fitting | lower bound | -18 |
| renders one element per card with selection state | rendering | 3 cards, 2nd selected |
| shows the empty message | empty state | message visible |
| calls onToggle with the card id | click | `"c"` |
| calls onMove while dragging over another card | drag | `(0, 2)` |
| no onMove over itself or without a drag | guards | not called |
| applies decoration | class, style, title, badges | all applied |
| marks hearts/diamonds red, spades/clubs black | colors | classes set |

## `src/components/common/ChatPanel.test.tsx` (6)
| Test | Purpose | Expected |
| :--- | :--- | :--- |
| shows the empty state | no messages | "blub blub blub", count 0 |
| renders messages with senders | list | sender and text shown |
| sends a trimmed message and clears the input | submit | `onSend("hi there")`, input empty |
| disables Send and ignores blank messages | validation | disabled; no call |
| collapses and expands | toggle | messages hidden/shown |
| triggers a text sound only for newly arrived messages | sound | once per new message, not on mount |

## `src/components/common/TurnBanner.test.tsx` (3)
| Test | Purpose | Expected |
| :--- | :--- | :--- |
| renders nothing when hidden | hidden | empty |
| shows "Your Turn!" when visible | visible | text shown |
| adds fast and leaving classes | modifiers | classes present |

## `src/components/common/TableLayout.test.tsx` (9)
| Test | Purpose | Expected |
| :--- | :--- | :--- |
| seatsFor: viewer at the bottom for every size | placement | first seat `S`, offset 0 |
| seatsFor: 2 players | top/bottom | `S, N`; seats `[1, 0]` for viewer 1 |
| seatsFor: 3 players cw/ccw | triangle | `S, W, E` / `S, E, W` |
| seatsFor: 4 players clockwise | NESW | `S, W, N, E`; teammate offset 2 |
| seatsFor: ccw mirrors W and E | direction | `S, E, N, W` |
| seatsFor: unique seats wrapping around | invariants | unique for all n and viewers |
| seatsFor: unsupported counts | validation | throws `RangeError` for 1 and 5 |
| TableLayout renders each edge and the center | layout | content in the right regions |
| TableLayout leaves unused edges empty | layout | W and E empty |

## `src/components/BasicLobbyView.test.tsx` (8)
| Test | Purpose | Expected |
| :--- | :--- | :--- |
| lists registry games, defaulting to the first | dropdown | "Guan Dan" first, value `guandan` |
| hosts with the default game type | Host | `onCreateRoom("guandan")` |
| hosts with the selected game type | dropdown change | `onCreateRoom("placeholder")` |
| joins with an upper-cased, trimmed code | Join | `onJoinRoom("AB12")` |
| disables Join and Host without a name | validation | both disabled |
| disables Join until a code is entered | validation | Join disabled, Host enabled |
| shows connection status and errors | status | message, `lobby-error`, Host disabled |
| reports username edits | name input | `onPlayerNameChange("Bo")` |

## `src/App.test.tsx` (9)
Uses a fake `WebSocket` and `VITE_WS_URL=ws://test`.

| Test | Purpose | Expected |
| :--- | :--- | :--- |
| connects and asks for the room list | startup | URL used; `LIST_ROOMS` sent |
| creates a room with the selected game type and identity | host flow | `CREATE_ROOM` with `placeholder`, name, `P_…` id |
| renders the registered view for the room's game type | registry routing | placeholder view shows room and view JSON |
| shows a fallback with a leave button for an unknown game type | unknown game | message; Leave sends `LEAVE_ROOM`, lobby returns |
| returns to the lobby on ROOM_LEFT | server leave | lobby; `LIST_ROOMS` re-sent (2 total) |
| sends game actions in the generic GAME_ACTION envelope | action envelope | `{type:"GAME_ACTION", action:{type:"READY"}}` |
| sends chat messages with the room and player | chat | `SEND_MESSAGE` with room and text |
| shows server errors in the lobby | errors | text shown |
| keeps the player id using the legacy storage key | session migration | id `P_OLD01` reused and copied to the new key |

---

## Changelog
- Initial suite (Phase 0-5): all 142 tests above.

