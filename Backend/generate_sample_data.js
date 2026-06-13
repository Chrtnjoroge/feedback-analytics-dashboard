// One-off utility: regenerates feedback.csv with varied synthetic data
// for analytics practice. Run with: node generate_sample_data.js
const fs = require('fs');
const path = require('path');

const CSV_HEADERS = [
  'date', 'guests', 'nationality', 'source', 'source_details',
  'nature_trail', 'garden_walk', 'petting_zoo', 'family_games_area', 'fishing_pond',
  'tea_rating', 'lunch_rating', 'suggestions',
];

const ROW_COUNT = 60;
const DAYS_BACK = 180;

// Weighted pools: repeat values to bias the distribution
const NATIONALITIES = [
  'Kenyan', 'Kenyan', 'Kenyan', 'Kenyan',
  'American', 'American',
  'British', 'British',
  'German', 'French', 'Indian', 'Chinese',
  'Tanzanian', 'Ugandan', 'Dutch', 'Canadian', 'Australian', 'South African', 'Italian',
];

const SOURCES = [
  'Google search', 'Google search', 'Google search', 'Google search',
  'Instagram', 'Instagram', 'Instagram',
  'Tiktok', 'Tiktok',
  'Referral', 'Referral',
  'Other',
];

const OTHER_SOURCE_DETAILS = [
  'Travel agency brochure',
  'Newspaper article',
  'Drove past and stopped in',
  'School trip flyer',
  'Hotel concierge recommendation',
];

const GUEST_COUNTS = [1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4, 5, 6, 8, 10];

const TEA_COMMENTS = {
  high: [
    'Excellent matcha and herbal blends!',
    'Loved the tea tasting, very fresh.',
    'Best tea selection we have had on a farm tour.',
    'Great variety, bought some to take home.',
  ],
  mid: [
    'Tea was good, a bit weak.',
    'Decent selection, nothing special.',
    'Enjoyed it but wanted more options.',
  ],
  low: [
    'Tea was lukewarm by the time it was served.',
    'Not much variety on offer.',
    'Could be presented better.',
  ],
};

const LUNCH_COMMENTS = {
  high: [
    'Delicious vegetarian spread!',
    'Loved the variety, very fresh ingredients.',
    'Best farm lunch we have had.',
    'Generous portions and tasty.',
  ],
  mid: [
    'Good food, portions were a bit small.',
    'Tasty but limited options for kids.',
    'Decent meal, average service.',
  ],
  low: [
    'Food was cold by the time we ate.',
    'Limited choices for vegetarians.',
    'Service was slow.',
  ],
};

const SUGGESTIONS = [
  'More shaded seating areas would help.',
  'Add more interactive activities for adults.',
  'Better signage for directions around the farm.',
  'Extend the fishing time slot.',
  'Offer a guided tour option in French.',
  'More vegetarian options at lunch.',
  'Add a small gift shop for tea products.',
  'Everything was great, keep it up!',
  'Could use more shade near the animal pens.',
  'A map of the farm at the entrance would help.',
  'More frequent feeding sessions for the animals.',
  'Loved it, will recommend to friends!',
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Ratings cluster around `mean` (1-5) but still spread across the full range.
function ratingAround(mean) {
  const noise = (Math.random() + Math.random() + Math.random()) - 1.5; // ~[-1.5, 1.5]
  return Math.max(1, Math.min(5, Math.round(mean + noise)));
}

function ratingBand(value) {
  if (value >= 4) return 'high';
  if (value === 3) return 'mid';
  return 'low';
}

function randomDate() {
  const offsetDays = Math.floor(Math.random() * DAYS_BACK);
  const d = new Date(Date.now() - offsetDays * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

function csvEscape(value) {
  const str = String(value ?? '');
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// Each activity gets its own average rating so the "average per activity"
// chart shows real differences instead of near-identical bars.
const ACTIVITY_MEANS = {
  nature_trail: 4.3,
  garden_walk: 4.1,
  petting_zoo: 3.6,
  family_games_area: 3.8,
  fishing_pond: 4.0,
};

const rows = [];

for (let i = 0; i < ROW_COUNT; i++) {
  const source = pick(SOURCES);
  const sourceDetails = source === 'Other' ? pick(OTHER_SOURCE_DETAILS) : '';

  const ratings = {};
  for (const [activity, mean] of Object.entries(ACTIVITY_MEANS)) {
    ratings[activity] = ratingAround(mean);
  }

  const teaRating = pick(TEA_COMMENTS[ratingBand(ratings.nature_trail)]);
  const lunchScore = Math.round((ratings.garden_walk + ratings.petting_zoo) / 2);
  const lunchRating = pick(LUNCH_COMMENTS[ratingBand(lunchScore)]);

  rows.push([
    randomDate(),
    pick(GUEST_COUNTS),
    pick(NATIONALITIES),
    source,
    sourceDetails,
    ratings.nature_trail,
    ratings.garden_walk,
    ratings.petting_zoo,
    ratings.family_games_area,
    ratings.fishing_pond,
    teaRating,
    lunchRating,
    pick(SUGGESTIONS),
  ].map(csvEscape).join(','));
}

rows.sort(); // date is the first field (YYYY-MM-DD), so this also sorts chronologically

const out = [CSV_HEADERS.join(','), ...rows].join('\n') + '\n';
fs.writeFileSync(path.join(__dirname, 'feedback.csv'), out);

// Quick console summary so variety can be eyeballed without opening Jupyter.
console.log(`Wrote ${rows.length} synthetic rows to feedback.csv`);

const sourceCounts = {};
const nationalityCounts = {};
const activityTotals = {};
for (const activity of Object.keys(ACTIVITY_MEANS)) activityTotals[activity] = 0;

for (const row of rows) {
  const fields = row.split(',');
  sourceCounts[fields[3]] = (sourceCounts[fields[3]] || 0) + 1;
  nationalityCounts[fields[2]] = (nationalityCounts[fields[2]] || 0) + 1;
  Object.keys(ACTIVITY_MEANS).forEach((activity, idx) => {
    activityTotals[activity] += Number(fields[5 + idx]);
  });
}

console.log('\nSource breakdown:', sourceCounts);
console.log('Nationality breakdown:', nationalityCounts);
console.log('Average rating per activity:');
for (const [activity, total] of Object.entries(activityTotals)) {
  console.log(`  ${activity}: ${(total / rows.length).toFixed(2)}`);
}
