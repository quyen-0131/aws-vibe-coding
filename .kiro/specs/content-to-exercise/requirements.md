# Requirements Document

## Introduction

This spec defines **content-to-exercise generation** for the French practice app (defined in `PRD.md` and `CONTEXT.md`, prototyped in `weekend-mission-prototype.html`, polished in the planned `app.html`). The feature lets a learner paste or type their own material and have the app turn that material into the exercises the app already runs: **Read** (a chat transcript with tappable word-cards and an English toggle), **Build** (assemble a line from chunk/chip pools), **Say it** (a spoken or typed attempt judged by the Gemini matcher), and **Done** (the learner's own sentences as evidence, no scores).

### The core tension, stated up front

The PRD is built on a hard rule — **§16.4 / §17.2: no invented French**. Every French string the learner sees today was written by the product owner; the Gemini matcher returns only a verdict and *English* notes, and anything it invents in French is discarded. The PRD's decided position (§13.3) is that there is **no runtime generation** at all: the learner's own pasted material is used only to *pick and flavour* an authored mission, never to *write* one.

This feature asks for something the PRD deliberately scoped out: taking *arbitrary* learner material and *transforming* it into exercises. That is a real change of premise, and these requirements do not pretend otherwise. They resolve the tension by drawing a sharp line around **provenance**:

- **The learner's own text is the source of truth for the French.** When a learner pastes French, that French is theirs — the app does not invent, correct, or paraphrase it. Exercises are built by *selecting, segmenting, and re-presenting* the learner's own strings, exactly as Build already does with chunks of an authored line. This keeps the no-invented-French property intact: the French on screen still came from a human, now the learner.
- **No new French is generated at runtime.** The app does not fabricate French transcripts, translations, decoys, glosses, or model answers. Where English is needed (glosses, scene framing, coach notes), it is clearly English and clearly the app's, never passed off as the learner's French.
- **Provenance is always honest.** Material the learner supplied is labelled as theirs. The app never tells a learner their material produced something it did not (PRD §5 "never told their material produced something it did not").

This is the smaller true thing in place of the larger false one (PRD §13.3b). The feature is explicitly a **transform of learner-supplied French into the existing exercise shapes**, not a French generator.

### What is deliberately not in scope

Per PRD §11 ("Out, explicitly") and §13.3, this feature does **not**: generate French at runtime; translate the learner's material into or out of French; grade, score, or level the learner; ingest audio, video, or PDF; or send learner material to any third party for French authoring. The Gemini matcher is used only as it is today — a judge that returns a verdict and English notes (PRD §17.2 "the model judges, it never speaks").

## Glossary

- **System**: the French practice app as a whole (client plus the `server.js` matcher proxy), unless a more specific name is used.
- **Content_Importer**: the component that accepts, validates, and normalizes learner-supplied material into a canonical internal form.
- **Exercise_Builder**: the component that transforms normalized learner material into the Read, Build, Say-it, and Done exercise data shapes.
- **Learner_Content**: text supplied by the learner — pasted plain text or pasted into the input — intended to be turned into exercises. May be a dialogue, a passage, or a list of lines.
- **Source_Line**: a single French sentence or utterance extracted from Learner_Content, attributed to a speaker where the material is a dialogue.
- **Transcript**: the Read-step data shape, an ordered list of turns `[speaker, fr, en]`, matching the prototype's `WEEKENDS[key].turns` shape.
- **Scene**: the five-part framing shown before an exercise (where, who you are, who you're talking to, what you want, what counts as done), matching the prototype's `SCENE` shape (PRD §6.3).
- **Word_Card**: a tappable phrase entry `{phrase, en, note}` matching the prototype's `PHRASES` shape; the French is lifted verbatim from Learner_Content, only the English gloss is the app's (PRD §16.3).
- **Chunk**: a segment of a Source_Line produced by the existing chunking logic (split on `, . ! ? …`), used to build chip pools for the Build step (PRD §16.2, §16.7).
- **Decoy**: a Chunk drawn from a *different* Source_Line within the same Learner_Content, used as a distractor in the Build step — correct French, wrong context (PRD §16.4).
- **Verdict**: the Say-it matcher result, one of `works | thin | missed | not checked` (prototype `{ok|near|off|skip}`), with English coach notes and a reference reveal (PRD §16.6).
- **Authored_Content**: the existing hand-written material (`WEEKENDS`, `PHRASES`, `SCENE`) shipped with the app.
- **Provenance**: the recorded origin of every French string shown — either Authored_Content or a specific piece of Learner_Content.
- **PRD**: `PRD.md`. **CONTEXT**: `CONTEXT.md`. Section references (e.g. §16.4) point into the PRD.

## Requirements

### Requirement 1: Accept learner-supplied content

**User Story:** As a learner, I want to paste the French I am trying to learn, so that my practice is built from material I actually care about rather than only the supplied conversations.

#### Acceptance Criteria

1. WHEN the learner chooses to bring their own material, THE Content_Importer SHALL present a text input that accepts pasted plain text.
2. WHEN the learner submits pasted text, THE Content_Importer SHALL accept input containing French sentences, line breaks, and common punctuation without rejecting it for formatting alone.
3. WHERE a line in the pasted text begins with a speaker label of 1 to 20 characters followed by a `:` or `-` separator, THE Content_Importer SHALL interpret the remainder of that line as a Source_Line attributed to that speaker label.
4. WHERE the pasted text contains no line matching the speaker-prefixed form, THE Content_Importer SHALL treat each sentence as a Source_Line attributed to a single default learner speaker.
5. IF a line's speaker label is empty or consists only of whitespace or separator characters, THEN THE Content_Importer SHALL treat the whole line as an unattributed Source_Line rather than producing an empty speaker.
6. THE Content_Importer SHALL impose a maximum input length of 5,000 characters and, WHEN that length is exceeded, SHALL inform the learner in plain English and SHALL accept only the portion within the limit rather than failing silently.

### Requirement 2: Normalize content into a canonical internal form

**User Story:** As a learner, I want my messy pasted text to become clean practice material, so that the exercises read naturally.

#### Acceptance Criteria

1. WHEN Learner_Content is accepted, THE Content_Importer SHALL segment the content into an ordered list of Source_Lines, preserving the original order of appearance.
2. WHEN segmenting, THE Content_Importer SHALL split on sentence-ending punctuation (`.`, `!`, `?`, `…`) and on explicit line breaks, consistent with the existing chunking approach.
3. WHEN a Source_Line is produced, THE Content_Importer SHALL retain the exact original French characters of that line, including accents and casual-French contractions, without altering spelling or wording.
4. WHEN normalization completes, THE Content_Importer SHALL record Provenance on every Source_Line identifying it as Learner_Content.
5. WHEN leading or trailing whitespace surrounds a Source_Line, THE Content_Importer SHALL trim that outer whitespace while leaving internal characters unchanged.
6. IF a candidate segment contains only whitespace after trimming, THEN THE Content_Importer SHALL discard that segment rather than producing an empty Source_Line.

### Requirement 3: Reject or flag unusable input

**User Story:** As a learner, I want to be told plainly when my material cannot become exercises, so that I am never handed broken or empty practice.

#### Acceptance Criteria

1. IF submitted Learner_Content is empty or contains only whitespace, THEN THE Content_Importer SHALL decline to build exercises and SHALL state in plain English that some text is needed.
2. IF submitted Learner_Content yields fewer than 2 Source_Lines, THEN THE Content_Importer SHALL decline to build exercises, SHALL report the number of Source_Lines found, and SHALL state in plain English that more material is needed.
3. IF submitted Learner_Content contains no characters in the French-relevant ranges (basic Latin letters and Latin-1/Latin-Extended accented characters), THEN THE Content_Importer SHALL warn the learner that the material does not look like French and SHALL require an explicit learner confirmation action before continuing.
4. WHEN the Content_Importer declines or warns about input, THE System SHALL preserve the learner's typed text in the input so that it can be edited rather than re-entered.
5. WHEN the Content_Importer declines input, THE System SHALL continue to offer the Authored_Content path so that the learner retains a working product (PRD §6.1 empty state).

### Requirement 4: Produce a Read transcript from learner content

**User Story:** As a learner, I want my pasted material shown as a readable conversation with tappable phrases, so that I can read it through before being asked to produce anything (PRD §16.2 step 1).

#### Acceptance Criteria

1. WHEN exercises are built from Learner_Content, THE Exercise_Builder SHALL produce a Transcript as an ordered list of turns, each turn carrying a speaker and the verbatim Source_Line French, in the same order as the Source_Lines.
2. WHERE a learner-provided English line is paired with a Source_Line, THE Exercise_Builder SHALL attach that English to the turn for the English toggle; otherwise THE Exercise_Builder SHALL leave the turn's English empty and SHALL NOT invent a translation (an opt-in, labelled machine translation per 4.6 is shown by the System, not stored as learner English).
3. WHEN the Read screen renders a learner-built Transcript, THE System SHALL display the same inline tappable word-card affordance and English toggle used for Authored_Content.
4. WHEN a Transcript turn is displayed, THE System SHALL show only the French characters that came verbatim from the learner's Source_Line, with no French added, removed, or altered by the System.
5. WHEN the English toggle is activated AND a turn has empty English, THE System SHALL indicate in plain English that no translation is available for that turn rather than displaying any System-generated translation, unless a machine translation is available under 4.6.
6. WHERE the learner opted in to Gemini under 12.6, THE System MAY show Gemini's English translation of a turn that has no learner-provided English, labelled on screen as a Gemini machine translation that may be imperfect. Translations are English only; the System SHALL NOT display, store, or use any French returned by the model. Learner-provided English, when present, always takes precedence.

### Requirement 5: Derive word-cards from learner content

**User Story:** As a learner, I want the useful phrases in my own material to be tappable, so that I can keep the words worth keeping (PRD §16.3).

#### Acceptance Criteria

1. WHEN exercises are built from Learner_Content, THE Exercise_Builder SHALL select between 1 and 12 candidate Word_Card phrases, each of which occurs verbatim in at least one Source_Line.
2. WHEN a Word_Card is created, THE Exercise_Builder SHALL set the card's French phrase to the exact text as it appears in the Source_Line, preserving accents, casing, and contractions without substitution.
3. WHEN a Word_Card lists example uses, THE Exercise_Builder SHALL draw between 1 and 3 examples from occurrences within the learner's own Source_Lines and SHALL label each example with its origin (speaker and position within the Learner_Content).
4. WHERE an English gloss or usage note is attached to a Word_Card, THE System SHALL present that text as English authored by the System, never as the learner's French.
5. IF the learner supplied no English gloss for a selected phrase, THEN THE System SHALL present the Word_Card with the phrase and its example uses and SHALL omit the gloss rather than generating French.
6. IF no phrase in the Source_Lines qualifies as a Word_Card candidate, THEN THE Exercise_Builder SHALL produce zero Word_Cards rather than fabricating a phrase.

### Requirement 6: Build chunk and decoy pools from learner content

**User Story:** As a learner, I want to assemble my own lines from shuffled pieces, so that I practise word order the way the Build step already works (PRD §16.2 step 2, §16.7).

#### Acceptance Criteria

1. WHEN a Source_Line is selected for the Build step, THE Exercise_Builder SHALL produce the target Chunks by segmenting that Source_Line on the existing chunking delimiters (`,` `.` `!` `?` `…`).
2. WHEN building the chip pool, THE Exercise_Builder SHALL draw Decoy Chunks only from other Source_Lines within the same Learner_Content, so that every chip is French the learner supplied.
3. WHEN assembling the chip pool, THE Exercise_Builder SHALL exclude any Decoy Chunk whose trimmed, case-sensitive, accent-preserving text equals a target Chunk.
4. WHEN assembling the chip pool, THE Exercise_Builder SHALL include between 0 and 4 Decoy Chunks, so that the pool size is at most the number of target Chunks plus 4.
5. WHEN a learner-built line is checked, THE System SHALL use the existing up-to-three-attempts behavior, divergence messaging, and post-third-attempt reveal, unchanged from Authored_Content.
6. IF the same Learner_Content yields no other Source_Line from which to draw Decoys, THEN THE Exercise_Builder SHALL build the Build step from target Chunks alone and SHALL NOT introduce French from Authored_Content or from generation as decoys.

### Requirement 7: Construct a scene for learner content

**User Story:** As a learner, I want to know who I am and what counts as done before I speak, so that I can judge my own attempt (PRD §6.3).

#### Acceptance Criteria

1. WHEN exercises are built from Learner_Content, THE Exercise_Builder SHALL produce a Scene with all five parts (where, who you are, who you're talking to, what you want, what counts as done) populated and non-empty.
2. WHEN the Scene is composed, THE System SHALL write the Scene text in English, since the Scene is framing authored by the System and is not learner French.
3. WHERE the System cannot populate all five Scene parts from concrete references in the Learner_Content, THE System SHALL present a neutral default Scene whose success condition is keeping the conversation going (PRD §16.1), rather than fabricating specifics.
4. WHEN the Scene renders, THE System SHALL use the same five-part Scene layout used for Authored_Content.
5. WHEN the Scene is composed, THE System SHALL NOT copy or translate any Learner_Content French into the Scene text.

### Requirement 8: Judge Say-it attempts without generating French

**User Story:** As a learner, I want my spoken or typed attempt coached, not graded, so that I keep the honesty the rest of the app has (PRD §16.6, §17.2).

#### Acceptance Criteria

1. WHEN the learner submits a Say-it attempt for a learner-built exercise, THE System SHALL send the attempt, the learner's own reference Source_Line, and the Scene framing to the existing matcher endpoint.
2. WHEN the matcher returns within the request timeout, THE System SHALL present exactly one Verdict from the set {`works`, `thin`, `missed`, `not checked`}, with English coach notes, consistent with Authored_Content behavior.
3. WHEN a reference line is revealed after an attempt, THE System SHALL reveal the learner's own Source_Line and SHALL label it as a reference, never as a corrected or generated answer.
4. IF the matcher returns any French string it generated, THEN THE System SHALL discard that generated French and SHALL present only the Verdict, English notes, and the learner's own Source_Line (PRD §17.2).
5. IF the matcher returns a verdict value outside the set {`works`, `thin`, `missed`, `not checked`}, THEN THE System SHALL present the `not checked` Verdict rather than displaying the unexpected value.
6. IF the matcher is unavailable (no API key configured, a network or endpoint error, or no response within the request timeout), THEN THE System SHALL allow the learner to self-judge against their own revealed Source_Line and SHALL state plainly in English that automated feedback is unavailable (PRD §9).

### Requirement 9: Produce a Done screen from learner content

**User Story:** As a learner, I want to finish with my own sentences kept, so that I leave with evidence rather than a score (PRD §16.8).

#### Acceptance Criteria

1. WHEN a learner-built session ends, THE System SHALL present each Say-it attempt the learner submitted during that session paired with the reference Source_Line it was judged against, matched by the exercise identity used at attempt time.
2. WHEN the Done screen renders, THE System SHALL present the Word_Card phrases the learner tapped or saved during the session together with any attempt sentences the learner produced, drawing all French verbatim from Learner_Content and the learner's own attempts.
3. WHEN the Done screen renders, THE System SHALL NOT display any score, fraction, percentage, numeric count of attempts or correct answers, level, or streak (PRD §4.1, §16.8, §17.1).
4. WHEN the Done screen renders French, THE System SHALL show only French strings whose Provenance is Learner_Content or the learner's own attempts, and SHALL show no System-generated French.
5. IF the session ended with no learner attempts and no saved Word_Card phrases, THEN THE System SHALL present the Done screen with a plain-English message stating that no sentences were kept this session, rather than displaying an empty screen or fabricating evidence.

### Requirement 10: Preserve the no-invented-French property

**User Story:** As the product owner, I want this feature to keep the no-invented-French guarantee, so that accepting learner material does not quietly turn the app into a French generator (PRD §16.4, §17.2).

#### Acceptance Criteria

1. WHEN any French string is rendered in a learner-built exercise, THE System SHALL have recorded Provenance for that string identifying it as either verbatim Learner_Content or Authored_Content, and SHALL render only strings for which such Provenance exists.
2. THE System SHALL NOT generate, translate into, paraphrase, or auto-correct French at runtime for any learner-built exercise.
3. WHEN English is shown (Scene text, glosses, coach notes, availability messages), THE System SHALL present that text as English authored by the System and SHALL NOT present it as the learner's French.
4. WHEN Learner_Content French is re-presented as Chunks, Decoys, Transcript turns, or Word_Card phrases, THE System SHALL reproduce the characters exactly as supplied, including accents and contractions, without substitution, trimming of internal characters, or correction.
5. IF a transformation step cannot complete without inventing a French string that has no Learner_Content or Authored_Content Provenance, THEN THE System SHALL halt that step, leave already-recorded learner material unchanged, and inform the learner in plain English why the step could not complete, rather than inventing French.

### Requirement 11: Coexist with authored content

**User Story:** As a learner, I want learner-built sessions and supplied sessions to work the same way, so that bringing my own material feels native, not bolted on (PRD §6.1, §11).

#### Acceptance Criteria

1. WHEN a learner-built session runs, THE System SHALL advance through the same flow states (Set up → Choose → Read → Build → Say it → Done) in the same order used for Authored_Content, and SHALL leave the observable behavior of Authored_Content sessions unchanged.
2. WHEN Learner_Content is turned into exercises, THE Exercise_Builder SHALL produce data in the same shapes the app already consumes (Transcript turns, Word_Card entries, Scene, chip pools), such that the existing Read, Build, Say-it, and Done screens render it without a learner-built-specific code path at the render layer.
3. WHERE the learner has supplied no Learner_Content, THE System SHALL continue to run fully on Authored_Content (PRD §6.1 empty state).
4. WHEN existing word-card example gathering runs, THE System SHALL include learner Source_Lines as additional example sources while continuing to return Authored_Content examples unchanged for Authored_Content sessions.
5. WHEN a learner-built session renders any screen, THE System SHALL display only learner-facing labels and SHALL NOT display developer-facing notes, internal field names, component names, or Provenance identifiers as on-screen labels (PRD §5).

### Requirement 12: Keep learner content private and local

**User Story:** As a learner using an app with no account, I want my pasted material kept on my device, so that nothing personal is sent to a third party for authoring (PRD §13.3, §13.5).

#### Acceptance Criteria

1. WHEN Learner_Content is imported and transformed, THE System SHALL perform segmentation, chunking, word-card selection, and scene construction on the client, with no network request carrying Learner_Content for those steps, except the opt-in phrase picker described in 12.6.
2. WHEN Learner_Content is persisted, THE System SHALL store it in client-side local storage only, with no account creation and no cross-device sync (PRD §13.5).
3. THE System SHALL NOT transmit Learner_Content to any third party for the purpose of generating, translating, correcting, or reviewing French, except the opt-in request in 12.6 (phrase choice and English translation).
4. WHERE a Say-it attempt is sent to the matcher, THE System SHALL include only the attempt text, the learner's reference Source_Line, and the Scene framing in the request, and SHALL NOT include any other Learner_Content, consistent with current matcher behavior.
5. WHEN local storage is cleared, THE System SHALL on next launch behave as a first-run learner with no imported Learner_Content and SHALL offer the Authored_Content path, consistent with the local-only trade-off (PRD §13.5).
6. WHERE the learner explicitly ticks "Let Gemini pick the key phrases" (unticked by default, not remembered between visits) before importing, THE System MAY send the imported Source_Lines' French text to the app's own server, which asks Gemini to CHOOSE word-card phrases from it and to translate each line into English (shown per 4.6). The System SHALL: state on screen, before sending, that the text goes to Google; keep only suggested phrases that occur word for word in a Source_Line (never generated, translated, or corrected French — 12.3 still holds); fall back to client-side word-card selection, with a plain-English note, on any failure; and store the suggestions in client-side local storage only. With the box unticked, 12.1 applies unchanged.
