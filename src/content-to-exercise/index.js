// index.js — content-to-exercise barrel.
//
// Re-exports the public surface of the content-to-exercise feature so callers
// can `import { importContent, buildExercises, ... } from "src/content-to-exercise"`.
// Types live in ./types.js (JSDoc only). The no-invented-French containment
// helper is exported for reuse by the builder transforms and property tests.

export { isVerbatimSliceOf } from "./containment.js";

export {
  importContent,
  segmentSourceLines,
  attributeSourceLines,
  capInput,
  detectSpeakerPrefix,
  MAX_INPUT_CHARS,
  DEFAULT_SPEAKER,
} from "./importer.js";

export {
  buildTranscript,
  selectWordCards,
  chunksOf,
  buildPool,
  buildScene,
  buildExercises,
  wordCardsFromPhrases,
  degradedReasons,
} from "./builder.js";

export { judgeLearnerAttempt } from "./matcher-adapter.js";

export { saveLearnerContent, loadLearnerContent } from "./persistence.js";
