const assert = require("node:assert/strict"),
  crypto = require("node:crypto");
const { createClient } = require("@supabase/supabase-js");
const { createServerClient } = require("@supabase/ssr");
require("dotenv").config({ path: ".env.local", quiet: true });
const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
  anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const admin = createClient(
  url,
  process.env.SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);
const base = process.env.TEST_BASE_URL || "http://localhost:3001";
const accounts = [];
async function login(a) {
  const jar = new Map();
  const db = createServerClient(url, anon, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (items) => items.forEach((c) => jar.set(c.name, c.value)),
    },
  });
  const { data, error } = await db.auth.signInWithPassword(a);
  assert.ifError(error);
  a.token = data.session.access_token;
  return {
    db,
    request: async (path, body) => {
      const r = await fetch(base + path, {
        method: body ? "POST" : "GET",
        headers: {
          Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; "),
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      return { status: r.status, data: await r.json() };
    },
  };
}
(async () => {
  try {
    for (let i = 0; i < 2; i++) {
      const a = {
        email: `qnba-guesser-test-${crypto.randomUUID()}@example.invalid`,
        password: crypto.randomBytes(24).toString("base64url"),
      };
      const { data, error } = await admin.auth.admin.createUser({
        ...a,
        email_confirm: true,
      });
      assert.ifError(error);
      a.id = data.user.id;
      accounts.push(a);
    }
    const a = await login(accounts[0]),
      b = await login(accounts[1]),
      path = "/api/guess/current-daily";
    const first = await a.request(path, { action: "start" });
    assert.equal(first.status, 200, JSON.stringify(first.data));
    let g = first.data.game;
    const second = await b.request(path, { action: "start" });
    assert.equal(second.status, 200);
    assert.notEqual(second.data.game.id, g.id);
    assert.equal(
      (await b.request(path, { action: "hint", id: g.id, version: 0 })).status,
      404,
    );
    assert((await a.db.from("guesser_sessions").select("*")).error);
    assert((await a.db.from("guesser_challenges").select("*")).error);
    const h = await a.request(path, { action: "hint", id: g.id, version: 0 });
    assert.equal(h.status, 200);
    const anotherDevice = await login(accounts[0]);
    const resumed = await anotherDevice.request(path, { action: "start" });
    assert.equal(resumed.data.game.id, g.id);
    assert.equal(resumed.data.game.moves.length, 1);
    assert.equal(
      (await anotherDevice.request("/api/guess/summary")).data.signedIn,
      true,
    );
    const { data: answer } = await admin
      .from("guesser_sessions")
      .select("answer")
      .eq("id", g.id)
      .single();
    const won = await anotherDevice.request(path, {
      action: "guess",
      id: g.id,
      version: 1,
      playerId: answer.answer.id,
    });
    assert.equal(won.data.game.status, "won");
    assert.equal((await a.request("/api/guess/summary")).data.current.wins, 1);
    assert.equal((await b.request("/api/guess/summary")).data.current.wins, 0);
    console.log(
      "PASS: two real accounts, ownership, private DB access, second-device resume, saved win and independent statistics.",
    );
  } finally {
    for (const a of accounts) {
      if (a.token)
        assert.ifError(
          (await admin.auth.admin.signOut(a.token, "global")).error,
        );
      assert.ifError(
        (
          await admin
            .from("guesser_sessions")
            .delete()
            .eq("owner_key", "user:" + a.id)
        ).error,
      );
      assert.ifError((await admin.auth.admin.deleteUser(a.id)).error);
    }
    console.log("Temporary accounts and games removed.");
  }
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
