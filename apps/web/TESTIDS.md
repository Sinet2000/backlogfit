# Test hooks (`data-testid`)

The end-to-end tests find elements only through these `data-testid` values, so they stay stable
when the markup or the copy changes. Rename one only together with `tests/e2e`. Values in
`data-*` attributes are plain strings.

## Configurator (`/new`)

Four steps: estimation scale → tasks → session rules → review & create.

| testid | Element | Notes |
|---|---|---|
| `scale-preset-fibonacci` `scale-preset-modifiedFibonacci` `scale-preset-tshirt` `scale-preset-powersOf2` `scale-preset-linear` `scale-preset-custom` | `<label>` wrapping a radio | Fibonacci is the default. |
| `chip-input`, `chip-add`, `chip` (`data-value`), `chip-clear` | Custom deck editor | Type `1,2,3,5,8`, then `chip-add` or Enter. A focused chip moves with Alt+←/→ and is removed with Delete. |
| `wizard-next`, `wizard-back`, `wizard-create` | buttons | `wizard-next` refuses to advance while the step has errors. |
| `prepared-input` | textarea, step 2 | The task list itself: one task per line, parsed live. Nothing needs to be "added". |
| `prepared-item` | row per unique line | Invalid lines carry the class `invalid` and an error under the text. |
| `prepared-clear`, `prepared-remove-invalid` | buttons | Clearing or removing lines shows an Undo toast. |
| `prepared-edit`, `prepared-remove` | row menu items (`row-menu`) | `prepared-edit-input` is the inline editor (Enter saves, Esc cancels). |
| `prepared-shortened` | chip | Shown when a pasted link was reduced to its ID. |
| `setting-id-pattern`, `setting-link-template` | inputs | Step 2, inside "Task IDs and links". |
| `setting-policy-ids` / `-links` / `-allowlist`, `setting-allowlist-input` | radios / input | Step 2. |
| `setting-expiry` | `<select>` | Values `1`, `2` (default), `4`, `8` hours. |
| `setting-auto-reveal`, `setting-anonymous` | checkboxes | Step 3, always visible. |
| `rules-more` | `<details>` | "More options": `setting-lobby`, `setting-spectators`, `setting-passcode`, `setting-max-participants`, `setting-timer`, `setting-theme-corporate`, `setting-theme-colorful`. |
| `preset-import`, `preset-file` | link button / hidden file input | Step 1. Use `setInputFiles` on `preset-file`. |
| `preset-export` | button | Review step. The passcode is never written to the file. |
| `create-demo` | button | Only when the server cannot be reached; creates an in-tab offline demo. |
| `join-link`, `admin-link` | readonly inputs | After create; full join and host URLs. |
| `copy-join-link`, `copy-admin-link`, `save-admin-link` | buttons | Copy text changes to "Copied"; save downloads a `.txt`. |
| `prepared-note`, `copy-prepared` | note / button | Shown when tasks were prepared; the list is added when the room is opened in this tab. |
| `qr-code` | `<svg>` | Join link QR (also in the room's Invite dialog). |
| `open-room` | link | Opens the host link in the same tab. |

## Join (`/r#…`)

| testid | Element | Notes |
|---|---|---|
| `join-name` | input | Required, max 40. |
| `join-passcode` | password input | Always present (the client does not know whether one is needed). |
| `join-as-spectator` | checkbox | For the host it reads "I will only facilitate". |
| `join-submit` | submit button | |
| `lobby-waiting` | section | Shown while waiting for approval. |

## Room

| testid | Element | Notes |
|---|---|---|
| `app-home`, `leave-confirm` | header logo / dialog button | The logo asks "Leave this session?" before going home. |
| `room-status` | header text | "Task 2 of 5 · Ends at 14:30". |
| `btn-invite`, `btn-shortcuts`, `btn-leave` | header buttons | Invite is for the host and co-hosts. Leave sends `leave` to the server. |
| `empty-stage` | stage content | No current task. For hosts with no tasks it holds the add form. |
| `btn-next` | button in `empty-stage` | "Start estimating" / "Continue estimating". |
| `task-input`, `task-add`, `task-add-now` | add form | Hosts. Ctrl/Cmd+Enter adds, with Shift it also estimates the first new task. |
| `task-add-open` | button | Opens the add form in the Tasks panel once there are tasks. |
| `task-item` | row per task, `data-key`, `data-final` | Visible to everyone. |
| `task-select` | button inside `task-item` | Hosts. Estimate this task now. |
| `row-menu` | menu button inside a sortable row | Items `move-up`, `move-down`, `task-remove` (removal waits 5 s for Undo, `toast-action`). |
| `current-task` | section, `data-key` | |
| `voting-table` | list, one entry per voter with `data-voted` | Face-down cards; never shows values before the reveal. |
| `card` | button per deck card, `data-value`, `role="radio"`, `aria-checked` | Click again to withdraw the vote. Arrow keys move focus only. |
| `vote-progress` | text "N of M voted" | People panel, during voting. |
| `participant` | row, `data-name`, `data-voted`, `data-role` | |
| `participant-menu` | menu button in `participant` | Items `btn-promote`, `btn-demote`, `btn-kick` (confirmed with `btn-kick-confirm`). Only actions the viewer may use are listed. |
| `btn-reveal` | button | Voting phase. |
| `host-menu` | "More actions" menu | Voting: `btn-timer-start` / `btn-timer-stop`, `btn-revote`, `btn-skip`. Revealed: `btn-final` (save without moving on), `btn-skip`. |
| `btn-revote` | button | "Vote again" after the reveal (in `host-menu` while voting as "Restart round"). |
| `final-value` | radio, `data-value`, `aria-checked` | After the reveal; the suggested card is preselected. |
| `final-custom` | input | Free text (≤ 16) instead of a card. |
| `btn-save-next` | submit button | "Save 8 and continue": saves the final estimate and opens the next task. |
| `timer` | timer | |
| `reveal-results` | section | |
| `reveal-group` | one item per distinct value, `data-value` | Lowest first, stacked with a ×N count. |
| `reveal-card` | one entry per vote inside a group, `data-name` (empty when anonymous), `data-value` | |
| `stat-median`, `stat-average`, `stat-range`, `stat-mode` | text | `stat-mode` reads "No common vote" unless one value is the most common. Hidden on full agreement. |
| `consensus` | `<p>`, `data-level="full\|near\|split\|none"` | |
| `results` | section | Hosts always; others once a task has a final estimate. |
| `btn-export` | "Export" menu | Items `btn-export-csv`, `btn-export-md`, `btn-export-json`, `btn-copy-summary`, `btn-print`. Files are named `backlogfit-YYYY-MM-DD-HHMM.ext`. |
| `btn-extend` | button | Host only, "+1 hour"; disabled at the hard maximum. |
| `btn-settings` | button | Hosts and co-hosts. Opens the session settings dialog. |
| `btn-lock` | checkbox in the settings dialog | Hosts and co-hosts. |
| `setting-auto-reveal`, `setting-anonymous`, `setting-spectators`, `setting-lobby`, `setting-timer` | settings dialog | Host only (disabled for co-hosts). |
| `btn-close-room`, `btn-close-confirm` | settings dialog | Host only. Ends the session for everyone after confirmation. |
| `lobby-entry` (`data-name`), `lobby-approve`, `lobby-deny` | row / buttons | Hosts and co-hosts. |
| `reconnecting` | banner | Shown while the connection is being restored. |
| `room-closed` | section, `data-reason`, `data-error` | Reasons: `expired`, `idle`, `closed`, `kicked`, `not_found`, `denied`, `replaced`, `rejected`, `unreachable`, `left`, `invalid_link` (malformed link, never called "ended"). `data-error` carries the refusal code for `rejected`. |
| `toast`, `toast-action` | each toast / its action button | Inside an `aria-live` region. |
| `theme-switcher` | header button | Opens radios `theme-corporate`, `theme-colorful`, `mode-system`, `mode-light`, `mode-dark`, `mode-contrast`. |

## Offline demo

`/r?demo` (no fragment) creates an in-tab room with three simulated voters (Ada, Grace, Linus)
and three sample tasks, and opens it as host. Demo rooms do not survive a reload.

## Keyboard

`1`–`9` vote (the digits show under the cards while the deck has focus), `Space` reveal (host,
not while a control is focused), `N` next task (host), `?` help. None fire inside inputs,
selects, textareas or open dialogs.
