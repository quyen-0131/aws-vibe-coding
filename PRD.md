# Language Study Planner — Product Requirements

**Status:** first draft, written from [CONTEXT.md](CONTEXT.md) and the two prototypes in this folder.
**Assumptions are marked `[A]`.** Every one of them is a guess I made to keep the document moving — correct them and the rest follows.
**Open decisions are in §13.** §13.3 — the load-bearing one — is now **decided**: no LLM *at runtime*; missions are drafted with a model at authoring time, reviewed by a human, and shipped as static content. Four decisions remain.

---

## 1. Why this document exists

`CONTEXT.md` is a good domain model and a bad product spec, which is exactly what it was meant to be. It fixes the team's vocabulary and forbids synonyms. It does not say what a learner sees, in what order, or why they would tolerate any of it.

The UI prototype exposed the gap: three different-looking screens, all of which drop a learner into "challenge 1 of 3" of a scenario that already exists, inside a plan that already exists, built from material nobody ever added — labelled with team vocabulary like *Difficulty Ramp* and *Learning Evidence*. It looked designed and was unusable, because the product had never been defined.

This document defines it.

---

## 2. The problem

People who want to learn a language mostly do not lack material. They have a podcast subscription, saved articles, a textbook, a course they stopped. What they lack is a way to convert twenty scattered minutes a week into something they can point at and say *I can now do this*.

The two things on offer both fail them:

- **Gamified apps** produce a streak and a number. The number does not correspond to anything the learner can do in a real situation, and everyone knows it.
- **Structured courses** assume a schedule the learner does not have, and punish absence with a backlog.

The gap: a system that takes material a learner already owns, cuts it into sessions that fit the time they actually have, and produces honest, specific evidence of ability.

### 2.1 — Why not just paste this into a chatbot?

This has to be answerable in one line or the product has no reason to exist. Taking it seriously:

**What a chatbot does better than we ever will.** Infinite variety, any topic, any language, answers follow-up questions, free, already installed. We are not going to beat it on any of those and should not try.

**What it cannot do, and we can:**

1. **Decide for you.** A chatbot is a blank prompt: it needs you to know what to practise, at the moment you have least capacity to choose. Our learner opens the app and one thing is waiting. Removing the decision *is* the product — see §3 and §7.
2. **Remember across weeks, and act on it.** A chatbot will not deliberately resurface the phrase you fumbled three weeks ago inside a situation you have not seen. Our missions do (§8.1, point 4). Even chatbots with memory do not *schedule*.
3. **Leave you with something.** A chat scrolls away. We leave a growing list of specific can-do statements, each backed by your own recordings. That artifact is the reason to keep going.
4. **End.** A chat has no boundary; you stop when bored or guilty. A mission finishes, with something earned. Closure is a feature, not a limitation.

**The uncomfortable part.** Inside a *single* mission we are worse than a chatbot — less flexible, less responsive, less clever. Every advantage above is longitudinal: it appears at mission two and compounds. That is a genuine risk (§14), and it has one design consequence that matters more than anything else in this document:

> **The difference must be demonstrated, never explained.** A product that needs an onboarding page to tell you why it beats ChatGPT has already lost. The place we prove it is the end of mission two, when a learner sees words they were never re-taught reappear because they needed them — and a list that now has two things on it instead of one. Not a slide claiming we do spaced repetition.

This was tested on the prototype and it worked: adding a second mission is the moment the product stops looking like a worse chatbot.

---

## 3. Who this is for

A working adult who has decided to learn French, has real material and real intent, and gets fifteen minutes on a good day and none on a bad one. They have quit at least one language app already, and can tell you why: it felt like busywork.

They are not a beginner in motivation. They are a beginner in time.

**We are not building for:** classroom learners with an instructor, exam candidates who need a certified level, or people who want a habit-forming daily game.

---

## 4. Product principles

Each principle is only worth writing down if it forbids something. The consequence is the point.

**4.1 — Show the ability, never the score.**
A learner's progress is a list of plain sentences about what they can do. *So we do not ship:* points, XP, levels, streaks, percentages, or any single number representing "how good your French is."

**4.2 — Promise up front. Explain the mechanics only after the first success.**
One sentence saying what the app is for, before anything: a learner who does not know why they are here will not invest thirty seconds in a café. But *how the thing works* — three attempts, the gap, the can-do statement — lands after they have completed something and have a reason to care. *So we do not ship:* a multi-screen tour, a concept carousel, or any explanation of our structure before the learner's first attempt. One promise screen is not a tour.

**Scene-setting is not onboarding.** Telling a learner where they are, who they are, and what they want is *part of the exercise*, not an explanation of the product. It is never subject to this principle. See §6.3.

**4.3 — Our vocabulary is ours, not theirs.**
`CONTEXT.md` exists so the team stops arguing about words. Almost none of those words should reach the interface. *So we do not ship:* UI labelled "Mission", "Learning Evidence", "Capability Check", or "Difficulty Ramp". See §5.

**4.4 — Pull them back with something specific. Never with something to lose.**
The learner should reach roughly three sessions in a normal week, and that has to come from a named, priced thing waiting for them — not from a counter they will eventually break. A streak makes the learner accountable to the counter rather than to the language: opening the app and completing anything satisfies it, so the cheapest session is the rational one and nothing is remembered. *So we do not ship:* streaks, chains, decay meters, "you missed 4 sessions" screens, guilt notifications, or **any number whose only input is attendance**. See §8.2 for what replaces it.

**4.5 — A session ends finished, not interrupted.**
Every session reaches a clean stopping point. Nothing is left visibly locked or counting down. *So we do not ship:* a greyed-out third step with a timer on it, which reads to a learner as a paywall.

**4.6 — Claim narrowly, and mean it.**
"Can order in a café and handle a change to the order" is a claim we can defend from three recorded attempts. "B1 French" is not. *So we do not ship:* CEFR levels, proficiency estimates, or any claim broader than the evidence behind it.

---

## 5. The language layer

**This is the fix for "the concept isn't intuitive."** The concepts are fine. The words on screen were internal ones.

Rule: the learner sees the *thing*, not the *category name for the thing*.

| Internal term | What the learner sees | Notes |
|---|---|---|
| **Resource** | The item itself — "Coffee Break French #12", "that Le Monde article" | Never the category word. In lists: "Your stuff". |
| **Study Plan** | "This week" | A plan they can see is a week of specific things, not an object called a plan. |
| **Practice Session** | "session", lowercase, in ordinary sentences | Plain English already. Safe to say aloud. |
| **Target Language** | Nothing. It's French. | Only surfaces if we add a second language. |
| **Busy Learner** | Nothing. | Persona, internal only. |
| **Mission** | The scenario's own name — "Ordering in a café" | See §13.1. "Mission" is the strongest game-y holdover in the model. |
| **Capability** | The sentence itself: *"You can order in a café and handle a change to the order."* | The statement is the label. Never render the word "Capability" next to it. |
| **Capability Check** | Nothing. | The learner experiences three things to do, not a named assessment. |
| **Learning Evidence** | "What you've done" — and mostly, just the actual attempts, shown | Their own words and recordings are more convincing than any label. |
| **Difficulty Ramp** | Nothing. | A design constraint on us. If the learner notices it, we built it wrong. |
| **Word Card** | Nothing — a word is tappable, and tapping shows a card | Named by behaviour, not by noun. |
| **Review** | "Come back to this" / "Again, from cold" | Never "Review" as a section heading. |
| **Speaking Check** | "Say it" | A button, not a feature name. |

Of thirteen terms, the learner sees roughly zero as labels. That is the intended outcome, not an oversight.

**What a Resource actually is, concretely.** The learner pastes in something they already read, watch, or listen to in French — a news article, a podcast episode's transcript, a chapter, a saved lesson. The app reads it and produces two things from it: **situations to practise** (drawn from the vocabulary and contexts that material actually contains) and **word cards** for the useful words inside it. The learner is not translating the material and not being quizzed on it; they are being given scenarios where its language is the language they need.

**The honest limit — revised after §13.3 was decided.** With no generation, material does not *become* a mission. It **chooses** one: we extract its vocabulary and match it against our authored missions by keyword. Paste an article about a rail strike and you get the ticket-office mission, carrying your article's words. Paste something with no matching situation and we say so, and offer the nearest one. The learner is never told their material produced something it did not.

---

## 6. The first session

### 6.1 — What it has to achieve

The target is **one completed, satisfying session in under six minutes, from a cold open, with nothing set up.**

**Both sources are offered up front. Ours is the zero-effort default.**

An earlier draft of this section hid the "bring your own" path entirely until after session one, on cold-start grounds. That was wrong, and testing the prototype caught it: a learner who only ever sees our café content never learns that the product's actual premise — *practice built from material you already own* — exists at all. Someone who arrived with a podcast backlog is handed generic content and no visible alternative.

The correction: **showing the option costs nothing; requiring it costs everything.** After the promise screen, one question with two answers:

- **Start with one of ours** — marked *fastest*, ready immediately, nothing to paste. The default, and the path we expect most first sessions to take.
- **Bring your own** — paste a link or the text itself.

The cold-start concern was real and is handled by making our path a single tap, not by concealing the other one. A learner who picks ours is still told at 4:40 that their own material is the point.

`[A]` **Choosing "bring your own" on the very first session is a minority path**, and we should design for it being tried, abandoned, and returned to later. It must be equally reachable from inside the app afterwards.

### 6.2 — Minute by minute

| Time | Screen | What happens | Why |
|---|---|---|---|
| 0:00 | **The promise** | One screen, one sentence, one button. *"Turn the French you already read and listen to into things you can actually do. About ten minutes, three times a week."* | Answers "what is this for" before asking for anything. One screen, not a tour — principle 4.2. |
| 0:10 | **One question** | "How much time do you actually have on a normal day?" — 5 / 10 / 20 min. Nothing else. No account, no email. | Sets session length for everything after. Also the first honest signal: we care about your time, not your ambition. |
| 0:30 | **Where does this come from?** | Two options. *Start with one of ours* (marked fastest, one tap) or *bring your own* (paste a link or text). See §6.1. | Makes the product's actual premise visible in the first thirty seconds without forcing anyone through a blank page. |
| 0:45 | **The scene** | Where you are, who you are, who you're talking to, what you want, and what counts as done. See §6.3 for the full spec. | You cannot attempt a situation you have not been placed inside. |
| 1:00 | **First attempt, supported** | The French sentence they need is on screen. They type it, say it, or both. | Nobody fails minute one. |
| 2:20 | **The first explanation** | *"That's one. You'll do it once more with a twist, then once more in a couple of days — from cold. After that it's yours."* | **The mechanics land here**, after a success, when the learner has a reason to care what the structure is. |
| 2:40 | **Second attempt, unsupported** | Same café, something has changed — the croissants are gone. The model sentence is withdrawn. The scene updates; it is not repeated. | The ramp, felt rather than announced. |
| 4:20 | **Session ends, complete** | "Done for today." What they said, played back. What the third one will be, and when. See §8.1. | Principle 4.5 — finished, not interrupted. |
| 4:40 | **The ask ×2** | "Next one from your own stuff?" — paste a link, paste text, or skip. Then, and only then, the notification permission prompt. See §8.3. | They now know what "their stuff" turns into, and there is a specific thing to be reminded *about*. |

**Empty state, permanently:** a learner who never adds anything still has a working product on our supplied material. Adding material makes it *theirs*, not *functional*.

### 6.3 — The scene

Every attempt opens with a scene. No exceptions — including the second and third challenges in the same sitting, and including a word resurfacing inside a mission weeks later. This is the single largest gap in the UI prototype: all three variants opened with a French sentence and no indication of who was speaking, who the learner was, or what they were trying to achieve.

> **Observed, first person, on the prototype.** A tester read the server's opening line, concluded they were playing *the server*, and replied "avec du lait" — offering milk rather than ordering. Two causes, both instructive:
> 1. **No scene.** Nothing anywhere said who they were. Role was left to be inferred from a French sentence, which is precisely the inference a learner cannot yet make.
> 2. **The model sentence was rendered on the server's side of the conversation**, so the line they were meant to say looked like a line the server had said.
>
> Cause 2 was a layout defect and is fixed. Cause 1 is the reason this section exists. **A learner who does not know which side of the counter they are on cannot practise anything** — and they will not tell us they're confused, they will just be wrong and feel stupid.

A scene has five parts and fits on one screen:

| Part | Café example | Rule |
|---|---|---|
| **Where** | A busy café counter in Lyon, mid-morning. | Concrete place and time. Never "a café." |
| **Who you are** | You. A visitor who wants breakfast and would rather not point at things. | See below — normally the learner, not a character. |
| **Who you're talking to** | The server. Friendly, in a hurry, will not slow down for you. | Name their disposition, because it sets the difficulty. |
| **What you want** | A coffee and a croissant. | One concrete goal, stated as a want, not a task. |
| **What counts as done** | You've ordered and they've understood you. | See below — this is load-bearing. |

**The learner plays themselves unless there's a reason not to.** "You are a visitor who wants breakfast" is easier to inhabit than "you are Marc, a sales rep from Toulouse," and it's the truthful framing — they really will be a foreigner ordering a coffee. Assign a role only when the scenario genuinely requires one (a work call, a doctor's appointment) and state it in one line.

**"What counts as done" is what makes §9 work.** We deliberately do not grade attempts. That is only defensible if the learner knows what they were aiming at, because *they* are the judge. Without a stated goal, "no grading" isn't respectful — it's just vague. Every scene must state its success condition in plain English before the learner opens their mouth.

**Every challenge gets its own scene, including the second and third in the same sitting.** Same five parts, the situation moved on. The third is a different café with a different server, not a repeat — and it never says "remember when." When a word or pattern resurfaces in a *later mission* (§8.1), that scene is written from scratch too: the learner is placed somewhere new, and recalling the language is the challenge.

`[A]` The scene is prose, roughly 25–40 words, not a labelled form. The table above is the checklist for whoever writes or generates it, not the layout.

---

## 7. The loop after session one

1. Open the app. One thing is waiting. Never a list, never a choice of six.
2. It is a new situation. Words and patterns from earlier missions are woven into it (§8.1, point 4) rather than queued as separate review items.
3. Do it. Two to fifteen minutes depending on §6's answer.
4. Ends complete. If that finished a third attempt, the can-do sentence appears and is added to their list.
5. That's it. No dashboard, no next-up queue.

`[A]` **One thing waiting, not a queue.** Choice is the enemy of a fifteen-minute window. The learner may pull "something else" deliberately, but the default is a single decided thing.

---

## 8. Finishing, and coming back

§8.1 is what a mission's ending looks like now that nothing is gated. §8.2 is how a learner gets back here roughly three times a week without a streak — which is harder than it was, because §8.1 gave up the forced return.

### 8.1 — A mission finishes in one sitting

**Nothing is gated. A learner who wants to keep going, keeps going.**

An earlier draft of this section locked the third challenge behind a two-day wait, presented as a completed session with the remainder deferred. That was wrong, and it was mine. `CONTEXT.md` asks for a "delayed Review Mission" but never specifies a blocking wait — and its own definition of **Review** points the other way:

> *A short reappearance of a Word Card or sentence pattern **in a later Mission** so that the learner recalls it in a new context.*

A review lives inside a **later mission**, not as a padlocked third step of the current one. Conflating the two produced the energy-timer pattern from mobile games — a progress bar stuck at 2/3 with a countdown — which reads as a paywall however kindly it is worded.

**The corrected shape:**

1. A mission runs start to finish in one sitting: supported attempt, variation, then unsupported. No waiting, no locks.
2. It ends with the Capability earned and a short recap — what you said, and the words worth keeping.
3. The next mission is available immediately. Someone with a free hour who wants four missions gets four missions.
4. **Review happens between missions, not inside one.** Words and patterns from earlier missions resurface in later ones, in situations the learner has not seen. That is the Review defined in `CONTEXT.md`, and it is where the spacing now lives.

**The spacing was moved, not discarded.** Practice spread over time genuinely does beat one sitting — that was never in doubt. The mistake was making a learner *wait* inside a mission they had already started. Spacing between missions gets the same memory benefit while no session is ever left half-finished.

**What this costs us, plainly.** The forced return was also a scheduling mechanism: a two-day delay manufactured a reason to come back, and it did most of the work in §8.2(a). Without it, the cadence has to be earned by the product being worth reopening. That is a harder bar, and the right one.

### 8.2 — Three sessions a week, without a streak

**Target: three sessions in a normal week.** This is a number we hold ourselves to, not one we show the learner as a goal to hit.

The test any mechanic has to pass: **it must be impossible to move by showing up.** If tapping through a session advances it, we have rebuilt the streak with different art.

Three mechanisms, in order of how much work they do:

**(a) One mission is a satisfying unit, and there is always another.**
This mechanism used to be the two-day delay manufacturing a return. §8.1 removed that, so it now rests on something less certain: a mission ends with a Capability earned and the next situation visible and ready. The learner comes back because the last one was worth the ten minutes, not because a timer expired. **This is now the weakest of the three, and it should be watched most closely.**

**(b) The open loop — always exactly one named thing waiting.**
A session never ends with "see you soon." It ends with the next thing named, specific, and priced: *"Next: buying a train ticket when the machine is broken. About six minutes."* A vague obligation is trivial to drop; a specific six-minute one that already has a name is much harder, and it costs the learner nothing to hold. This is pull, and pull is the only pressure we are allowed to use. With the forced return gone, this carries more weight than it used to.

**(c) The number that only recall can move.**
Instead of days in a row, the headline is *what you can still do*: **"Nine things you can do. Seven confirmed in the last month."** The only way to move it is to prove a can-do statement again, cold. A learner who opens the app every day and taps through changes this number by exactly zero — which is the whole point.
`[A]` Confirming an unconfirmed statement is always offered and never demanded, and never becomes a queue. Failing one does not remove it; it puts that situation back into rotation.

**What we are trading away, plainly.** Streaks work. They are the most effective retention mechanic in consumer software and we are giving them up deliberately. Pull is weaker than loss aversion, so we should expect fewer sessions per week than a streak-driven competitor gets. The bet is that our sessions are worth more each. If that bet is wrong we will see it in §12 as a high cold-return *failure* rate — people coming back and remembering nothing — and the honest response then is better spacing, not a streak.

**Worth naming:** three sessions a week is a proxy, not the goal. If a learner remembers everything at two sessions a week, we have won and the number is wrong. §12 is written so frequency can never be optimised on its own.

### 8.3 — Notifications and reminders

4.4 rules out the usual reminder playbook, so this section says what we send instead. The rule: **a notification may only announce that a specific thing is ready. It may never comment on the learner's behaviour.**

**What we send.** At most one notification per named next mission, and only when the learner has been away long enough that the open loop has gone cold (`[A]` three days):

> **The broken ticket machine is waiting.** Six minutes. You'll need the café words again — this time nobody helps.

It names the thing, prices it, and gives a reason to be curious. That is the §8.2(b) open loop delivered to the lock screen. Note this is now a *weaker* trigger than it was: with no scheduled return, there is no moment when something objectively "becomes available", so the timing is our judgement rather than the product's own clock.

**One follow-up, then permanent silence for that item.** If they don't come, one more four days later, worded identically. After that, nothing about that mission ever again. Two touches maximum, and a learner who ignores both is not chased.

**Never sent, in any wording:**
- Anything counting days, sessions, or absence — "it's been 5 days", "you're falling behind", "don't lose your progress."
- Anything with no specific thing behind it. No generic "time to practise!"
- Anything at a fixed daily time regardless of state. If nothing is ready, nothing is sent.
- Anything about other learners.

**Asking for permission.** Web push, requested at 4:40 in §6.2 — after the first session is finished, immediately after we've told them what's waiting on Thursday. Never on page load. The ask is tied to the promise: *"Want a nudge when the café one is ready?"* A learner who declines gets the same product; the open loop is shown in-app instead.

`[A]` **Timing.** Delivered in the same part of day the learner did their previous session, because that is the window they actually have. Not a fixed hour, and no second guess if they miss it.

`[A]` **Email as a fallback**, opt-in, same rules and same wording, for iOS web-push flakiness. Worth checking whether this is needed at all before building it.

**The honest risk.** Two notifications per item is very restrained by consumer standards, and it may not be enough to hit three sessions a week. If §12 shows the second-mission rate is low *and* the in-app open loop is being seen, the answer is better scene hooks and tighter spacing — not more notifications, and not a different tone of notification.

---

## 9. Attempts, correctness, and honesty

`[A]` **There is no grade and no fail state on an individual attempt.**

What happens instead: after an attempt, the learner sees their own words next to the target, with differences visible, and chooses to redo it or move on. They judge; we show.

Rationale: grading needs accuracy we cannot honestly deliver on free-text French, and a score contradicts principles 4.1 and 4.6. The honesty in this product comes from the *narrowness of the claim*, not from marking.

**The browser transcript is a convenience, never a judgement.** Web Speech is trained on fluent native speech and is measurably worse on learner accents — it will mangle a beginner's French and be confidently wrong doing it. Rules that follow:
- The transcript lands in an **editable** field. The learner fixes it; we never treat it as what they said.
- It is **never** compared against the model sentence, scored, or used to decide whether an attempt counts.
- The **audio recording is the real Learning Evidence.** The transcript is scaffolding to save typing.
- Where it is unavailable (Firefox, Safari), the product loses nothing essential — say so plainly rather than degrading quietly.

**The hole this leaves, stated plainly:** someone can type "asdf" three times and earn a can-do statement. Mitigations, none sufficient alone:
- Prompt a redo when an attempt is empty, very short, or not in French.
- The evidence is the attempt itself, so a hollow Capability is visibly hollow to the only person who matters.
- Accept that self-directed learners have little incentive to cheat themselves.

This is **open decision §13.4** — it may hollow out the Capability, and I would rather you decide than have me assume.

---

## 10. Coming back after a long gap

`[A]` **Nothing accumulates and nothing expires.**

A learner returning after three weeks sees **one thing to do**, not fourteen overdue items. This is largely free now that §8.1 removed scheduled returns: there is no queue to fall behind on, because reviews were never appointments — they are words resurfacing inside whatever mission comes next.

This is the sharpest departure from spaced-repetition tools and follows from 4.4's "never something to lose." It means some scheduled reviews are silently dropped. That is a deliberate trade: a learner who does one thing after three weeks away is a learner still using the product.

No "welcome back, you missed 12 sessions." Nothing acknowledges the gap at all.

**Interaction with §8.2(c).** A long gap leaves several can-do statements unconfirmed, and that could easily curdle into the debt this section exists to prevent. It must not. The app offers **one** thing to re-prove, framed as a chance to confirm something is still yours, and never displays a count of what has gone stale. *"Seven confirmed in the last month"* is a fact about what you have. *"Six overdue"* is a demand. The distinction between those two sentences is most of this product.

---

## 11. Scope for v1

**In:**
- French only. Data model must not assume one language — adding a second should not be a rewrite.
- Phone-first responsive web. Works on desktop, designed for a phone. `[A]`, see §13.2.
- Supplied starter material sufficient for roughly the first two weeks.
- Learner-added material: pasted text and pasted URLs — used to pick and flavour an authored mission, not to generate one (§13.3).
- 20–30 hand-authored missions as branching dialogue. This is the bulk of the work.
- Speaking: record via `MediaRecorder`, play back. Browser transcript via Web Speech API where available (Chrome), presented explicitly as rough and never used for judgement.
- Local storage only, no account. `[A]`, see §13.5.
- Word cards: meaning, an example in context, pronunciation.
- The can-do list: every earned statement with its three attempts attached.

**Out, explicitly:**
- Correctness grading, scores, levels, CEFR claims.
- Streaks, XP, badges, leaderboards, daily-goal notifications.
- Accounts, sync, sharing, social.
- Languages other than French.
- Native apps.
- Audio, video, or PDF ingestion — text and URLs only.
- A general spaced-repetition scheduler beyond the single delayed return.
- Any teacher, tutor, or human-review feature.

---

## 12. How we'd know it worked

Modest and honest. We are explicitly not optimising engagement, because optimising engagement is how this product becomes the thing it exists to replace.

- **First session completion.** Of people who open it, how many reach 4:00. *This is the primary metric.*
- **Second-mission rate.** Of people who finish their first mission, how many come back and start another within five days. With the forced return gone (§8.1) this is the whole thesis in one number: was one mission worth ten minutes.
- **Recall-on-return rate. ⭐** When a word or pattern from an earlier mission resurfaces inside a later one (§8.1, point 4), how often the learner uses it without opening its word card. **This is the metric that replaces the streak.** It only moves when someone actually remembered something, so attendance cannot game it — not by the learner, and not by us.
- **Sessions per active week.** Target three. Tracked as a **diagnostic, never as a goal**, and only ever read next to cold-return success. Frequency rising while success falls means we have built a streak by accident and should stop.
- **Can-do statements per learner in week one.** Target is small — two or three. If it's twelve, the challenges are too easy.
- **Three-week resurrection.** Of people who go quiet for 14+ days, how many ever do another session. Tests §10.

Deliberately not tracked as goals: DAU, session length, time-in-app, streak length.

---

## 13. Open decisions

Ordered by how much they block the build.

**13.1 — Does the learner ever see the word "Mission"?**
Recommend **no** — show the scenario's own name ("Ordering in a café"). "Mission" is the last game-y holdover in a model that otherwise carefully avoids them, and it promises adventure that a two-minute café exchange doesn't deliver. Keep it as our internal term. *Your call; it's your product's voice.*

**13.2 — Phone-only, or desktop too?**
Recommend **phone-first, desktop tolerated**. The whole premise is fifteen stolen minutes, which happen on a phone. But the "paste an article" flow is a desktop behaviour. Affects how much §6's design has to survive a wide screen.

**13.3 — Where do challenges come from? — ✅ DECIDED: no runtime generation.**

**The decision: missions are hand-authored. There is no LLM API in the product.** Taken by the product owner, on the grounds that a per-session model dependency is not wanted. This resolves the question that was blocking everything else, so an implementation plan is now possible.

**What follows from it, in order of how much it hurts:**

**(a) The free-text conversation has to go.** A box that accepts any sentence but only ever advances a fixed script will always produce nonsense — a tester asked *qu'est-ce que vous me conseillez ?* and the server replied with an unrelated greeting, because nothing was reading the input. Without a model, **the honest move is to stop pretending it is a conversation.** Replace it with:

- **Read it.** The whole conversation, both sides, English toggleable. The learner does nothing yet.
- **Build it.** The learner's own line, broken into chunks and shuffled, plus two decoy chunks. Tap them into order.
- **Say it.** No help. Speak or type, then the line is revealed — after the attempt, never before.
- **Reuse.** Words come back in a later conversation, unannounced.

See §16 for why "build it" replaced an earlier "pick the line" step.

This is a branching authored dialogue — a visual novel, not a chatbot. Every reply is written by a person, so it is always coherent, always correct French, never hallucinated, zero latency, zero cost. It is also *better* for a beginner than free chat: choosing between three French sentences is a recognition task that scaffolds toward production, and the ramp from recognition → recall → production is exactly the Difficulty Ramp `CONTEXT.md` asks for.

**(b) The core promise weakens, and the wording has to change with it.** `CONTEXT.md` promises practice built *from* a learner's own material. Without generation we cannot build a scene from an arbitrary podcast. What we can do, with no model at all:

- **Extract vocabulary from pasted text** — frequency analysis, entirely client-side. Demonstrated working in the prototype.
- **Match material to the closest authored mission** by keyword overlap against mission tags. *You pasted an article about rail strikes → here is the ticket-office mission, with your article's words in it.*

So: **your material chooses and flavours your mission; it does not write it.** That is a smaller promise than §2 originally made, and §2/§5 must say the smaller true thing rather than the larger false one.

**(b½) The LLM moves to authoring time — which is where it was always most useful.**
"No API in the product" does not mean "no model anywhere." The distinction that matters is *runtime dependency*, not *tool use*:

| | Runtime generation | Authoring-time generation |
|---|---|---|
| Needs a backend + secret key | Yes — a key cannot ship in a static page | No |
| Learner data sent to a third party | Yes | No — only our own drafts |
| Latency inside a six-minute session | Yes | No |
| A wrong French sentence can reach a beginner | Yes | No — a human reviews every line |
| Cost per session | Yes | Zero |

**The workflow:** an editor drafts missions with a model (Google AI Studio's free Gemini tier is well suited — a few dozen calls, made by us, on content we wrote), a French speaker reviews and corrects, and the result ships as **static JSON**. The product itself never calls anything.

`[A]` **Free-tier terms are acceptable for this use and not for the other.** Google's unpaid terms state that submitted content is used to improve their products, that human reviewers may read API inputs and outputs, and that sensitive or personal information should not be submitted. That is fine for our own draft scenarios. It would **not** be acceptable for learner-pasted material, which is a second reason runtime generation is out. (Paid tier reverses this; so does free-tier access from the EEA, Switzerland or the UK.)

**(c) Content is the constraint, and the roadmap is a writing schedule.** Every mission is reviewed and signed off by a person who knows French, whether or not a model drafted it. Scope is no longer 'build the generator' but 'how many missions can we author, and who authors them.' That is a hiring and editorial question, not an engineering one. `[A]` A useful v1 is 20–30 missions covering the situations a visitor actually hits.

**What we give up, stated plainly.** Unlimited situations, true responsiveness to an unexpected sentence, and the ability to work from *any* material a learner owns. In exchange: it always works, it is always correct, it costs nothing to run, it has no latency, and it can never say something wrong in French to a beginner who cannot tell. For a product whose entire pitch is honesty about ability, that trade is defensible.

**13.4 — Is "no grading" acceptable?** See §9. It follows from your stated values, and it leaves a real hole.

**13.5 — Local-only storage for v1?**
Means a cleared browser wipes every earned can-do statement and every recording — the exact things the product tells learners to value. Recommend **local-only for v1, with export**, and accounts as the first thing after. Flagging it because "we lost your evidence" is uniquely damaging *for this product* in a way it wouldn't be for a flashcard app.

---

## 14. Risks

- **Cadence is now unforced, and may simply not happen.** §8.1 gave up the one mechanism that reliably manufactured a return. If people finish a mission, enjoy it, and never reopen the app, the answer is a better next mission — not reinstating a lock.
- **Content supply is now the bottleneck** (§13.3). Missions are hand-written; if authoring is slower than learners consume, the product runs dry. This replaces the old generation-quality risk and is more predictable, but no less fatal.
- **We are worse than a chatbot inside any single mission** (§2.1). If learners never reach mission two, they never see why we exist.
- **Three challenges in one sitting may be too long** for the fifteen-minute learner §3 describes, now that they cannot stop cleanly after two. Worth checking against the 5-minute answer in §6.2.
- **"No grading" may hollow out the can-do statement** (§9, §13.4).
- **Fifteen stolen minutes may not be a product.** It might be a feature of something the learner already opens daily. Worth naming.

---

## 15. What this means for the prototypes here

- `mission-flow-prototype.html` — **partly superseded.** Its three-attempt sequence stands. Its `awaiting review` state, the day counter and the `startReview` gate do not: §8.1 removed the wait entirely, so those transitions no longer exist. The remaining machine is supported → variation → unsupported → Capability, with no time dimension.
- `mission-screen-ui-prototype.html` — **superseded.** It prototyped the wrong screen, in the wrong vocabulary, with no first-run. Keep it as a record of what not to do.
- **Next prototype, once §13.1–13.3 are answered:** the first six minutes from §6, cold open to "done for today." That is the screen the product lives or dies on, and it does not exist yet in any form.

---

## 16. The mission format, as built

Settled by building it and testing it, not on paper. `weekend-mission-prototype.html` is the reference implementation.

### 16.1 — Content shape

**A mission is one conversation between two peers**, not a service transaction. The first content is *Talking about your weekend*: a colleague asks, and the learner answers.

**Branches are moods, not topics.** One mission, three versions — *un week-end sympa*, *un week-end tranquille*, *un week-end pas terrible*. The learner picks the one that is actually true for them, and the conversation follows it. The branch choice is **inside the fiction** (answering Alex's opening question), never a menu before it.

**The register is casual spoken French** — *t'as*, *ouais*, *carrément*, *bof*, *j'ai pas*, *plein*. `[A]` This is deliberate. It is how people actually speak and is badly served by textbooks, but it means learners will produce *« j'ai pas »* rather than *« je n'ai pas »*. If that is not wanted, the content has to change, not the format.

**There is no transactional goal**, so §6.3's *done when* changes shape for conversation missions. Not "you have ordered and been understood" but **"Alex keeps asking questions, and you keep having something to say."** Success is the conversation continuing.

### 16.2 — The four steps

| Step | What the learner does | Why it exists |
|---|---|---|
| **1. Read** | Reads the whole conversation, both sides. English toggleable. Word cards are tappable inline. | You cannot perform a conversation you have not seen. Removes all pressure from first contact. |
| **2. Build** | Their own line arrives in chunks, shuffled, with two decoys. They tap it into order. | Recognition before recall. Tests **word order**, which is where casual French is hard. |
| **3. Say** | No options. Speak or type, then the line is revealed. | Production. The reveal comes *after* the attempt, never before. |
| **4. Reuse** | Words return in a later conversation, unannounced. | The only thing a chatbot cannot do (§2.1). Needs a second mission to exist. |

### 16.3 — Word cards

Underlined phrases in step 1 open a card: the phrase, an English gloss, and a note on when to use it. Cards are chosen for **reusability**, not difficulty — *franchement*, *carrément*, *bof*, *pas grand-chose* travel to any conversation. Per §5 the learner never sees the words "Word Card"; a phrase is simply tappable.

**The French on a card is always lifted from the conversation it appears in.** Only the English gloss is written fresh — and English is the one thing the learner can check for themselves.

**Examples are found, not written.** A card shows up to three real uses of the phrase, gathered by scanning every conversation in the product, each labelled with where it came from (*Un week-end sympa · Alex*). A phrase used in two weekends therefore shows two genuinely different contexts. Where a phrase appears once, the card says so rather than padding it — this improves as conversations are added.

**Each card has a "write your own" box.** What the learner writes is kept and shown on the end screen. Producing a sentence with a new phrase is the point; nothing checks it, and nothing needs to.

### 16.4 — Where the French comes from

**Nothing is invented, at any step.** This is the working answer to having no French reviewer (§13.3):

- Conversation lines: written by the product owner.
- Step 2 chunks: pieces of the learner's own line.
- Step 2 decoys: chunks lifted from a *different* weekend — correct French, wrong context.
- Word cards: the phrase as it appears in the text; gloss in English.
- The Gemini matcher (§13.3): returns a verdict and an **English** note. Never French.

**A first attempt at step 2 got this wrong and is worth recording.** The original version offered three whole sentences drawn from the other weekends. Because those were about different topics, the right answer was identifiable without reading any French — pick the one that mentions hiking. It scaffolded nothing. Chunk assembly fixes it while keeping the no-invented-French property: the pieces are all from the target sentence, so the only question is order.

### 16.5 — Set-up screen: level and source

Before the conversation: **level** (A1 / A2 / B1) and **source** (ours / bring your own). Only A2 and *ours* are built. The others are shown, tagged **not in demo**, and selecting one explains the reasoning rather than failing silently.

This is deliberate. Both are real product questions with real answers we have chosen not to build yet, and hiding them makes the product look less considered than it is. `[A]` Levels change line length and how much support each step gives; the format is identical.

### 16.6 — Speaking is coached, not marked

The learner is **not** reproducing a sentence. They are answering as themselves. The sequence:

1. **Attempt.** Speak or type. Nothing is shown yet.
2. **Feedback**, specific and in English — what worked, what was thin, one phrase from *today's* list they could have used, and one concrete move to add ("say how long it took", "ask the question back").
3. **Try again**, or ask for a **hint** — the opening words and which phrases the native version used. A scaffold, not the answer.
4. **See how a French speaker put it.** Only on request, or after an attempt.

**What is judged, and what is not.** Two questions only: *does it answer what was asked*, and *does it give the other person something to react to*. An answer sharing no words at all with the reference can be fully successful — tested: *« Franchement super, j'ai vu ma soeur qui vient de rentrer du Japon »* is accepted against a line about hiking.

Verdicts are named for the conversation, not for correctness: **works** / **thin** (correct but a dead end) / **missed**. "Thin" is expected to be the most common and most useful.

**The reference line stays.** It is labelled *one way a French speaker put it* and shown after the attempt. Learners who want something to measure against get it; it is a reference, not an answer key.

### 16.7 — Build it: three tries

Wrong builds say **where** they diverged ("the first two pieces are right — it goes wrong after « Oui, »") and count down. After the first failure the opening chunk is highlighted. After the third the line is assembled and shown. Never an unbounded loop, never a bare "wrong".

### 16.8 — What the end screen shows

**No score. No fraction. No count.** An earlier build ended with "7 of 8 lines answered acceptably", which violates §4.1 — a single number standing for how good your French is.

What replaces it is better anyway: **the learner's own sentences**, each paired with the native version. That is `CONTEXT.md`'s Learning Evidence, literally — what they actually said, kept. Plus the phrases worth keeping, and any sentences they wrote on a word card.

### 16.9 — Navigation

Every screen past the first has a **Back** button, stepping backwards line by line and then stage by stage. A learner who mis-taps must never be forced to finish or restart.

---

## 17. What this is deliberately not

Written after an alignment review found the build drifting toward the two things it exists to avoid. Nothing in the repo previously said any of this, which is *why* it drifted: each addition looked reasonable on its own.

### 17.1 — Not Duolingo

**Banned outright:**

- Any number standing for ability — scores, fractions, percentages, XP, levels, streaks. (An end-of-session "7 of 8" shipped and was removed; see §16.8.)
- Hearts, lives, gems, or any currency.
- Daily goals, calendar rings, or guilt notifications (§8.3 already covers this).
- Leaderboards, and anything comparing one learner to another.

**Kept, with the reasoning written down so it is not relitigated:**

- **The build-it step is a word bank, and word banks are Duolingo's signature mechanic.** It stays — reviewed and kept deliberately — because it tests word order, which is where casual French is genuinely hard, and because it uses only the learner's own sentence. The risk is real and the value is higher.
- **The step tracker** is progress furniture. Kept because a learner needs to know how long a session is, but it must stay a map, never a reward: no fills, no chimes, no celebration.
- **Three tries then reveal** resembles an attempts mechanic. Kept because the alternative is an unbounded loop, and it is capped rather than scored.

### 17.2 — Not a chatbot

- **No free conversation.** The learner never types into an open-ended exchange that generates replies.
- **No generated target language, ever, at runtime.** Every French sentence a learner sees was written by a person. The matcher returns a verdict, English feedback, and phrases copied verbatim from our own list; anything it invents is discarded server-side.
- **The model judges, it never speaks.** If that line is ever crossed, the product becomes a chatbot with a nicer wrapper, and §2.1's argument collapses.

### 17.3 — The thing that actually makes it neither

Not the drills. The drills are the commodity part. What is unique:

1. **The conversation is about the learner's real life.** They pick the weekend they actually had. Nothing else in the category branches on mood.
2. **They answer as themselves**, and an answer is judged on whether it keeps the conversation going, not on whether it matches a string.
3. **Language comes back across conversations**, unannounced, in situations they have not seen (§8.1).
4. **They keep what they said.** Their own sentences, not a score.

**Point 3 does not exist yet.** Until a second conversation ships, this is an unusually thoughtful drill app. §17.3 is a claim the build has not yet earned.

### 17.4 — The second conversation

`[A]` **« Des projets pour ce week-end ? »** — Friday afternoon, same colleague, deliberately the mirror of the first.

- **Language returns because the situation needs it**, not because it was scheduled: *franchement, plutôt, carrément, bof, pas grand-chose, envie de, quand même, j'ai pas, t'as* all work unchanged in the future.
- **Half the vocabulary flips from recognition to production.** *Ça devait être, sérieux, ah mince, je vois, c'est déjà ça, je déteste ça* were **Alex's** lines in conversation one — the learner only ever read them. Here Alex shares their plans and the learner must react, so those phrases become productive with no new teaching.
- **Same branch-by-mood shape:** plans / nothing planned / not sure yet.
- Small additions only: *ça te dit ?, on pourrait, ça marche, je vais voir, peut-être*.

Written by the product owner, like the first — that preserves the no-invented-French property (§16.4) that everything else depends on.

