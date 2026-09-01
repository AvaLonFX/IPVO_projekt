const assert = require("node:assert/strict"),
  crypto = require("node:crypto"),
  fs = require("node:fs"),
  ts = require("typescript");
const { createClient } = require("@supabase/supabase-js");
const { createServerClient } = require("@supabase/ssr");
require("dotenv").config({ path: ".env.local", quiet: true });
const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
  key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const admin = createClient(
    url,
    process.env.SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  ),
  anon = createClient(url, key, { auth: { persistSession: false } });
const m = { exports: {} };
new Function(
  "exports",
  "require",
  "module",
  ts.transpileModule(fs.readFileSync("lib/fan-rules.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText,
)(m.exports, require, m);
const { total, optimum, validateFive } = m.exports;
const base = process.env.TEST_BASE_URL || "http://localhost:3001",
  accounts = [],
  guests = new Set();
function requestClient(cookie = () => "") {
  let guest = "";
  return async (kind, body) => {
    const r = await fetch(base + "/api/fan/" + kind, {
      method: body ? "POST" : "GET",
      headers: {
        Cookie: cookie() || guest,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    for (const c of r.headers.getSetCookie()) {
      if (c.startsWith("qnba-guesser-guest=")) {
        guest = c.split(";")[0];
        guests.add("guest:" + guest.split("=")[1].split(".")[0]);
      }
    }
    return { status: r.status, data: await r.json() };
  };
}
async function account() {
  const a = {
    email: `qnba-fan-test-${crypto.randomUUID()}@example.invalid`,
    password: crypto.randomBytes(24).toString("base64url"),
  };
  const { data, error } = await admin.auth.admin.createUser({
    ...a,
    email_confirm: true,
  });
  assert.ifError(error);
  a.id = data.user.id;
  accounts.push(a);
  const jar = new Map();
  const db = createServerClient(url, key, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (cs) => cs.forEach((c) => jar.set(c.name, c.value)),
    },
  });
  const login = await db.auth.signInWithPassword(a);
  assert.ifError(login.error);
  a.token = login.data.session.access_token;
  return {
    request: requestClient(() =>
      [...jar].map(([k, v]) => `${k}=${v}`).join("; "),
    ),
    db,
    id: a.id,
  };
}
(async () => {
  try {
    for (const table of [
      "player_watchlist",
      "daily_five_challenges",
      "daily_five_results",
    ])
      assert((await anon.from(table).select("*")).error);
    const guest = requestClient();
    assert.equal((await guest("watchlist")).status, 401);
    const a = await account(),
      b = await account();
    const catalog = await a.request("roster");
    assert.equal(catalog.status, 200);
    assert(catalog.data.players.length > 100);
    const player = catalog.data.players[0];
    let r = await a.request("watchlist", {
      action: "add",
      playerId: player.id,
      user_id: b.id,
    });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    assert.equal(r.data.players.length, 1);
    assert.equal(
      (await a.request("watchlist", { action: "add", playerId: player.id }))
        .data.players.length,
      1,
    );
    assert.equal((await b.request("watchlist")).data.players.length, 0);
    assert((await a.db.from("player_watchlist").select("*")).error);
    assert.equal(
      (await a.request("watchlist", { action: "add", playerId: -1 })).status,
      400,
    );
    assert.equal(
      (await a.request("watchlist", { action: "remove", playerId: player.id }))
        .data.players.length,
      0,
    );
    const daily = await a.request("daily-five");
    assert.equal(daily.status, 200, JSON.stringify(daily.data));
    assert.equal(daily.data.pool.length, 20);
    assert.equal(daily.data.best, null);
    assert.deepEqual(
      (await b.request("daily-five")).data.pool,
      daily.data.pool,
    );
    const { pool, day } = daily.data;
    const ids = optimum(pool).ids;
    assert.equal(ids.length, 5);
    assert.equal(
      (
        await a.request("daily-five", {
          day,
          ids: [ids[0], ids[0], ...ids.slice(2)],
        })
      ).status,
      400,
    );
    assert.equal(
      (await a.request("daily-five", { day: "2000-01-01", ids })).status,
      409,
    );
    assert.equal(
      (await a.request("daily-five", { day, ids: [-1, ...ids.slice(1)] }))
        .status,
      400,
    );
    const expensive = [...pool].sort((a, b) => b.cost - a.cost).slice(0, 5);
    if (total(expensive).cost > 80)
      assert.equal(
        (
          await a.request("daily-five", {
            day,
            ids: expensive.map((p) => p.id),
          })
        ).status,
        400,
      );
    const submit = await a.request("daily-five", {
      day,
      ids,
      score: 999999,
      owner_key: "user:" + b.id,
    });
    assert.equal(submit.status, 200, JSON.stringify(submit.data));
    assert.equal(Number(submit.data.result.score), optimum(pool).score);
    const cheapest = [...pool]
      .sort((a, b) => a.cost - b.cost)
      .slice(0, 5)
      .map((p) => p.id);
    const replay = await a.request("daily-five", { day, ids: cheapest });
    assert.deepEqual(replay.data.result.player_ids, ids);
    assert.equal((await b.request("daily-five")).data.result, null);
    const history = (await a.request("history")).data;
    assert.equal(history.dailyFive.length, 1);
    assert(
      history.achievements.find((x) => x.name === "Team architect").unlocked,
    );
    assert(!JSON.stringify(history).includes(a.id));
    const cg = await guest("daily-five");
    assert.equal(cg.status, 200);
    const gs = await guest("daily-five", { day, ids });
    assert.equal(gs.status, 200);
    const sample = (id, fgm, fga) => ({
      id,
      name: "x",
      team: "",
      teamId: "",
      pts: 1,
      reb: 2,
      ast: 3,
      fgm,
      fga,
      cost: 8,
      score: 7.9,
    });
    assert.equal(
      total([sample(1, 1, 2), sample(2, 9, 10)]).fg,
      (100 * 10) / 12,
    );
    assert.throws(() => validateFive([1, 1, 2, 3, 4], []));
    console.log(
      "PASS: roster, weighted shooting, watchlist account isolation/idempotency/removal, private tables, frozen daily pool, budget/duplicate/stale-day validation, trusted scores, locked results, guest play, history and achievements.",
    );
  } finally {
    for (const owner of guests)
      assert.ifError(
        (await admin.from("daily_five_results").delete().eq("owner_key", owner))
          .error,
      );
    for (const a of accounts) {
      if (a.token)
        assert.ifError(
          (await admin.auth.admin.signOut(a.token, "global")).error,
        );
      assert.ifError(
        (
          await admin
            .from("daily_five_results")
            .delete()
            .eq("owner_key", "user:" + a.id)
        ).error,
      );
      assert.ifError((await admin.auth.admin.deleteUser(a.id)).error);
    }
    console.log("Temporary accounts and results removed.");
  }
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
