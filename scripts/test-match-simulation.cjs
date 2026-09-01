const fs = require("fs"),
  ts = require("typescript"),
  path = require("path"),
  assert = require("node:assert/strict");
const cache = {};
function load(file) {
  file = path.resolve(file);
  if (cache[file]) return cache[file];
  const m = { exports: {} };
  cache[file] = m.exports;
  const js = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  new Function("exports", "require", "module", js)(
    m.exports,
    (p) =>
      p.startsWith(".")
        ? load(path.resolve(path.dirname(file), p + ".ts"))
        : require(p),
    m,
  );
  return m.exports;
}
const { simulate, profile } = load("lib/match-simulation.ts");
const { assignLineup } = load("lib/lineup-roles.ts");
const rng = (seed) => () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 4294967296;
};
const raw = {
  PLAYER_ID: 1,
  PLAYER_NAME: "Test",
  GP: 70,
  MIN: 30,
  FGA: 15,
  FGM: 7,
  FG3A: 5,
  FG3M: 1.8,
  FTA: 4,
  FTM: 3.2,
  OREB: 1.5,
  DREB: 5,
  AST: 4,
  TOV: 2,
  STL: 1,
  BLK: 0.6,
};
const team = ["G", "G", "F", "F", "C"].map((position, i) =>
  profile({ ...raw, PLAYER_ID: i + 1, PLAYER_NAME: "Player " + i }, position),
);
const rotationTeam = [
  ...team,
  ...["G", "F", "C"].map((position, i) =>
    profile(
      { ...raw, PLAYER_ID: i + 101, PLAYER_NAME: "Bench " + i, MIN: 18 },
      position,
    ),
  ),
];
assert(assignLineup(team));
assert(!assignLineup(team.map((p) => ({ ...p, position: "G" }))));
assert(
  assignLineup(
    team.map((p, i) => ({ ...p, position: ["G-F", "G", "F-C", "F", "C"][i] })),
  ),
);
assert.equal(profile({ ...raw, MIN: 0 }, "G"), null);
assert.equal(profile({ ...raw, OREB: null }, "G"), null);
assert.equal(profile(raw, ""), null);
const tiny = profile(
  { ...raw, GP: 1, MIN: 3, FGA: 1, FGM: 1, FG3A: 1, FG3M: 1 },
  "G",
);
assert(tiny.p3 < 0.36);
assert(tiny.fga < 16);
assert(tiny.confidence === "Limited sample");
const rotationResult = simulate(
  [rotationTeam, rotationTeam],
  ["balanced", "balanced"],
  rng(77),
);
for (const side of [0, 1]) {
  assert.equal(rotationResult.boxes[side].length, 8);
  assert(
    Math.abs(rotationResult.boxes[side].reduce((n, p) => n + p.min, 0) - 240) <
      0.01,
  );
  assert(
    rotationResult.boxes[side].slice(5).some((p) => p.fga + p.ast + p.reb > 0),
  );
}
const manualRotation = [48, 48, 48, 48, 48, 0, 0, 0];
const manualResult = simulate(
  [rotationTeam, rotationTeam],
  ["balanced", "balanced"],
  rng(78),
  ["balanced", "balanced"],
  [manualRotation, manualRotation],
);
for (const side of [0, 1]) {
  assert.deepEqual(manualResult.rotation[side], manualRotation);
  assert(
    manualResult.boxes[side]
      .slice(5)
      .every((p) => p.pts + p.reb + p.ast + p.tov + p.stl + p.blk === 0),
  );
}
assert.throws(() =>
  simulate(
    [rotationTeam, rotationTeam],
    ["balanced", "balanced"],
    rng(79),
    ["balanced", "balanced"],
    [[40, 40, 40, 40, 40, 20, 20, 10], manualRotation],
  ),
);
assert.throws(() =>
  simulate(
    [[...rotationTeam, rotationTeam[0]], rotationTeam],
    ["balanced", "balanced"],
    rng(1),
  ),
);
const firstPlan = simulate(
    [rotationTeam, rotationTeam],
    ["balanced", "balanced"],
    rng(12345),
  ),
  changedPlan = simulate(
    [rotationTeam, rotationTeam],
    ["balanced", "balanced"],
    rng(12345),
    ["fast", "inside"],
  );
assert.deepEqual(
  changedPlan.plays.filter((p) => p.period <= 2),
  firstPlan.plays.filter((p) => p.period <= 2),
);
assert.notDeepEqual(
  changedPlan.plays.filter((p) => p.period >= 3),
  firstPlan.plays.filter((p) => p.period >= 3),
);
let overtime = 0,
  offensive = 0,
  steals = 0,
  blocks = 0;
for (let seed = 1; seed <= 500; seed++) {
  const r = simulate([team, team], ["balanced", "perimeter"], rng(seed));
  if (r.quarters.length > 4) overtime++;
  assert(r.plays.length > 100 && r.plays.length < 2000);
  assert(r.quarters.length >= 4 && r.quarters.length <= 10);
  for (let side = 0; side < 2; side++) {
    assert.equal(
      r.score[side],
      r.boxes[side].reduce((s, p) => s + p.pts, 0),
    );
    assert.equal(
      r.score[side],
      r.quarters.reduce((s, q) => s + q[side], 0),
    );
    for (const p of r.boxes[side]) {
      assert.equal(p.pts, 2 * p.fgm + p.threeM + p.ftm);
      assert.equal(p.reb, p.oreb + p.dreb);
      assert(
        p.threeM <= p.threeA &&
          p.threeA <= p.fga &&
          p.fgm <= p.fga &&
          p.ftm <= p.fta,
      );
      assert(p.secondChance <= p.pts);
      offensive += p.oreb;
      steals += p.stl;
      blocks += p.blk;
    }
    assert(
      r.boxes[side].reduce((n, p) => n + p.ast, 0) <=
        r.boxes[side].reduce((n, p) => n + p.fgm, 0),
    );
    assert(
      r.boxes[side].reduce((n, p) => n + p.stl, 0) <=
        r.boxes[1 - side].reduce((n, p) => n + p.tov, 0),
    );
  }
  for (let i = 1; i < r.plays.length; i++) {
    const p = r.plays[i],
      prev = r.plays[i - 1];
    for (let side = 0; side < 2; side++) {
      assert(p.score[side] >= prev.score[side]);
      assert.equal(
        p.scorers[side].reduce((a, b) => a + b, 0),
        p.score[side],
      );
    }
    if (prev.event === "offensive-rebound") {
      assert.equal(p.possession, prev.possession);
      assert.equal(p.side, prev.side);
    }
    if (p.period === prev.period) {
      const seconds = (x) =>
        Number(x.split(":")[0]) * 60 + Number(x.split(":")[1]);
      assert(seconds(p.clock) < seconds(prev.clock));
    }
  }
  assert.deepEqual(r.plays.at(-1).score, r.score);
}
assert(overtime > 0 && offensive > 0 && steals > 0 && blocks > 0);
const totals = (r, side, key) => r.boxes[side].reduce((n, p) => n + p[key], 0);
let baseFga = 0,
  betterFga = 0,
  baseBlk = 0,
  betterBlk = 0,
  normalPace = 0,
  fastPace = 0,
  normalTO = 0,
  fastTO = 0,
  normalSteals = 0,
  pressureSteals = 0,
  normalFT = 0,
  pressureFT = 0,
  goodWins = 0;
for (let seed = 1; seed <= 400; seed++) {
  const base = simulate([team, team], ["balanced", "balanced"], rng(seed));
  const reb = simulate(
    [team.map((p) => ({ ...p, oreb: 5 })), team],
    ["balanced", "balanced"],
    rng(seed),
  );
  baseFga += totals(base, 0, "fga");
  betterFga += totals(reb, 0, "fga");
  const block = simulate(
    [team, team.map((p) => ({ ...p, blk: 3 }))],
    ["balanced", "balanced"],
    rng(seed),
  );
  baseBlk += totals(base, 1, "blk");
  betterBlk += totals(block, 1, "blk");
  const fast = simulate([team, team], ["fast", "fast"], rng(seed));
  normalPace += base.possessions[0];
  fastPace += fast.possessions[0];
  normalTO += totals(base, 0, "tov");
  fastTO += totals(fast, 0, "tov");
  const pressure = simulate([team, team], ["balanced", "pressure"], rng(seed));
  normalSteals += totals(base, 1, "stl");
  pressureSteals += totals(pressure, 1, "stl");
  normalFT += totals(base, 0, "fta");
  pressureFT += totals(pressure, 0, "fta");
  const strong = simulate(
    [team.map((p) => ({ ...p, p2: 0.65, p3: 0.43, tov: 1 })), team],
    ["balanced", "balanced"],
    rng(seed),
  );
  if (strong.score[0] > strong.score[1]) goodWins++;
}
assert(betterFga > baseFga);
assert(betterBlk > baseBlk);
assert(fastPace > normalPace);
assert(fastTO > normalTO);
assert(pressureSteals > normalSteals);
assert(pressureFT > normalFT);
assert(goodWins > 260);
console.log(
  JSON.stringify(
    {
      invariantGames: 500,
      overtime,
      offensive,
      steals,
      blocks,
      comparisons: 400,
      offensiveReboundFga: [baseFga / 400, betterFga / 400],
      blocks: [baseBlk / 400, betterBlk / 400],
      pace: [normalPace / 400, fastPace / 400],
      turnovers: [normalTO / 400, fastTO / 400],
      pressureSteals: [normalSteals / 400, pressureSteals / 400],
      opponentFT: [normalFT / 400, pressureFT / 400],
      strongTeamWins: goodWins,
    },
    null,
    2,
  ),
);
