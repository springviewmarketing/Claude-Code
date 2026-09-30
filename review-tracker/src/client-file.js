/**
 * Adding a practice to config/practices.json without disturbing the rest.
 *
 * One file holds every client, so this has to merge rather than write. Getting
 * it wrong silently drops a client from the weekly run, which nobody would
 * notice until a report stopped arriving.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { validateConfig } from './config.js';

const DEFAULT_AGENCY = { name: 'Spring View Marketing', regionCode: 'GB', languageCode: 'en-GB' };

export function slugify(name) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'practice'
  );
}

/**
 * Where a client's report is published, relative to the site root.
 *
 * A plain readable path. Reports used to carry a random token in the filename,
 * back when the repository was going to be private and the URL was the only
 * thing keeping a page away from the competitors it named. The repository is
 * public, so the token was protecting nothing while making every link ugly
 * enough that Tom did not want to send it.
 *
 * Published as a directory index so the address ends at the practice name with
 * no .html hanging off it.
 */
export const reportPath = (client) => `${client.slug ?? client.id}/index.html`;

/** The address a person types or clicks, which is the path without index.html. */
export const reportHref = (client) => `${client.slug ?? client.id}/`;

export async function readClientFile(file) {
  try {
    const parsed = JSON.parse(await readFile(file, 'utf8'));
    return { agency: parsed.agency ?? DEFAULT_AGENCY, clients: parsed.clients ?? [] };
  } catch (error) {
    if (error.code === 'ENOENT') return { agency: DEFAULT_AGENCY, clients: [] };
    // A malformed file must never be silently replaced with an empty one.
    const wrapped = new Error(
      `config at ${file} could not be read: ${error.message}. Fix or delete it before adding a client.`
    );
    wrapped.expected = true;
    throw wrapped;
  }
}

/**
 * Put `client` into the config, replacing any entry with the same id or the
 * same place ID so re-running updates a practice rather than duplicating it.
 */
export function upsertClient(config, client) {
  const previous = config.clients.find(
    (existing) => existing.id === client.id || existing.placeId === client.placeId
  );
  const clients = config.clients.filter(
    (existing) => existing.id !== client.id && existing.placeId !== client.placeId
  );
  const replaced = Boolean(previous);
  // Keep the token and the contact address across a re-run, or an already
  // circulated link would break and the address would have to be typed again.
  clients.push({
    ...client,
    slug: client.slug ?? previous?.slug ?? slugify(client.name),
    ...(previous?.brand && !client.brand ? { brand: previous.brand } : {}),
    ...(previous?.branch && !client.branch ? { branch: previous.branch } : {}),
    ...(previous?.contactEmail && !client.contactEmail ? { contactEmail: previous.contactEmail } : {}),
  });
  clients.sort((a, b) => a.name.localeCompare(b.name));
  return { config: { ...config, clients }, replaced };
}

export async function writeClientFile(file, config) {
  validateConfig(config);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
}
