/**
 * Local Lore scoring primitives.
 *
 * This module is deliberately provider- and framework-agnostic.  The API
 * should receive a server-computed distance to the stored answer geometry;
 * the browser must never choose a scoring profile or submit a score.
 */

export const SCORING_RULES_VERSION = 'scoring_v1';
export const MAX_ROUND_SCORE = 1000;

export const ASSISTANCE_FACTORS = Object.freeze({
  0: 1,
  1: 0.8,
  2: 0.6,
});

/**
 * Initial profiles from the approved blueprint.  These are versioned domain
 * defaults, not a promise that every source geometry has this accuracy.
 */
export const SCORING_PROFILES = Object.freeze({
  neighborhood_pin_v2: Object.freeze({
    id: 'neighborhood_pin_v2',
    method: 'pin',
    toleranceMeters: 50,
    falloffMeters: 1000,
    label: 'Neighborhood proximity',
  }),
  intersection_pin_v1: Object.freeze({
    id: 'intersection_pin_v1',
    method: 'pin',
    toleranceMeters: 25,
    falloffMeters: 125,
    label: 'Simple urban intersection',
  }),
  street_line_v1: Object.freeze({
    id: 'street_line_v1',
    method: 'pin',
    toleranceMeters: 20,
    falloffMeters: 150,
    label: 'Named street line',
  }),
  public_entrance_pin_v1: Object.freeze({
    id: 'public_entrance_pin_v1',
    method: 'pin',
    toleranceMeters: 20,
    falloffMeters: 75,
    label: 'Public entrance or address',
  }),
  landmark_pin_v1: Object.freeze({
    id: 'landmark_pin_v1',
    method: 'pin',
    toleranceMeters: 15,
    falloffMeters: 100,
    label: 'Reviewed landmark footprint plus buffer',
  }),
});

const VALID_OUTCOMES = new Set([
  'answered',
  'skipped',
  'timed_out',
  'system_void',
]);

function assertFiniteNonNegative(value, name) {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be a finite non-negative number`);
  }
}

function normalizeOutcome(outcome = 'answered') {
  if (!VALID_OUTCOMES.has(outcome)) {
    throw new RangeError(`Unsupported round outcome: ${outcome}`);
  }
  return outcome;
}

export function getScoringProfile(profileId = 'intersection_pin_v1') {
  const profile = SCORING_PROFILES[profileId];
  if (!profile) throw new RangeError(`Unknown scoring profile: ${profileId}`);
  return profile;
}

export function getAssistanceFactor(assistanceLevel = 0) {
  if (!Number.isInteger(assistanceLevel) || !(assistanceLevel in ASSISTANCE_FACTORS)) {
    throw new RangeError('assistanceLevel must be an integer from 0 through 2');
  }
  return ASSISTANCE_FACTORS[assistanceLevel];
}

function voidResult({ method, profileId, outcome }) {
  return Object.freeze({
    rulesVersion: SCORING_RULES_VERSION,
    method,
    profileId,
    outcome,
    counted: false,
    score: null,
    maxScore: null,
    quality: null,
    distanceMeters: null,
    assistanceLevel: null,
    assistanceFactor: null,
  });
}

function zeroResult({ method, profileId, outcome, assistanceLevel = 0 }) {
  const factor = getAssistanceFactor(assistanceLevel);
  return Object.freeze({
    rulesVersion: SCORING_RULES_VERSION,
    method,
    profileId,
    outcome,
    counted: true,
    score: 0,
    maxScore: MAX_ROUND_SCORE,
    quality: 0,
    distanceMeters: null,
    assistanceLevel,
    assistanceFactor: factor,
  });
}

/**
 * Score a pin against the distance from the submitted point to the approved
 * answer geometry.  The geometry calculation belongs on the server (normally
 * PostGIS); this function only applies the immutable profile formula.
 */
export function scorePin({
  distanceMeters,
  profileId = 'intersection_pin_v1',
  assistanceLevel = 0,
  outcome = 'answered',
} = {}) {
  const normalizedOutcome = normalizeOutcome(outcome);
  const profile = getScoringProfile(profileId);
  if (profile.method !== 'pin') {
    throw new RangeError(`Profile ${profileId} is not a pin profile`);
  }
  if (normalizedOutcome === 'system_void') {
    return voidResult({ method: 'pin', profileId, outcome: normalizedOutcome });
  }
  if (normalizedOutcome === 'skipped' || normalizedOutcome === 'timed_out') {
    return zeroResult({
      method: 'pin',
      profileId,
      outcome: normalizedOutcome,
      assistanceLevel,
    });
  }

  assertFiniteNonNegative(distanceMeters, 'distanceMeters');
  const assistanceFactor = getAssistanceFactor(assistanceLevel);
  const cutoff = profile.toleranceMeters + 6 * profile.falloffMeters;
  const quality = distanceMeters >= cutoff
    ? 0
    : Math.exp(-Math.max(0, distanceMeters - profile.toleranceMeters) / profile.falloffMeters);

  return Object.freeze({
    rulesVersion: SCORING_RULES_VERSION,
    method: 'pin',
    profileId,
    outcome: normalizedOutcome,
    counted: true,
    score: Math.round(MAX_ROUND_SCORE * quality * assistanceFactor),
    maxScore: MAX_ROUND_SCORE,
    quality,
    distanceMeters,
    toleranceMeters: profile.toleranceMeters,
    falloffMeters: profile.falloffMeters,
    assistanceLevel,
    assistanceFactor,
  });
}

/**
 * Named answers are intentionally all-or-nothing in v1.  Partial credit for
 * a related street belongs to a separately versioned profile.
 */
export function scoreNamed({
  accepted,
  profileId = 'intersection_named_v1',
  assistanceLevel = 0,
  outcome = 'answered',
} = {}) {
  const normalizedOutcome = normalizeOutcome(outcome);
  if (normalizedOutcome === 'system_void') {
    return voidResult({ method: 'named', profileId, outcome: normalizedOutcome });
  }
  if (normalizedOutcome === 'skipped' || normalizedOutcome === 'timed_out') {
    return zeroResult({
      method: 'named',
      profileId,
      outcome: normalizedOutcome,
      assistanceLevel,
    });
  }
  if (typeof accepted !== 'boolean') {
    throw new TypeError('accepted must be a boolean for a named answer');
  }

  const assistanceFactor = getAssistanceFactor(assistanceLevel);
  const quality = accepted ? 1 : 0;
  return Object.freeze({
    rulesVersion: SCORING_RULES_VERSION,
    method: 'named',
    profileId,
    outcome: normalizedOutcome,
    counted: true,
    score: Math.round(MAX_ROUND_SCORE * quality * assistanceFactor),
    maxScore: MAX_ROUND_SCORE,
    quality,
    assistanceLevel,
    assistanceFactor,
  });
}

export function scoreRound({ method, ...input } = {}) {
  if (method === 'pin') return scorePin(input);
  if (method === 'named') return scoreNamed(input);
  throw new RangeError(`Unsupported answer method: ${method}`);
}

/**
 * Summarize a set without allowing void rounds into either the score or the
 * denominator.  A skipped/timed-out round is counted as a valid zero.
 */
export function summarizeSet(roundResults = []) {
  if (!Array.isArray(roundResults)) throw new TypeError('roundResults must be an array');
  const counted = roundResults.filter((result) => result && result.counted === true);
  const voidCount = roundResults.filter((result) => result && result.counted === false).length;
  const totalScore = counted.reduce((sum, result) => sum + result.score, 0);
  const maxScore = counted.length * MAX_ROUND_SCORE;
  const qualitySum = counted.reduce((sum, result) => sum + (result.quality ?? 0), 0);
  return Object.freeze({
    rulesVersion: SCORING_RULES_VERSION,
    roundCount: roundResults.length,
    countedRoundCount: counted.length,
    voidCount,
    totalScore,
    maxScore,
    meanQuality: counted.length ? qualitySum / counted.length : null,
    scorePercent: maxScore ? totalScore / maxScore : null,
  });
}
