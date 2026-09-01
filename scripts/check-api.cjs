const assert = require('node:assert/strict');
const base = process.env.TEST_BASE_URL || 'http://localhost:3001';
(async () => {
  for (const path of ['/api/most-searched', '/api/most-added', '/api/nba-schedule']) {
    const response = await fetch(base + path);
    assert.equal(response.status, 200, path);
    const data = await response.json();
    assert.ok(Array.isArray(data), path);
    if (path.includes('most-')) {
      assert.ok(data.length > 0, `${path}: expected populated test project`);
      assert.ok(data.every(row => Number.isFinite(Number(row.count))), `${path}: count contract`);
      assert.ok(data.every(row => !('user_id' in row)), `${path}: no owner identifiers`);
    } else {
      assert.ok(data.every(row => row.model_name === 'lr_moneyline_final' && row.nba_game_id), 'schedule model and ID contract');
    }
    console.log(`${path}: 200, ${data.length} rows`);
  }
  assert.equal((await fetch(base + '/api/nba-schedule?model=invalid')).status, 400);
  const privateResponse = await fetch(base + '/api/dream-team');
  assert.equal(privateResponse.status, 401);
  assert.match(privateResponse.headers.get('cache-control') || '', /no-store/);
  console.log('Unknown model rejected; guest team access denied with private/no-store caching.');
})().catch(error => { console.error(error.message); process.exitCode = 1; });
