# ADR-0012: Teams, team invite links and per-task voters

- Status: Accepted
- Date: 2026-10-20

## Context

Sessions often mix roles: developers, testers, analysts, designers. Some backlog items should be
sized only by one of them (a test plan by QA), and on shared items the host wants to see whether
the groups disagree. Rooms without teams must behave exactly as before, and the privacy rules of
ADR-0003 and PROTOCOL.md §6 (no values before the reveal, no names in anonymous rounds) must hold.

## Decision

**Model.** `RoomConfig.teams` holds 0–6 teams `{ id, name }`. Names are 1–24 characters with the
same text hygiene as display names and are unique when compared as `#tags` (lower case, spaces
removed). Ids are short slugs made by the browser (`makeTeamId`), so a renamed team keeps its
links and tags. Each participant has `team: id | null`, each task `voters: id[] | null` (null =
everyone). The host edits the list with `admin.teams` (host only, like other settings). Removing a
team moves its people to no team and drops it from task voters; a task left without teams goes
back to everyone.

**Eligibility** is one function, `canEstimate(p, voters)`: role `voter`, and on a restricted task a
team in `voters`. The reducer rejects other votes with `not_eligible`, auto-reveal waits only for
connected eligible people, and after every event `pruneVotes` removes unrevealed votes whose
author is no longer eligible (moved to spectators, another team, task voters changed, team
removed) and keeps each vote's team current. So an ineligible person can never affect a round,
whatever the order of events (fast-check property h).

**Team hints are not authorization.** A team link is `#roomId.joinSecret@teamId`. The part after
`@` is outside the base64url alphabet, is not secret and grants nothing: `hello.team` only sets
the initial team, unknown ids are ignored (no error, so an old link still joins), resume keeps
the stored team, and a hint never changes role, authority, lobby or capacity decisions (property
i). People can also choose their own team with `team`. This is the same trust level as the role:
both are self-declared at join, and the host can correct either with `admin.participant`.
Team access control would need per-team secrets, which we chose not to build: the feature is
about organising the estimate, not about who may see the room.

**Join flow.** The room's team names are not known before `welcome` (nothing about a room is
revealed before the join secret is checked), so the team is chosen in a second step of the join
form: "Which team are you in?", with the link's team preselected and "No team" always allowed.
A team is never required; making it required would block people the host forgot to assign.

**Per-team results.** After the reveal, `RoundView.teams` holds per-group counts and medians
(`teamBreakdown`), never names. It is null when there are fewer than two groups or no vote from
a team. Revealed `VoteView.team` is null in anonymous rounds.

**Anonymous rounds and groups of one.** A group with one vote shows that person's vote, because
team membership is visible in the participant list. Hiding only that group is not enough: with the
overall distribution and the other groups' medians the missing vote can often be worked out by
subtraction. Decision: in an anonymous round the whole breakdown is withheld (`hidden: true`) as
soon as any group, including "no team", has a single vote; the reveal says so in plain words.
Groups of two or more can still show agreement inside a team (both voted 3); that is the same
exposure as a unanimous room and is accepted. Exports apply the same rule because they are built
from the projected view.

**Tags.** A pasted line may end with one or more `#team` tags (`SCP-1 Test plan #qa`). In rooms
with teams the reducer strips tags that name a team (by name, then by id) and uses them as the
task's voters; other `#words` stay in the title, and rooms without teams keep the line unchanged.
`admin.tasks.add.voters` applies to lines without a tag.

**Task-add replies.** `admin.tasks.add` may carry a `requestId`; the server answers the sender
with `tasks.added { requestId?, taskIds }`. The web uses it for "Add and estimate now" and for the
configurator handoff instead of diffing state snapshots.

**Shared rules.** `can()` and `nextTaskId()` moved to core (`rules.ts`) so clients offer exactly
what the reducer accepts. `admin.participant` uses `can(actor, 'manage', target)`: the host may
change anyone, a co-host only people without authority and themselves; promotion stays host only.

**Compatibility.** All additions are optional in input schemas. Rooms stored by an older build
get the new fields filled in by `normalizeRoomState` (host `readStoredState`). Presets are written
as version 2; version 1 files are still read.

## Consequences

- One more step when joining a room with teams; none without teams.
- Eligibility is computed in one place and enforced by the reducer, so clients cannot vote around
  it, but anyone can still claim a team. The host sees teams in the people list and can fix them.
- Anonymous rooms with small teams often show no team breakdown. That is intended.
- The exports of rooms with teams have extra columns; rooms without teams export as before.
