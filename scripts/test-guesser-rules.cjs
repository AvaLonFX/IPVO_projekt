const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const js = ts.transpileModule(fs.readFileSync("lib/guesser-rules.ts", "utf8"), {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
}).outputText;
const m = { exports: {} };
new Function("exports", "require", "module", js)(m.exports, require, m);
const { summarize, feedback } = m.exports;
const win = (day) => ({
  day,
  status: "won",
  moves: [{ type: "guess", correct: true }],
});
const playing = (day) => ({ day, status: "playing", moves: [] });
assert.equal(
  summarize(
    [win("2026-08-29"), win("2026-08-30"), playing("2026-08-31")],
    "2026-08-31",
  ).streak,
  2,
);
assert.equal(
  summarize(
    [
      win("2026-08-29"),
      win("2026-08-30"),
      { ...win("2026-08-31"), status: "lost" },
    ],
    "2026-08-31",
  ).streak,
  0,
);
assert.equal(
  summarize([win("2026-08-28"), win("2026-08-30")], "2026-08-31").bestStreak,
  1,
);
assert.equal(summarize([win("2026-08-28")], "2026-08-31").streak, 0);
assert.equal(
  summarize([win("2026-01-31"), win("2026-02-01")], "2026-02-02").streak,
  2,
);
assert.equal(summarize([], "2026-08-31").winRate, 0);
const a = {
  team: "Hawks",
  position: "G",
  country: "USA",
  height: "6-8",
  draftYear: "2010",
};
assert.equal(
  feedback(a, { ...a, height: "6-5", draftYear: "2015" }).Height,
  "Taller ↑",
);
assert.equal(feedback(a, { ...a, height: null }).Height, "Unknown");
assert.equal(feedback(a, { ...a, draftYear: "Undrafted" }).Draft, "Unknown");
assert.equal(feedback(a, { ...a, draftYear: "2015" }).Draft, "Earlier ↓");
console.log(
  "PASS: streak gaps, losses, unfinished today, month rollover, zero games and comparative hints.",
);
assert.equal(
  feedback({ ...a, draftYear: "2010.0" }, { ...a, draftYear: "2015.0" }).Draft,
  "Earlier ↓",
);
