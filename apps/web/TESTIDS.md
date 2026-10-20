# Stable test hooks (`data-testid`)

Contract between the web app (A3) and the end-to-end tests (A5). These names do not change
without a note in `coordination/A3.md`. Values in `data-*` attributes are plain strings.

## Configurator (`/new`)

| testid | Element | Notes |
|---|---|---|
| `scale-preset-fibonacci` `scale-preset-modifiedFibonacci` `scale-preset-tshirt` `scale-preset-powersOf2` `scale-preset-linear` `scale-preset-custom` | `<label>` wrapping a radio | Click to choose. Fibonacci is the default. |
| `chip-input`, `chip-add`, `chip` (`data-value`) | Custom deck editor | Type `1,2,3,5,8` then `chip-add` (or Enter). |
| `wizard-next`, `wizard-back`, `wizard-create` | buttons | 4 steps: scale → task IDs → rules → review. `wizard-next` refuses to advance while the step has errors. |
| `setting-id-pattern`, `setting-link-template` | inputs | Step 2. |
| `setting-policy-ids` / `-links` / `-allowlist`, `setting-allowlist-input` | radios / input | Step 2. |
| `setting-expiry` | `<select>` | Values `1`, `2` (default), `4`, `8` hours. |
| `setting-timer` | `<select>` | Round timer default. |
| `setting-auto-reveal`, `setting-anonymous`, `setting-lobby`, `setting-spectators` | checkboxes | Step 3. |
| `setting-passcode` | input | Step 3. Never saved in presets. |
| `setting-max-participants` | number input | Step 3. |
| `preset-export`, `preset-import`, `preset-file` | buttons / hidden file input | Use `setInputFiles` on `preset-file`. |
| `create-demo` | button | Only shown when the server cannot be reached; creates an in-tab offline demo. |
| `join-link` | readonly input, value = full join URL | After create. |
| `admin-link` | readonly input, value = full host URL | After create. |
| `copy-join-link`, `copy-admin-link` | buttons | Text changes to "Copied". |
| `qr-code` | `<svg>` | Join link QR (also inside the room's Invite dialog). |
| `open-room` | link | Opens the **host** link. |

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
| `task-input` | textarea | Facilitators only. One task per line; Ctrl/Cmd+Enter submits. |
| `task-add` | button | |
| `task-item` | `<li>` per task, `data-key`, `data-final` | Visible to everyone. |
| `task-select`, `task-remove` | buttons inside `task-item` | Facilitators. |
| `current-task` | section, `data-key` | |
| `card` | button per deck card, `data-value`, `role="radio"`, `aria-checked` | Click again to withdraw the vote. Arrow keys move focus only; Space/Enter/click picks. |
| `vote-progress` | text "N of M voted" | During voting. |
| `participant` | row, `data-name`, `data-voted="true\|false"`, `data-role="voter\|spectator"` | Never shows vote values before reveal. |
| `btn-kick`, `btn-promote`, `btn-demote` | buttons inside `participant` | Shown directly in the row (no menu) to whoever may use them. |
| `btn-reveal` | button | Voting phase. |
| `btn-next` | button | Also "Start first task" / "Finish". |
| `btn-revote` | button | "Clear votes" while voting, "Vote again" after reveal. |
| `btn-timer-start`, `btn-timer-stop`, `timer` | buttons / timer | |
| `final-value` | buttons, `data-value`, `role="radio"`, `aria-checked` | After reveal; the suggested card is preselected. |
| `final-custom` | input | Free text (≤ 16) instead of a card. |
| `btn-final` | button | Saves the final estimate. |
| `reveal-results` | section | |
| `reveal-card` | item per vote, `data-name` (empty when anonymous), `data-value` | |
| `stat-median`, `stat-mode`, `stat-average`, `stat-range` | `<dd>` | Text values; ordinal decks show card labels. |
| `consensus` | `<p>`, `data-level="full\|near\|split\|none"` | `none` = no estimable votes. |
| `btn-export-csv`, `btn-export-json`, `btn-export-md` | buttons | Trigger a download (`backlogfit-YYYY-MM-DD-HHMM.ext`). |
| `btn-copy-summary`, `btn-print` | buttons | |
| `btn-invite` | button | Opens the Invite dialog (join link + QR). |
| `btn-lock` | button, `aria-pressed` | Facilitators. |
| `lobby-entry` (`data-name`), `lobby-approve`, `lobby-deny` | row / buttons | Facilitators. |
| `btn-extend` | button | Admin only, "+1 hour"; disabled at the hard maximum. |
| `btn-settings` | button | Admin only; dialog reuses `setting-auto-reveal`, `setting-anonymous`, `setting-spectators`, `setting-lobby`, `setting-timer`. |
| `btn-close-room` | button | Admin only. Opens a confirmation dialog… |
| `btn-close-confirm` | button | …which ends the session for everyone. |
| `btn-leave` | button | Leave voluntarily. |
| `room-closed` | section, `data-reason`, `data-error` | Reasons: `expired`, `idle`, `closed`, `kicked`, `not_found`, `denied`, `replaced`, `rejected`, `unreachable`, `left`. `data-error` carries the refusal code for `rejected` (e.g. `room_locked`, `passcode_locked`). Wrong passcode, spectators off and room full return to the join form with an alert instead. |
| `toast` | each toast | Inside an `aria-live` region. |
| `theme-switcher` | button in the header | Opens radios `theme-corporate`, `theme-colorful`, `mode-system`, `mode-light`, `mode-dark`, `mode-contrast`. |

## Offline demo

`/r?demo` (no fragment) creates an in-tab room with three simulated voters (Ada, Grace, Linus)
and three sample tasks, and opens it as host. Demo rooms do not survive a reload.

## Keyboard

`1`–`9` vote, `Space` reveal (facilitator, not while a control is focused), `N` next
(facilitator), `?` help. None fire inside inputs, selects, textareas or open dialogs.
