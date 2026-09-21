import test from 'node:test';
import assert from 'node:assert/strict';
import { looksLikeOptician, shortlist } from '../src/nearby.js';

/**
 * Real names returned by a live 5 mile search around a Conisbrough practice.
 * Text Search returned all of these for "opticians", "optometrist" and
 * "eye care", which is exactly why the name gate exists.
 */
const REAL_OPTICIANS = [
  'Murgatroyd Opticians Ltd',
  'Moorhouse Opticians',
  'Optical Home Eye Tests',
  'Rayner Opticians',
  'Specsavers Opticians and Audiologists - Mexborough',
  'Parkhurst and Co Styling Opticians',
  'Five Star Optical Co',
  'Vision Express Opticians at Tesco - Doncaster, Balby',
  'BRUMPTON OPTICIANS LTD',
  'Dudley & Severn Opticians',
  'ASDA Opticians',
  'Martyn Kemp Opticians',
  'Eye Street Opticians Ltd',
  'T English Opticians',
  'Wickersley Eye Clinic',
  'Auckland Opticians Ltd',
  'Staples Opticians & Hearing Care',
  'Cotler & Bell Opticians',
  'Parkhurst Opticians',
  'Boots Opticians',
  'Edwards & Walker Opticians',
  'Scrivens Opticians & Hearing Care',
  'Specsavers Opticians and Audiologists - Doncaster',
  'Vision Express Opticians - Doncaster',
  'Priority Eyecare',
];

const NOT_OPTICIANS = [
  'Station Rd Parking',
  'Tesco Extra',
  'Morrisons',
  'Asda Rotherham Superstore',
  'Connect Healthcare Rotherham',
  'Boots',
  'NHS Doncaster Clinical Commissioning Group',
  'Rawmarsh Health Centre',
  'Boots Hearingcare Doncaster North Bridge Road',
  'SpaMedica Doncaster',
];

test('every real optician from the live search is recognised', () => {
  const missed = REAL_OPTICIANS.filter((name) => !looksLikeOptician({ name }));
  assert.deepEqual(missed, [], 'these are opticians and were rejected');
});

test('nothing else from the live search gets in', () => {
  const wrong = NOT_OPTICIANS.filter((name) => looksLikeOptician({ name }));
  assert.deepEqual(wrong, [], 'these are not opticians and were accepted');
});

test('a hearing branch of an optical chain is not an opticians practice', () => {
  assert.equal(looksLikeOptician({ name: 'Boots Hearingcare Doncaster' }), false);
  assert.equal(looksLikeOptician({ name: 'Specsavers Hearing Centre' }), true, 'Specsavers is still the optical brand');
});

test('a practice whose name gives nothing away is caught by Google type label', () => {
  assert.equal(looksLikeOptician({ name: 'Clearsight Ltd' }), false);
  assert.equal(looksLikeOptician({ name: 'Clearsight Ltd', primaryTypeLabel: 'Optician' }), true);
});

test('a supermarket is rejected on type even when its name mentions optical', () => {
  assert.equal(
    looksLikeOptician({ name: 'Tesco Extra Optical Department', primaryType: 'supermarket' }),
    false
  );
  assert.equal(looksLikeOptician({ name: 'ASDA Opticians', primaryType: 'store' }), true);
});

test('a health centre is kept out of the shortlist whatever its review count', () => {
  const places = [
    { placeId: 'us', name: 'Us', totalReviews: 11, isOptician: true },
    { placeId: 'health', name: 'Rawmarsh Health Centre', totalReviews: 89, isOptician: false },
    { placeId: 'nhs', name: 'NHS Doncaster CCG', totalReviews: 19, isOptician: false },
    { placeId: 'real', name: 'Priority Eyecare', totalReviews: 16, isOptician: true },
  ];
  const result = shortlist(places, { anchorPlaceId: 'us', anchorTotal: 11, limit: 5 });
  assert.deepEqual(result.ladder.map((p) => p.placeId), ['real']);
  assert.equal(result.notOpticians.length, 2);
});

test('the full live result set produces a sensible ladder', () => {
  // Name, reviews, and whether it is genuinely an opticians practice.
  const live = [
    ['Murgatroyd Opticians Ltd', 11], ['Moorhouse Opticians', 39], ['Optical Home Eye Tests', 0],
    ['Rayner Opticians', 1], ['Specsavers Opticians and Audiologists - Mexborough', 544],
    ['Station Rd Parking', 1], ['Parkhurst and Co Styling Opticians', 21], ['SpaMedica Doncaster', 23],
    ['Five Star Optical Co', 2], ['Vision Express Opticians at Tesco - Doncaster, Balby', 472],
    ['Tesco Extra', 562], ['Morrisons', 3122], ['BRUMPTON OPTICIANS LTD', 9],
    ['Dudley & Severn Opticians', 10], ['ASDA Opticians', 32], ['Asda Rotherham Superstore', 597],
    ['Connect Healthcare Rotherham', 2], ['Martyn Kemp Opticians', 9], ['Eye Street Opticians Ltd', 1],
    ['NHS Doncaster Clinical Commissioning Group', 19], ['T English Opticians', 11],
    ['Wickersley Eye Clinic', 47], ['Rawmarsh Health Centre', 89], ['Auckland Opticians Ltd', 6],
    ['Staples Opticians & Hearing Care', 91], ['Cotler & Bell Opticians', 101],
    ['Boots Hearingcare Doncaster North Bridge Road', 5], ['Parkhurst Opticians', 0],
    ['Boots Opticians', 975], ['Edwards & Walker Opticians', 160],
    ['Scrivens Opticians & Hearing Care', 115], ['Boots', 946],
    ['Specsavers Opticians and Audiologists - Doncaster', 1195],
    ['Vision Express Opticians - Doncaster', 623], ['Priority Eyecare', 16],
  ].map(([name, totalReviews], i) => ({
    placeId: name === 'Murgatroyd Opticians Ltd' ? 'anchor' : `p${i}`,
    name,
    totalReviews,
    isOptician: looksLikeOptician({ name }),
  }));

  const result = shortlist(live, { anchorPlaceId: 'anchor', anchorTotal: 11, limit: 5 });
  const names = result.ladder.map((p) => p.name);

  assert.deepEqual(names, [
    'T English Opticians',
    'Priority Eyecare',
    'Parkhurst and Co Styling Opticians',
    'ASDA Opticians',
    'Moorhouse Opticians',
  ]);
  for (const junk of ['Rawmarsh Health Centre', 'NHS Doncaster Clinical Commissioning Group', 'SpaMedica Doncaster', 'Morrisons']) {
    assert.equal(names.includes(junk), false, `${junk} must never be a competitor`);
  }
});

// --- chains ---------------------------------------------------------------

import { isChain } from '../src/nearby.js';

test('the chains and supermarket concessions from the live search are recognised', () => {
  const chains = [
    'Specsavers Opticians and Audiologists - Doncaster',
    'Specsavers Opticians and Audiologists - Mexborough',
    'Boots Opticians',
    'Vision Express Opticians - Doncaster',
    'Vision Express Opticians at Tesco - Doncaster, Balby',
    'ASDA Opticians',
    'Scrivens Opticians & Hearing Care',
    'Tesco Extra',
    'Morrisons',
    'SpaMedica Doncaster',
  ];
  const missed = chains.filter((name) => !isChain({ name }));
  assert.deepEqual(missed, [], 'these are chains and were not recognised');
});

test('independents are never mistaken for chains', () => {
  const independents = [
    'Murgatroyd Opticians Ltd',
    'Moorhouse Opticians',
    'T English Opticians',
    'Priority Eyecare',
    'Parkhurst and Co Styling Opticians',
    'Wickersley Eye Clinic',
    'Cotler & Bell Opticians',
    'Edwards & Walker Opticians',
    'Dudley & Severn Opticians',
    'Martyn Kemp Opticians',
    'BRUMPTON OPTICIANS LTD',
    'Auckland Opticians Ltd',
    'Staples Opticians & Hearing Care',
    'Rayner Opticians',
    'Five Star Optical Co',
  ];
  const wrong = independents.filter((name) => isChain({ name }));
  assert.deepEqual(wrong, [], 'these are independents and were called chains');
});

test('a chain is excluded however large the client is, which size alone could not do', () => {
  const build = (anchorTotal) => [
    { placeId: 'us', name: 'Us', totalReviews: anchorTotal, isOptician: true, isChain: false },
    { placeId: 'spec', name: 'Specsavers Doncaster', totalReviews: 1195, isOptician: true, isChain: true },
    { placeId: 'boots', name: 'Boots Opticians', totalReviews: 975, isOptician: true, isChain: true },
    { placeId: 'indie', name: 'Cotler & Bell Opticians', totalReviews: 101, isOptician: true, isChain: false },
  ];

  // The bug: on 11 reviews the ceiling hid the problem; on 150 it did not.
  for (const anchorTotal of [11, 50, 100, 150, 300]) {
    const { ladder, chains } = shortlist(build(anchorTotal), { anchorPlaceId: 'us', anchorTotal, limit: 5 });
    assert.equal(
      ladder.some((p) => p.isChain),
      false,
      `a chain reached the ladder for a client on ${anchorTotal} reviews`
    );
    assert.equal(chains.length, 2);
  }
});

test('the independent still gets through for a larger client', () => {
  const places = [
    { placeId: 'us', name: 'Us', totalReviews: 150, isOptician: true, isChain: false },
    { placeId: 'spec', name: 'Specsavers', totalReviews: 1195, isOptician: true, isChain: true },
    { placeId: 'indie', name: 'Cotler & Bell Opticians', totalReviews: 200, isOptician: true, isChain: false },
  ];
  const { ladder } = shortlist(places, { anchorPlaceId: 'us', anchorTotal: 150, limit: 5 });
  assert.deepEqual(ladder.map((p) => p.name), ['Cotler & Bell Opticians']);
});

test('chains can be put back deliberately, for a practice big enough to want them', () => {
  const places = [
    { placeId: 'us', name: 'Us', totalReviews: 400, isOptician: true, isChain: false },
    { placeId: 'spec', name: 'Specsavers', totalReviews: 1195, isOptician: true, isChain: true },
  ];
  const { ladder } = shortlist(places, { anchorPlaceId: 'us', anchorTotal: 400, limit: 5, includeChains: true });
  assert.deepEqual(ladder.map((p) => p.name), ['Specsavers']);
});
