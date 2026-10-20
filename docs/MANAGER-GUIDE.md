# Backlogfit Manager Guide

*One page for facilitators: Scrum Masters, team leads, product owners. Print-friendly.*

## What are story points?

A story point is a team's relative measure of how much effort a backlog item takes,
including complexity, uncertainty and the amount of work. It is not hours. A "2" is roughly
twice a "1"; a "13" is big and probably hides surprises. Because the whole team estimates
together and compares items with each other, story points are quick to give and, over a few
sprints, become a reliable basis for sprint planning.

Why vote with cards? Everyone picks an estimate privately and all cards are revealed at once.
That stops the first loud number from anchoring the others and quickly shows where people
understand an item differently, which is the most valuable outcome of the discussion.

![Voter view: the card deck, the current task and who has already voted](assets/screenshots/voter.png)

## Run a refinement session in 10 steps

1. **Prepare the list.** Before the meeting, pick 5 to 15 refined backlog items. Copy their IDs
   (with an optional title, for example `SCP-3655 Fix login`) from your tracker, one per line.
2. **Start a session and pick a scale.** Open Backlogfit and choose **Start a session**. Pick a
   deck: Fibonacci is a good default, T-shirt sizes suit rough roadmap sizing.
3. **Set task identifiers and session rules.** Choose how tasks may appear (IDs only, any links,
   or only your own tracker domains), the session length, timer, automatic reveal, anonymous
   results, spectators, approval before joining, and an optional passcode. Review and press
   **Create session**. You can save these settings as a preset file for next time.
4. **Keep the host link.** Backlogfit shows it once. Keep it private: it gives full control of the
   session and lets you switch devices.
5. **Share the join link.** Paste it in the meeting chat or show the QR code. People enter a
   display name and join as voters or spectators. Then **Open the room**.
6. **Add the tasks and introduce the first item.** Paste the lines from step 1 into **Add tasks**.
   The product owner explains the first item in two minutes; optionally start the timer.
7. **Vote.** Everyone picks a card. You see *who* has voted, never *what*, until the reveal.
8. **Reveal.** Press **Reveal votes** (or let automatic reveal do it when everyone has voted).
   Look at the distribution, median and agreement indicator.
9. **Discuss and vote again if needed.** If votes are split, ask the highest and lowest voters to
   explain, then press **Vote again**; earlier rounds stay in the results.
10. **Record the final estimate and move on.** Pick the final value (the suggestion is
    preselected), press **Next task**, and at the end download the results as CSV, JSON or
    Markdown, copy the summary, or print. Press **End session** when you are done; all its data is deleted.

| Step 1: scale | Step 2: task identifiers |
|---|---|
| ![Configurator step 1: choosing the Fibonacci deck with a live card preview](assets/screenshots/configurator-step-1.png) | ![Configurator step 2: task ID format, tracker link and link policy](assets/screenshots/configurator-step-2.png) |

| Step 3: session rules | Step 4: review |
|---|---|
| ![Configurator step 3: session length, timer, reveal, spectators, approval and passcode](assets/screenshots/configurator-step-3.png) | ![Configurator step 4: summary of the settings before creating the session](assets/screenshots/configurator-step-4.png) |

![Session ready: join link, private host link and QR code](assets/screenshots/configurator-created.png)

![Host view while voting: Reveal votes, Clear votes, Next task, timer, people who voted and the task list](assets/screenshots/admin-voting.png)

![Voter view after the reveal: median, distribution, agreement and the results table](assets/screenshots/reveal.png)

![Host view after the reveal: Vote again, Next task and the final estimate picker](assets/screenshots/admin-reveal.png)

![Host view with a final estimate recorded, the results table, downloads and session controls (invite, lock, add an hour, settings, end session)](assets/screenshots/results-full.png)

## Tips

- **Anchoring.** Do not say your own estimate before the reveal, and ask the product owner not
  to hint at a "hoped-for" number. Reveal all cards at once.
- **Reference items.** Keep two or three finished items as anchors ("this login change was a
  3") and compare new items with them, not with hours.
- **Coffee card.** If someone plays the coffee card, take a five-minute break. Tired teams
  estimate badly.
- **`?` card.** It means "I don't understand the item yet". Clarify before re-voting; do not
  pressure people to pick a number.
- **Splitting `∞` and very large items.** An `∞` or a vote above 13 (or XL) usually means the
  item is too big or too vague. Split it into smaller stories during the session or send it
  back for refinement instead of forcing a number.
- **Timeboxing.** Aim for about 5 minutes per item. Use the timer; if the second round is still
  split, take the higher estimate or park the item.
- **Re-vote etiquette.** Vote again only after new information has been shared. Do not vote again just
  to reach unanimity; "near" consensus (adjacent values) is usually good enough.
- **Anonymous reveal.** Turn it on for new or hierarchical teams so that nobody feels exposed
  by an outlier vote.
- **Managers in the room.** If you are the team's manager, consider joining as a spectator.
  Estimates are the team's commitment, not a target.

## FAQ for managers

**Can I compare story points between teams?** No. Each team's scale is its own. Use points for
planning within a team, not as a performance metric.

**Can I convert points to hours or days?** Avoid it. Use the team's velocity (points finished
per sprint) to forecast instead.

**Is it safe to use with confidential backlog items?** Rooms need no accounts, store nothing
after they close, and never send votes to anyone before the reveal. For the strictest settings,
use the IDs-only link policy or your company's self-hosted instance.

**Who sees the votes?** Before the reveal: nobody except the voter. After the reveal: everyone
in the room, or only the distribution if anonymous reveal is on.

**What if I lose the host link?** It cannot be recovered (the server only stores a hash).
Create a new room; it takes a minute.

**How long can a session run?** Up to the lifetime you chose (default 2 hours, maximum 8);
extend it from the facilitator menu. Rooms close after 30 minutes without activity.

More answers: [FAQ](FAQ.md).
