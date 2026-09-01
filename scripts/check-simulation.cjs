const fs = require("fs"),
  ts = require("typescript"),
  assert = require("node:assert/strict");
const m = { exports: {} };
new Function(
  "exports",
  ts.transpileModule(fs.readFileSync("lib/lineup-roles.ts", "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText,
)(m.exports);
const { pickLegalFive } = m.exports;
(async () => {
  const r = await fetch("http://localhost:3001/api/fan/roster");
  assert.equal(r.status, 200);
  const d = await r.json();
  const pool = d.players
    .filter((p) => p.fga > 3)
    .sort((a, b) => b.score - a.score);
  const aStarters = pickLegalFive(pool).map((p) => p.id),
    bStarters = pickLegalFive(
      pool.filter((p) => !aStarters.includes(p.id)),
    ).map((p) => p.id),
    a = [
      ...aStarters,
      ...pool
        .filter((p) => !aStarters.includes(p.id) && !bStarters.includes(p.id))
        .slice(0, 3)
        .map((p) => p.id),
    ],
    b = [
      ...bStarters,
      ...pool
        .filter((p) => !a.includes(p.id) && !bStarters.includes(p.id))
        .slice(0, 3)
        .map((p) => p.id),
    ];
  const minutes = (ids) => ids.map((_, index) => (index < 5 ? 36 : 20));
  const payload = {
    a,
    b,
    plans: ["balanced", "pressure"],
    rotations: [minutes(a), minutes(b)],
  };
  const post = (body, origin) =>
    fetch("http://localhost:3001/api/simulation", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(origin ? { Origin: origin } : {}),
      },
      body: JSON.stringify(body),
    });
  const results = [];
  for (let i = 0; i < 3; i++) {
    const res = await post(payload);
    const g = await res.json();
    assert.equal(res.status, 200, JSON.stringify(g));
    assert.equal(g.model, "QNBA experimental v3");
    assert(g.profiles.every((t) => t.length === 8));
    assert.equal(g.calibration.games, 1230);
    for (let side = 0; side < 2; side++) {
      assert.equal(
        g.score[side],
        g.boxes[side].reduce((n, p) => n + p.pts, 0),
      );
      assert(
        Math.abs(g.boxes[side].reduce((n, p) => n + p.min, 0) - 240) < 0.01,
      );
    }
    results.push(g);
    console.log("Live match", i + 1, g.score, "possessions", g.possessions);
  }
  assert.equal(new Set(results.map((g) => JSON.stringify(g.boxes))).size, 3);
  const halftime = await post({
    ...payload,
    simulationToken: results[0].simulationToken,
    secondHalfPlans: ["fast", "inside"],
  });
  const changed = await halftime.json();
  assert.equal(halftime.status, 200, JSON.stringify(changed));
  assert.deepEqual(
    changed.plays.filter((p) => p.period <= 2),
    results[0].plays.filter((p) => p.period <= 2),
  );
  assert.notDeepEqual(
    changed.plays.filter((p) => p.period >= 3),
    results[0].plays.filter((p) => p.period >= 3),
  );
  assert.equal(
    (
      await post({
        ...payload,
        simulationToken: results[0].simulationToken + "x",
      })
    ).status,
    400,
  );
  for (const body of [
    { ...payload, a: [1, 1, 1, 1, 1] },
    { ...payload, a: a.slice(0, 4) },
    {
      ...payload,
      a: [...a, pool.find((p) => !a.includes(p.id) && !b.includes(p.id)).id],
    },
    { ...payload, plans: ["bad", "balanced"] },
    { ...payload, rotations: [[40, 40, 40, 40, 40, 20, 20, 10], minutes(b)] },
    { ...payload, b: [99999999, ...b.slice(1)] },
    {
      ...payload,
      a: pool
        .filter((p) => p.position === "G")
        .slice(0, 5)
        .map((p) => p.id)
        .concat(a.slice(5)),
    },
  ])
    assert.equal((await post(body)).status, 400);
  assert.equal((await post(payload, "https://other.example")).status, 403);
  console.log(
    "Bench rotations, signed halftime changes, invalid inputs, new randomness and origin checks passed.",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
