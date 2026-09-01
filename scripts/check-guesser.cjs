const assert = require("node:assert/strict");
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local", quiet: true });
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);
const anon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { persistSession: false } },
);
const base = process.env.TEST_BASE_URL || "http://localhost:3001";
const owners = new Set();
function client() {
  let cookie = "";
  return async (path, body) => {
    const r = await fetch(base + path, {
      method: body ? "POST" : "GET",
      headers: {
        cookie,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    for (const c of r.headers.getSetCookie()) {
      const pair = c.split(";")[0];
      if (pair.startsWith("qnba-guesser-guest=")) {
        cookie = pair;
        owners.add("guest:" + pair.split("=")[1].split(".")[0]);
      }
    }
    const data = await r.json();
    return { status: r.status, data, cache: r.headers.get("cache-control") };
  };
}
(async () => {
  try {
    const a = client(),
      b = client(),
      path = "/api/guess/current-daily";
    for (const table of ["guesser_sessions", "guesser_challenges"]) {
      const r = await anon.from(table).select("*").limit(1);
      assert(r.error, "anonymous must not read " + table);
    }
    assert(
      (
        await anon.rpc("start_guesser", {
          p_owner: "spoof",
          p_era: "current",
          p_mode: "daily",
          p_answer: {},
        })
      ).error,
    );
    let r = await a(path, { action: "start" });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    let g = r.data.game;
    assert.equal(g.player, null);
    assert.equal(g.moves.length, 0);
    assert.match(r.cache, /no-store/);
    assert(!JSON.stringify(g).includes("answer"));
    const again = await a(path, { action: "start" });
    assert.equal(again.data.game.id, g.id);
    const other = await b(path, { action: "start" });
    assert.notEqual(other.data.game.id, g.id);
    assert.equal(
      (await b(path, { action: "hint", id: g.id, version: 0 })).status,
      404,
    );
    const [one, two] = await Promise.all([
      a(path, { action: "hint", id: g.id, version: 0 }),
      a(path, { action: "hint", id: g.id, version: 0 }),
    ]);
    assert.deepEqual([one.status, two.status].sort(), [200, 409]);
    g = (await a(path)).data.game;
    assert.equal(g.moves.length, 1);
    assert.equal(g.player, null);
    const { data: privateGame, error } = await db
      .from("guesser_sessions")
      .select("answer")
      .eq("id", g.id)
      .single();
    assert.ifError(error);
    const { data: otherPrivate } = await db
      .from("guesser_sessions")
      .select("answer")
      .eq("id", other.data.game.id)
      .single();
    assert.equal(
      privateGame.answer.id,
      otherPrivate.answer.id,
      "same daily answer",
    );
    r = await a(path, {
      action: "guess",
      id: g.id,
      version: g.version,
      playerId: privateGame.answer.id,
    });
    assert.equal(r.status, 200);
    g = r.data.game;
    assert.equal(g.status, "won");
    assert.equal(g.moves.length, 2);
    assert(g.player.name);
    assert.equal(
      (await a(path, { action: "hint", id: g.id, version: g.version })).status,
      409,
    );
    assert.equal((await a(path, { action: "new" })).status, 400);
    const sum = (await a("/api/guess/summary")).data.current;
    assert.equal(sum.played, 1);
    assert.equal(sum.wins, 1);
    assert.equal(sum.streak, 1);
    assert.equal(sum.distribution[1], 1);
    const { data: wrong } = await db
      .from("Osnovno_NBA")
      .select("PERSON_ID")
      .neq("PERSON_ID", privateGame.answer.id)
      .limit(2);
    let h = other.data.game;
    r = await b(path, {
      action: "guess",
      id: h.id,
      version: h.version,
      playerId: wrong[0].PERSON_ID,
    });
    assert.equal(r.status, 200);
    h = r.data.game;
    assert.equal(
      (
        await b(path, {
          action: "guess",
          id: h.id,
          version: h.version,
          playerId: wrong[0].PERSON_ID,
        })
      ).status,
      400,
    );
    for (let i = 0; i < 4; i++) {
      r = await b(path, { action: "hint", id: h.id, version: h.version });
      assert.equal(r.status, 200);
      h = r.data.game;
    }
    r = await b(path, {
      action: "guess",
      id: h.id,
      version: h.version,
      playerId: wrong[1].PERSON_ID,
    });
    assert.equal(r.status, 200);
    assert.equal(r.data.game.status, "lost");
    assert.equal(r.data.game.moves.length, 6);
    for (const p of [
      "/api/guess/alltime-daily",
      "/api/guess/current-practice",
      "/api/guess/alltime-practice",
      "/api/guess/random-player",
    ]) {
      r = await a(p, { action: "start" });
      assert.equal(r.status, 200, JSON.stringify(r.data));
      assert.equal(r.data.game.player, null);
    }
    const practicePath = "/api/guess/current-practice";
    let practice = (await a(practicePath)).data.game;
    assert.equal(
      (await a(practicePath, { action: "new" })).data.game.id,
      practice.id,
      "unfinished practice cannot be reset",
    );
    const { data: practicePrivate, error: practiceError } = await db
      .from("guesser_sessions")
      .select("*")
      .eq("id", practice.id)
      .single();
    assert.ifError(practiceError);
    const finishedPractice = await a(practicePath, {
      action: "guess",
      id: practice.id,
      version: 0,
      playerId: practicePrivate.answer.id,
    });
    assert.equal(finishedPractice.data.game.status, "won");
    const newPractice = await a(practicePath, { action: "new" });
    assert.equal(newPractice.status, 200);
    assert.notEqual(newPractice.data.game.id, practice.id);
    assert.equal(
      (await a("/api/guess/summary")).data.current.played,
      1,
      "practice excluded",
    );
    const { data: newPrivate } = await db
      .from("guesser_sessions")
      .select("*")
      .eq("id", newPractice.data.game.id)
      .single();
    await a(practicePath, {
      action: "guess",
      id: newPrivate.id,
      version: 0,
      playerId: newPrivate.answer.id,
    });
    const limitRows = Array.from({ length: 30 }, () => ({
      owner_key: practicePrivate.owner_key,
      era: "current",
      mode: "practice",
      day: practicePrivate.day,
      answer: practicePrivate.answer,
      status: "won",
      moves: [{ type: "guess", correct: true }],
      version: 1,
    }));
    assert.ifError((await db.from("guesser_sessions").insert(limitRows)).error);
    assert.equal(
      (await a(practicePath, { action: "new" })).status,
      429,
      "practice creation capped",
    );
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    assert.ifError(
      (
        await db
          .from("guesser_sessions")
          .update({ day: yesterday.toISOString().slice(0, 10) })
          .eq("id", g.id)
          .eq("owner_key", practicePrivate.owner_key)
      ).error,
    );
    assert.equal(
      (await a(path, { action: "hint", id: g.id, version: g.version })).status,
      409,
      "expired daily rejected",
    );
    const foreign = await fetch(base + path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://evil.invalid",
      },
      body: JSON.stringify({ action: "start" }),
    });
    assert.equal(foreign.status, 403);
    console.log(
      "PASS: private answers, two guest isolation, stable daily, concurrent attempts, hints, duplicate rejection, win/loss, stats, all modes, origin guard.",
    );
  } finally {
    for (const owner of owners) {
      const { error } = await db
        .from("guesser_sessions")
        .delete()
        .eq("owner_key", owner);
      assert.ifError(error);
    }
    console.log("Test guest sessions removed.");
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
