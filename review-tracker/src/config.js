import { readFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Minimal .env reader. Avoids a dotenv dependency; the tool ships with none.
 * Real environment variables always win over the file.
 */
export function loadEnv(root) {
  const file = path.join(root, '.env');
  if (!existsSync(file)) return;
  for (const raw of readFileSync(file, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

/** Every place we need to call the API for, deduplicated across all clients. */
export function allPlaces(config) {
  const seen = new Map();
  for (const client of config.clients) {
    const entries = [
      { placeId: client.placeId, name: client.name },
      ...(client.competitors ?? []),
    ];
    for (const entry of entries) {
      if (!entry?.placeId) continue;
      if (!seen.has(entry.placeId)) seen.set(entry.placeId, entry.name ?? entry.placeId);
    }
  }
  return [...seen].map(([placeId, name]) => ({ placeId, name }));
}

function fail(message) {
  const error = new Error(message);
  error.expected = true;
  throw error;
}

export function validateConfig(config) {
  if (!config || typeof config !== 'object') fail('Config is not an object.');
  if (!Array.isArray(config.clients) || config.clients.length === 0) {
    fail('Config needs a non-empty "clients" array.');
  }

  const clientIds = new Set();
  for (const [index, client] of config.clients.entries()) {
    const where = `clients[${index}]`;
    if (!client.id) fail(`${where} is missing "id".`);
    if (clientIds.has(client.id)) fail(`Duplicate client id "${client.id}".`);
    clientIds.add(client.id);
    if (!/^[a-z0-9-]+$/.test(client.id)) {
      fail(`Client id "${client.id}" must be lowercase letters, numbers and hyphens only (it becomes a filename).`);
    }
    if (!client.name) fail(`${where} ("${client.id}") is missing "name".`);
    if (!client.placeId) fail(`${where} ("${client.id}") is missing "placeId". Run: npm run discover -- "<practice name and town>"`);

    const competitors = client.competitors ?? [];
    if (!Array.isArray(competitors)) fail(`${where}.competitors must be an array.`);
    const placeIds = new Set([client.placeId]);
    for (const [j, rival] of competitors.entries()) {
      if (!rival?.placeId) fail(`${where}.competitors[${j}] is missing "placeId".`);
      if (!rival?.name) fail(`${where}.competitors[${j}] is missing "name".`);
      if (placeIds.has(rival.placeId)) {
        fail(`${where} lists place ID ${rival.placeId} twice (a competitor duplicates the practice or another competitor).`);
      }
      placeIds.add(rival.placeId);
    }
  }
  return config;
}

export async function loadConfig(file) {
  let raw;
  try {
    raw = await readFile(file, 'utf8');
  } catch {
    fail(`No config at ${file}. Copy config/practices.example.json to config/practices.json and fill it in.`);
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    fail(`Config at ${file} is not valid JSON: ${error.message}`);
  }
  return validateConfig(parsed);
}
