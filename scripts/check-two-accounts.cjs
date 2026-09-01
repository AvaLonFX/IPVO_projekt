// Real Auth + PostgREST/Next API checks. Credentials stay in ignored logs; never printed.
const fs = require('node:fs');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { createClient } = require('@supabase/supabase-js');
const { createServerClient } = require('@supabase/ssr');
const dotenv = require('dotenv');
const env = { ...dotenv.parse(fs.readFileSync('.env.local')), ...dotenv.parse(fs.readFileSync('.env.pipeline.local')) };
const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const file = 'logs/security-test-accounts.json';
const base = process.env.TEST_BASE_URL || 'http://localhost:3001';
async function cleanup() {
  if (!fs.existsSync(file)) return;
  const accounts = JSON.parse(fs.readFileSync(file));
  for (const account of accounts) {
    const sessionClient = createClient(env.SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: signedIn } = await sessionClient.auth.signInWithPassword({ email: account.email, password: account.password });
    if (signedIn.session) {
      const { error } = await admin.auth.admin.signOut(signedIn.session.access_token, 'global');
      if (error) throw new Error('Could not revoke test sessions');
    }
    for (const table of ['UserDreamTeams','user_interactions']) {
      const { error } = await admin.from(table).delete().eq('user_id',account.id);
      if (error) throw new Error(`Cleanup failed for ${table}: ${error.code}`);
    }
    const { error } = await admin.auth.admin.deleteUser(account.id);
    if (error) throw new Error('Test account cleanup failed');
  }
  fs.unlinkSync(file);
  console.log('Temporary test accounts and their records removed.');
}
async function main() {
  if (process.argv.includes('--cleanup')) return cleanup();
  assert.ok(!fs.existsSync(file), 'Clean up previous test accounts first.');
  const accounts = [];
  fs.mkdirSync('logs',{recursive:true});
  for (let i=0;i<2;i++) {
    const email = `qnba-test-${crypto.randomUUID()}@example.invalid`;
    const password = crypto.randomBytes(24).toString('base64url');
    const { data,error } = await admin.auth.admin.createUser({email,password,email_confirm:true});
    if(error) throw new Error('Could not provision test account: '+error.message);
    accounts.push({id:data.user.id,email,password});
    fs.writeFileSync(file,JSON.stringify(accounts),{mode:0o600});
  }
  const sessions=[];
  for(const account of accounts){
    const cookies=new Map();
    const db=createServerClient(env.SUPABASE_URL,env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{cookies:{getAll:()=>[...cookies].map(([name,value])=>({name,value})),setAll:items=>items.forEach(c=>cookies.set(c.name,c.value))}});
    const {error}=await db.auth.signInWithPassword(account); assert.ifError(error);
    sessions.push({db,cookie:()=>[...cookies].map(([k,v])=>`${k}=${v}`).join('; ')});
  }
  const [a,b]=sessions;
  const {data:players,error:playerError}=await a.db.from('FullStats_NBA').select('PERSON_ID').order('PERSON_ID').limit(3);
  assert.ifError(playerError); assert.equal(players.length,3);
  const ids=players.map(p=>p.PERSON_ID);
  for(const id of ids.slice(0,2)){ const {error}=await a.db.from('UserDreamTeams').insert({user_id:accounts[0].id,player_id:id}); assert.ifError(error); }
  assert.ifError((await b.db.from('UserDreamTeams').insert({user_id:accounts[1].id,player_id:ids[2]})).error);
  assert.equal((await b.db.from('UserDreamTeams').select('*').eq('user_id',accounts[0].id)).data.length,0);
  assert.equal((await b.db.from('UserDreamTeams').delete().eq('user_id',accounts[0].id).select()).data.length,0);
  assert.equal((await b.db.from('UserDreamTeams').insert({user_id:accounts[0].id,player_id:ids[2]})).error.code,'42501');
  assert.equal((await a.db.from('UserDreamTeams').insert({user_id:accounts[0].id,player_id:ids[0]})).error.code,'23505');
  assert.ifError((await a.db.rpc('reorder_dream_team',{player_ids:[ids[1],ids[0]]})).error);
  for(let i=0;i<2;i++){
    const response=await fetch(base+'/api/dream-team',{headers:{Cookie:a.cookie()}});
    assert.equal(response.status,200); assert.deepEqual((await response.json()).map(r=>r.player_id),[ids[1],ids[0]]);
  }
  assert.ifError((await a.db.from('UserDreamTeams').delete().eq('player_id',ids[0])).error);
  const response=await fetch(base+'/api/dream-team',{headers:{Cookie:b.cookie()}});
  assert.equal(response.status,200); assert.deepEqual((await response.json()).map(r=>r.player_id),[ids[2]]);
  assert.ifError((await a.db.from('user_interactions').insert({user_id:accounts[0].id,item_type:'player',item_id:String(ids[0]),event_type:'view_player',weight:1})).error);
  assert.equal((await b.db.from('user_interactions').select('*').eq('user_id',accounts[0].id)).data.length,0);
  assert.equal((await b.db.from('user_interactions').insert({user_id:accounts[0].id,item_type:'player',item_id:String(ids[0]),event_type:'view_player',weight:1})).error.code,'42501');
  for(const path of ['/api/analytics/funnel','/api/analytics/retention']){
    const res=await fetch(base+path,{headers:{Cookie:a.cookie()}}); assert.equal(res.status,200,path);
    assert.ok(!JSON.stringify(await res.json()).includes(accounts[0].id));
    assert.equal((await fetch(base+path)).status,401);
  }
  for(const table of ['TrainingDataset','Osnovno_NBA_backup','ModelRuns','nbatest']) assert.equal((await a.db.from(table).select('*').limit(1)).error.code,'42501');
  console.log('PASS: two real accounts, isolation, spoofing rejection, duplicate rejection, saved order/reload/delete, private events and aggregate analytics.');
  console.log('Temporary accounts retained for browser verification; run --cleanup afterwards.');
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
