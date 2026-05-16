import { pool } from '../db.js';

function slugify(label) {
  return String(label || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function exerciseMatches(name, exerciseSlug, exerciseLabel) {
  const n = String(name || '').trim().toLowerCase();
  if (!n) return false;
  let needle = String(exerciseLabel || '').trim().toLowerCase();
  if (!needle && exerciseSlug) needle = String(exerciseSlug).replace(/-/g, ' ');
  if (!needle) return false;
  if (n === needle) return true;
  if (n.includes(needle) || needle.includes(n)) return true;
  const slugFromName = slugify(name);
  return !!(
    exerciseSlug &&
    slugFromName &&
    (slugFromName === exerciseSlug ||
      slugFromName.includes(exerciseSlug) ||
      exerciseSlug.includes(slugFromName))
  );
}

function bestLiftFromExercise(ex) {
  if (!ex || typeof ex !== 'object') return null;
  let bestWeight = null;
  let repsAtBest = null;

  function consider(weightRaw, repsRaw) {
    const w = parseFloat(weightRaw);
    if (isNaN(w) || w <= 0) return;
    const r = parseFloat(repsRaw);
    const reps = !isNaN(r) && r > 0 ? r : null;
    if (bestWeight == null || w > bestWeight) {
      bestWeight = w;
      repsAtBest = reps;
    }
  }

  consider(ex.weight, ex.reps);
  const setWeights = Array.isArray(ex.setWeights) ? ex.setWeights : [];
  const setReps = Array.isArray(ex.setReps) ? ex.setReps : [];
  setWeights.forEach((raw, i) => {
    consider(raw, setReps[i]);
  });
  if (bestWeight == null) return null;
  return { liftWeight: bestWeight, reps: repsAtBest };
}

function scanPayloadForMaxLift(payload, exerciseSlug, exerciseLabel) {
  if (!payload || typeof payload !== 'object') return null;
  const exercises = Array.isArray(payload.exercises) ? payload.exercises : [];
  let best = null;
  for (const ex of exercises) {
    if (!exerciseMatches(ex.name, exerciseSlug, exerciseLabel)) continue;
    const lift = bestLiftFromExercise(ex);
    if (!lift) continue;
    if (
      best == null ||
      lift.liftWeight > best.liftWeight ||
      (lift.liftWeight === best.liftWeight &&
        lift.reps != null &&
        (best.reps == null || lift.reps > best.reps))
    ) {
      best = lift;
    }
  }
  return best;
}

/**
 * @param {{ exercise?: string, label?: string }} opts
 * @returns {Promise<Array<{ id: number, username: string, liftWeight: number|null, reps: number|null }>>}
 */
export async function getExerciseLeaderboard(opts = {}) {
  const exerciseSlug = slugify(opts.exercise || 'bench') || 'bench';
  const exerciseLabel = String(opts.label || opts.exercise || 'bench').trim();

  const { rows: users } = await pool.query(
    `SELECT id, username FROM users ORDER BY id ASC`
  );
  const { rows: workouts } = await pool.query(
    `SELECT user_id, payload FROM workouts`
  );

  const liftByUser = new Map();
  for (const row of workouts) {
    const uid = row.user_id;
    if (uid == null) continue;
    const lift = scanPayloadForMaxLift(row.payload, exerciseSlug, exerciseLabel);
    if (lift == null) continue;
    const prev = liftByUser.get(uid);
    if (
      prev == null ||
      lift.liftWeight > prev.liftWeight ||
      (lift.liftWeight === prev.liftWeight &&
        lift.reps != null &&
        (prev.reps == null || lift.reps > prev.reps))
    ) {
      liftByUser.set(uid, lift);
    }
  }

  return users.map((u) => {
    const lift = liftByUser.get(u.id);
    return {
      id: u.id,
      username: u.username,
      liftWeight: lift ? lift.liftWeight : null,
      reps: lift && lift.reps != null ? lift.reps : null,
    };
  });
}
