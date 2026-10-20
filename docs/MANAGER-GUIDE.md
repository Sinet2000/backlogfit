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

![Voting screen: cards at the bottom, participants who have voted are marked](assets/screenshots/voting.png)

## Run a refinement session in 10 steps

1. **Prepare the list.** Before the meeting, pick 5 to 15 refined backlog items. Copy their IDs
   or links from your tracker (one per line).
2. **Create a room.** Open Backlogfit and choose **New room**. Pick a deck (Fibonacci is a good
   default; T-shirt sizes for rough roadmap sizing), the room lifetime, and whether to use a
   lobby or passcode.
3. **Paste the tasks.** Paste the lines from step 1. Choose the link policy: IDs only, or links
   to your own tracker hosts only.
4. **Save your admin link.** Backlogfit shows it once. Keep it private: it lets you control the
   room from another device.
5. **Share the join link.** Paste it in the meeting chat or show the QR code. People enter a
   display name and join as voters or spectators.
6. **Introduce the first item.** The product owner explains it in two minutes. Answer
   questions, then start voting. Optionally start the timer.
7. **Vote.** Everyone picks a card. You see *who* has voted, never *what*, until the reveal.
8. **Reveal.** Click **Reveal** (or let auto-reveal do it when everyone has voted). Look at the
   distribution, median and consensus indicator.
9. **Discuss and re-vote if needed.** If votes are split, ask the highest and lowest voters to
   explain. Then **Re-vote**; earlier rounds stay in the history.
10. **Record the final estimate and move on.** Set the final value, press **Next**, and at the
    end export the results (CSV, JSON, Markdown or summary) into your tracker or notes. Close the
    room when you are done; all its data is deleted.

![Reveal screen with distribution and consensus](assets/screenshots/reveal.png)

![Facilitator controls: reveal, re-vote, timer, next task](assets/screenshots/admin.png)

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
- **Re-vote etiquette.** Re-vote only after new information has been shared. Do not re-vote just
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

**What if I lose the admin link?** It cannot be recovered (the server only stores a hash).
Create a new room; it takes a minute.

**How long can a session run?** Up to the lifetime you chose (default 2 hours, maximum 8);
extend it from the facilitator menu. Rooms close after 30 minutes without activity.

More answers: [FAQ](FAQ.md).
