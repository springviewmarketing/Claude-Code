import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

/**
 * Snapshot history, stored as one JSON file.
 *
 * This is deliberately a flat file rather than a database: it diffs cleanly in
 * git, so the commit log doubles as an audit trail of every weekly reading, and
 * it restores by checkout if anything is ever corrupted.
 *
 * Shape:
 * {
 *   "version": 1,
 *   "snapshots": [
 *     { "takenAt": "2026-09-15T08:03:11.000Z",
 *       "places": { "<placeId>": { name, totalReviews, rating, status, ... } } }
 *   ]
 * }
 * Ordered oldest first.
 */

const EMPTY = { version: 1, snapshots: [] };

export async function loadHistory(file) {
  let raw;
  try {
    raw = await readFile(file, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return structuredClone(EMPTY);
    throw error;
  }
  const parsed = JSON.parse(raw);
  const snapshots = (parsed.snapshots ?? [])
    .slice()
    .sort((a, b) => Date.parse(a.takenAt) - Date.parse(b.takenAt));
  return { version: parsed.version ?? 1, snapshots };
}

export async function saveHistory(file, history) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(history, null, 2)}\n`, 'utf8');
}

/**
 * Add a reading to the history.
 *
 * Two snapshots taken within `minGapHours` of each other are merged rather than
 * appended, so a re-run after a partial failure tops up the same reading instead
 * of creating a zero-delta week that would break the streak maths.
 */
export function addSnapshot(history, { takenAt, places }, { minGapHours = 24 } = {}) {
  const at = Date.parse(takenAt);
  const last = history.snapshots.at(-1);
  if (last && Math.abs(at - Date.parse(last.takenAt)) < minGapHours * 3600_000) {
    // Only overwrite entries the new run actually read successfully; keep the
    // earlier good reading for any place that failed this time.
    const merged = { ...last.places };
    for (const [placeId, record] of Object.entries(places)) {
      if (record.status === 'ok' || !merged[placeId]) merged[placeId] = record;
    }
    last.places = merged;
    last.takenAt = takenAt;
    return { snapshot: last, merged: true };
  }
  const snapshot = { takenAt, places };
  history.snapshots.push(snapshot);
  history.snapshots.sort((a, b) => Date.parse(a.takenAt) - Date.parse(b.takenAt));
  return { snapshot, merged: false };
}

/** Turn API results into the per-place map a snapshot stores. */
export function toPlaceMap(results) {
  const places = {};
  for (const result of results) {
    if (result.status === 'ok') {
      places[result.placeId] = {
        name: result.name ?? result.configName,
        totalReviews: result.totalReviews,
        rating: result.rating,
        businessStatus: result.businessStatus,
        status: 'ok',
        ...(result.currentPlaceId && result.currentPlaceId !== result.placeId
          ? { currentPlaceId: result.currentPlaceId }
          : {}),
      };
    } else {
      places[result.placeId] = {
        name: result.configName,
        status: result.status,
        error: result.error,
      };
    }
  }
  return places;
}
