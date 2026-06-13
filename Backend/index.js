const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const DATA_FILE = process.env.FEEDBACK_DATA_FILE
  ? path.resolve(process.env.FEEDBACK_DATA_FILE)
  : path.join(__dirname, 'feedback.csv');

const CSV_HEADERS = [
  'date', 'guests', 'nationality', 'source', 'source_details',
  'nature_trail', 'garden_walk', 'petting_zoo', 'family_games_area', 'fishing_pond',
  'tea_rating', 'lunch_rating', 'suggestions',
];

const SOURCES = ['Google search', 'Instagram', 'Tiktok', 'Referral', 'Other'];
const ACTIVITY_FIELDS = ['natureTrail', 'gardenWalk', 'pettingZoo', 'familyGamesArea', 'fishingPond'];
const TEXT_FIELDS = ['teaRating', 'lunchRating', 'suggestions'];

if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, CSV_HEADERS.join(',') + '\n');
}

function csvEscape(value) {
  let str = String(value ?? '');
  // Prevent CSV/formula injection: neutralize values that Excel/Sheets would
  // interpret as a formula if the leading character is =, +, -, or @.
  if (/^[=+\-@]/.test(str)) {
    str = `'${str}`;
  }
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function validateFeedback(data) {
  const errors = [];

  if (!data || typeof data !== 'object') {
    return ['Request body must be a JSON object.'];
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.date || '')) {
    errors.push('date must be a valid date in YYYY-MM-DD format.');
  }

  const guests = Number(data.guests);
  if (!Number.isInteger(guests) || guests < 1) {
    errors.push('guests must be a positive whole number.');
  }

  if (!String(data.nationality || '').trim()) {
    errors.push('nationality is required.');
  }

  if (!SOURCES.includes(data.source)) {
    errors.push(`source must be one of: ${SOURCES.join(', ')}.`);
  }

  const ratings = data.ratings || {};
  for (const field of ACTIVITY_FIELDS) {
    const value = Number(ratings[field]);
    if (!Number.isInteger(value) || value < 1 || value > 5) {
      errors.push(`ratings.${field} must be a whole number between 1 and 5.`);
    }
  }

  for (const field of TEXT_FIELDS) {
    if (!String(data[field] || '').trim()) {
      errors.push(`${field} is required.`);
    }
  }

  return errors;
}

function parseCsvLine(line) {
  const values = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = false;
      } else {
        cur += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      values.push(cur);
      cur = '';
    } else {
      cur += char;
    }
  }
  values.push(cur);
  return values;
}

app.use(express.json());

// Allow the static feedback form (served from a different origin) to call this API
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.get('/feedback-data', (req, res) => {
  try {
    const lines = fs.readFileSync(DATA_FILE, 'utf-8').trim().split('\n');
    const headers = parseCsvLine(lines[0]);
    const rows = lines.slice(1).map((line) => {
      const values = parseCsvLine(line);
      const row = {};
      headers.forEach((header, i) => { row[header] = values[i]; });
      return row;
    });
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: `Failed to read feedback data: ${err.message}` });
  }
});

app.post('/submit-feedback', (req, res) => {
  try {
    const data = req.body;

    const errors = validateFeedback(data);
    if (errors.length > 0) {
      return res.status(400).json({ error: errors.join(' ') });
    }

    const row = [
      data.date,
      data.guests,
      data.nationality,
      data.source,
      data.otherSourceDetails || '',
      data.ratings.natureTrail,
      data.ratings.gardenWalk,
      data.ratings.pettingZoo,
      data.ratings.familyGamesArea,
      data.ratings.fishingPond,
      data.teaRating,
      data.lunchRating,
      data.suggestions,
    ].map(csvEscape).join(',');

    fs.appendFileSync(DATA_FILE, row + '\n');
    res.json({ message: 'Feedback submitted successfully!' });
  } catch (err) {
    res.status(500).json({ error: `Failed to submit feedback: ${err.message}` });
  }
});

if (require.main === module) {
  app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
}

module.exports = app;
