const fs = require('fs');
const path = require('path');
const os = require('os');

const TEST_DATA_FILE = path.join(os.tmpdir(), `feedback-test-${Date.now()}.csv`);
process.env.FEEDBACK_DATA_FILE = TEST_DATA_FILE;

const request = require('supertest');
const app = require('./index');

afterAll(() => {
  fs.unlinkSync(TEST_DATA_FILE);
});

const validPayload = {
  date: '2026-01-01',
  guests: '2',
  nationality: 'Kenyan',
  source: 'Instagram',
  otherSourceDetails: '',
  ratings: {
    natureTrail: '5',
    gardenWalk: '4',
    pettingZoo: '3',
    familyGamesArea: '4',
    fishingPond: '5',
  },
  teaRating: 'Great tea!',
  lunchRating: 'Tasty lunch',
  suggestions: 'More benches please',
};

describe('POST /submit-feedback', () => {
  test('accepts a valid submission and appends it to the CSV', async () => {
    const res = await request(app).post('/submit-feedback').send(validPayload);
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/success/i);

    const csv = fs.readFileSync(TEST_DATA_FILE, 'utf-8');
    expect(csv).toContain('Kenyan');
  });

  test('rejects a submission missing required fields', async () => {
    const { date, ...incomplete } = validPayload;
    const res = await request(app).post('/submit-feedback').send(incomplete);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/date/i);
  });

  test('rejects an out-of-range activity rating', async () => {
    const res = await request(app)
      .post('/submit-feedback')
      .send({ ...validPayload, ratings: { ...validPayload.ratings, fishingPond: '7' } });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/fishingPond/);
  });

  test('rejects a non-positive guest count', async () => {
    const res = await request(app).post('/submit-feedback').send({ ...validPayload, guests: '0' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/guests/);
  });

  test('rejects an unknown source', async () => {
    const res = await request(app).post('/submit-feedback').send({ ...validPayload, source: 'Carrier pigeon' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/source/);
  });

  test('neutralizes formula-injection style input in free-text fields', async () => {
    const res = await request(app)
      .post('/submit-feedback')
      .send({ ...validPayload, suggestions: '=2+2' });
    expect(res.status).toBe(200);

    const csv = fs.readFileSync(TEST_DATA_FILE, 'utf-8');
    const lastLine = csv.trim().split('\n').pop();
    expect(lastLine).toContain("'=2+2");
  });
});

describe('GET /feedback-data', () => {
  test('returns submitted rows as JSON with expected headers', async () => {
    const res = await request(app).get('/feedback-data');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0]).toHaveProperty('nationality', 'Kenyan');
  });
});
