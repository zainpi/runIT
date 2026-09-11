import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { generateKeyPairSync, verify } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeReferralCode, prepareReferralOffer, reconcileReferralOffer } from "../../src/lib/pulsedeals/referrals";
import { Environment } from "@apple/app-store-server-library";
import { GET as invite } from "../../src/app/pulsedeals/invite/[code]/route";

const owner = "11111111-1111-4111-8111-111111111111";
const friend = "22222222-2222-4222-8222-222222222222";
const another = "33333333-3333-4333-8333-333333333333";
const code = "ABCDEF123456";

async function database() {
  const db = new PGlite();
  await db.exec("create role anon; create role authenticated; create role service_role;");
  for (const file of ["20260807160000_heaterdeals_backend.sql", "20260904000000_heaterdeals_discord.sql", "20260910000000_heaterdeals_push.sql", "20260910010000_heaterdeals_memberships.sql", "20260910020000_pulsedeals_rename.sql", "20260911000000_pulsedeals_referrals.sql", "20260911030000_pulsedeals_yearly.sql"]) {
    await db.exec((await readFile(`supabase/migrations/${file}`, "utf8")).replace("create extension if not exists pgcrypto;", ""));
  }
  await db.query("insert into pulsedeals_accounts(id,apple_sub,app_account_token) values ($1,'owner',$1),($2,'friend',$2),($3,'another',$3)", [owner,friend,another]);
  await db.query("insert into pulsedeals_referral_codes values($1,$2)", [owner,code]);
  return db;
}
function transaction(account = friend, patch: Record<string, unknown> = {}) {
  const time = Date.now() + 100;
  return { productId: "com.pulsedeals.subscription.weekly", originalTransactionId: `original-${account}`,
    transactionId: `first-${account}`, appAccountToken: account, environment: "Production", signedDate: time,
    purchaseDate: time, originalPurchaseDate: time, expiresDate: time + 604_800_000,
    offerType: 1, offerDiscountType: "FREE_TRIAL", transactionReason: "PURCHASE", inAppOwnershipType: "PURCHASED", ...patch };
}
async function record(db: PGlite, account = friend, tx: Record<string, unknown> = transaction(account)) {
  await db.query("select record_pulsedeals_apple_entitlement($1,$2::jsonb,'active')", [account,JSON.stringify(tx)]);
}
async function claim(db: PGlite, account = friend, value = code) {
  await db.query("select claim_pulsedeals_referral($1,$2)", [account,value]);
}
async function earned(db: PGlite) {
  return (await db.query<{count:number}>("select count(*)::int as count from pulsedeals_referrals where qualified_at is not null and revoked_at is null")).rows[0].count;
}
async function reserve(db: PGlite) {
  return (await db.query<{ id: string; nonce: string; issued_at: number; applied_at: string | null }>("select * from reserve_pulsedeals_referral_week($1,'Production')", [owner])).rows[0];
}
async function summary(db: PGlite) {
  return (await db.query<{value:{availableWeeks:number;pendingWeeks:number;usedWeeks:number;redemptionProductID:string|null}}>("select pulsedeals_referral_summary($1,'Production') as value",[owner])).rows[0].value;
}

test("new user claims once; only a verified first free trial earns exactly one week", async () => {
  const db = await database();
  try {
    await claim(db,friend,"  abcdef123456  ");
    await claim(db); // Safe retry before and after the purchase.
    assert.equal(await earned(db),0);
    await assert.rejects(claim(db,owner), /own code/);
    await assert.rejects(claim(db,another,"000000000000"), /not found/);
    await assert.rejects(claim(db,friend,"000000000000"), /already claimed/);
    const tx = transaction();
    await Promise.all([record(db,friend,tx),record(db,friend,tx)]);
    await claim(db);
    assert.equal(await earned(db),1);
    await record(db,friend,transaction(friend,{transactionId:"renewal",transactionReason:"RENEWAL",offerType:undefined,signedDate:Date.now()+500}));
    await record(db,friend,tx);
    assert.equal(await earned(db),1);
    await assert.rejects(record(db,another,tx), /another account/);
    await db.query("delete from pulsedeals_accounts where id=$1",[friend]);
    assert.equal(await earned(db),1); // Deletion does not erase the inviter's earned week.
    assert.equal((await db.query("select * from pulsedeals_referrals where referred_id is null")).rows.length,1);
    const raw = (await db.query<{raw:Record<string,unknown>}>("select raw from pulsedeals_referral_transactions where account_id is null limit 1")).rows[0].raw;
    assert.equal(raw.appAccountToken,undefined);
    assert.equal(raw.productId,undefined);
    assert.equal((await summary(db)).availableWeeks,1);
    await db.query("insert into pulsedeals_referrals(referrer_id,code,qualified_at,environment) select $1,$2,now(),'Production' from generate_series(1,1001)",[owner,code]);
    assert.equal((await summary(db)).availableWeeks,1002); // No API row-limit truncation.
  } finally { await db.close(); }
});

test("paid purchases, old trials, family sharing, discounted intros and promotions do not qualify", async () => {
  const db = await database();
  try {
    await claim(db);
    const tx = transaction();
    for (const patch of [
      { offerType: undefined }, { offerType: 2 }, { offerDiscountType: "PAY_AS_YOU_GO" },
      { inAppOwnershipType: "FAMILY_SHARED" }, { transactionReason: "RENEWAL" },
      { purchaseDate: Date.now()-100000, originalPurchaseDate: Date.now()-100000 },
      { originalPurchaseDate: Date.now()-100000 }, { appAccountToken: undefined },
    ]) {
      await record(db,friend,{...tx,...patch});
      assert.equal(await earned(db),0);
    }
    await record(db,another,transaction(another,{offerType:undefined}));
    await assert.rejects(claim(db,another), /new user/);
    await db.query("update pulsedeals_accounts set created_at=now()-interval '1 day' where id=$1", [owner]);
    await assert.rejects(claim(db,owner), /new user/);
  } finally { await db.close(); }
});

test("trial revocation withdraws unspent credit and a later restore cannot reinstate it", async () => {
  const db = await database();
  try {
    await claim(db);
    const tx = transaction();
    await record(db,friend,tx);
    await record(db,friend,{...tx,revocationDate:Date.now(),signedDate:Date.now()+1000});
    await record(db,friend,tx);
    assert.equal(await earned(db),0);
    await record(db,owner,transaction(owner));
    await assert.rejects(reserve(db), /credit unavailable/);
    await claim(db,another);
    const revoked = transaction(another,{revocationDate:Date.now()});
    await record(db,another,revoked);
    await record(db,another,{...revoked,revocationDate:undefined,signedDate:Date.now()+2000});
    assert.equal(await earned(db),0);
  } finally { await db.close(); }
});

test("reservations serialize devices, keep a canceled credit, isolate sandbox and consume on Apple confirmation", async () => {
  const db = await database();
  try {
    await record(db,owner,transaction(owner,{offerType:undefined}));
    await claim(db);
    await record(db,friend,transaction(friend,{environment:"Sandbox"}));
    await assert.rejects(reserve(db),/credit unavailable/);
    await claim(db,another);
    await record(db,another);
    const [first,retry] = await Promise.all([reserve(db),reserve(db)]);
    assert.equal(first.id,retry.id);
    assert.equal(first.nonce,retry.nonce);
    assert.equal(first.applied_at,null);
    assert.equal((await summary(db)).pendingWeeks,1);
    assert.equal((await summary(db)).availableWeeks,0);
    await assert.rejects(db.query("select retry_pulsedeals_referral_week($1,$2,$3)",[owner,first.id,first.issued_at]),/awaiting Apple/);
    const applied = transaction(owner,{transactionId:"free-week",offerType:2,offerIdentifier:"referral-week",signedDate:Date.now()+2000});
    await record(db,owner,applied);
    await record(db,owner,applied);
    assert.equal((await db.query("select * from pulsedeals_referral_redemptions where applied_at is not null")).rows.length,1);
    await assert.rejects(reserve(db),/credit unavailable/);
    assert.equal(await earned(db),2); // sandbox reward stays separate, never spendable in production.
    const nextFriend = "44444444-4444-4444-8444-444444444444";
    await db.query("insert into pulsedeals_accounts(id,apple_sub,app_account_token) values($1,'next-friend',$1)",[nextFriend]);
    await claim(db,nextFriend); await record(db,nextFriend);
    const next = await reserve(db);
    await record(db,owner,applied);
    assert.equal((await db.query<{applied_at:string|null}>("select applied_at from pulsedeals_referral_redemptions where id=$1",[next.id])).rows[0].applied_at,null);
    await record(db,owner,transaction(owner,{productId:"com.pulsedeals.subscription.pro.weekly",transactionId:"upgrade",offerType:undefined,expiresDate:Date.now()+1209600000,signedDate:Date.now()+3000}));
    assert.equal((await summary(db)).redemptionProductID,"com.pulsedeals.subscription.pro.weekly");
    const old = Date.now()-26*3600000;
    await db.query("update pulsedeals_referral_redemptions set issued_at=$1 where id=$2",[old,next.id]);
    const retargeted = await db.query<{product_id:string}>("select * from retry_pulsedeals_referral_week($1,$2,$3)",[owner,next.id,old]);
    assert.equal(retargeted.rows[0].product_id,"com.pulsedeals.subscription.pro.weekly");
    // Resubscribing can create a new original transaction; the account token
    // and signed product identify the reward's owner across that change.
    await record(db,owner,transaction(owner,{productId:"com.pulsedeals.subscription.pro.weekly",originalTransactionId:"resubscribed",transactionId:"next-free-week",offerType:2,offerIdentifier:"referral-week",signedDate:Date.now()+5000}));
    assert.equal((await db.query("select * from pulsedeals_referral_redemptions where applied_at is not null")).rows.length,2);
    assert.equal((await summary(db)).usedWeeks,2);
    assert.equal((await summary(db)).pendingWeeks,0);
  } finally { await db.close(); }
});

test("expired signature retry uses a compare-and-swap; untrusted database roles cannot claim credits", async () => {
  const db = await database();
  try {
    await claim(db); await record(db); await record(db,owner,transaction(owner));
    const first = await reserve(db);
    const old = Date.now()-26*3600000;
    await db.query("update pulsedeals_referral_redemptions set issued_at=$1 where id=$2",[old,first.id]);
    await db.query("insert into pulsedeals_discord_links(account_id,discord_user_id,username,guild_id,membership_status,paid_tier,paid_access_expires_at) values($1,'paid','member','guild','member','pro',now()+interval '10 minutes')",[owner]);
    await assert.rejects(reserve(db),/Discord billing/);
    await assert.rejects(db.query("select retry_pulsedeals_referral_week($1,$2,$3)",[owner,first.id,old]),/Discord billing/);
    await db.query("delete from pulsedeals_discord_links where account_id=$1",[owner]);
    const retried = await db.query<{nonce:string}>("select * from retry_pulsedeals_referral_week($1,$2,$3)",[owner,first.id,old]);
    assert.notEqual(retried.rows[0].nonce,first.nonce);
    await assert.rejects(db.query("select retry_pulsedeals_referral_week($1,$2,$3)",[owner,first.id,old]),/already issued/);
    await db.exec("update pulsedeals_referrals set revoked_at=now()");
    await db.query("update pulsedeals_referral_redemptions set issued_at=$1",[old]);
    const invalidated = await db.query<{voided_at:string|null}>("select * from retry_pulsedeals_referral_week($1,$2,$3)",[owner,first.id,old]);
    assert.ok(invalidated.rows[0].voided_at);
    assert.equal((await summary(db)).pendingWeeks,0);
    await assert.rejects(reserve(db),/credit unavailable/);
    await db.exec("set role authenticated");
    await assert.rejects(claim(db),/permission denied/);
    await assert.rejects(db.query("select * from pulsedeals_referrals"),/permission denied/);
  } finally { await db.close(); }
});

test("referral input and public invitation escape hostile values", async () => {
  assert.equal(normalizeReferralCode(" abcdef123456 "),code);
  for (const value of [null,123,{},"ABCDEF123456\nDROP TABLE", "<script>","１２３４５６７８９０１２"]) assert.equal(normalizeReferralCode(value),null);
  const invalid = await invite(new Request("https://example.test"),{params:Promise.resolve({code:"<script>"})});
  assert.equal(invalid.status,404);
  const valid = await invite(new Request("https://example.test"),{params:Promise.resolve({code})});
  assert.equal(valid.status,200);
  assert.match(await valid.text(),/pulsedeals:\/\/referral\/ABCDEF123456/);
  assert.equal(valid.headers.get("cache-control"),"no-store");
});

test("server signs the reserved week for the authenticated Apple account, never client-selected pricing", async () => {
  const {privateKey,publicKey} = generateKeyPairSync("ec",{namedCurve:"prime256v1"});
  const settings = {PULSEDEALS_REFERRALS_ENABLED:"true",PULSEDEALS_APPLE_OFFER_PRIVATE_KEY:privateKey.export({type:"pkcs8",format:"pem"}).toString(),PULSEDEALS_APPLE_OFFER_KEY_ID:"test-key",PULSEDEALS_APPLE_ISSUER_ID:"test-issuer",PULSEDEALS_BUNDLE_ID:"com.pulsedeals.app",PULSEDEALS_REFERRAL_ENVIRONMENT:"Production"};
  const previous = Object.fromEntries(Object.keys(settings).map(k => [k,process.env[k]]));
  Object.assign(process.env,settings);
  try {
    const pending = {id:friend,referral_id:another,product_id:"com.pulsedeals.subscription.weekly",offer_id:"referral-week",environment:"Production",nonce:another,issued_at:Date.now(),applied_at:null};
    const admin = {
      from(table:string) { const query = {select(){return query;},eq(){return query;},async single(){return {data:table === "pulsedeals_accounts" ? {app_account_token:owner} : {revoked_at:null},error:null};}}; return query; },
      async rpc(name:string,params:Record<string,unknown>) { assert.equal(name,"reserve_pulsedeals_referral_week");assert.equal(params.p_account_id,owner);return {data:[pending],error:null}; },
    } as unknown as SupabaseClient;
    const signed = await prepareReferralOffer(admin,owner);
    const payload = [settings.PULSEDEALS_BUNDLE_ID,signed.keyID,signed.productID,signed.offerID,owner,signed.nonce,signed.timestamp].join("\u2063");
    assert.equal(verify("sha256",Buffer.from(payload),publicKey,Buffer.from(signed.signature,"base64")),true);
    const repeated = await prepareReferralOffer(admin,owner);
    assert.equal(repeated.nonce,signed.nonce);
    assert.equal(repeated.timestamp,signed.timestamp);
  } finally { for (const [key,value] of Object.entries(previous)) { if(value===undefined) delete process.env[key];else process.env[key]=value; } }
});

test("recovery checks every history page and keeps a future free renewal reserved", async () => {
  const settings = { PULSEDEALS_REFERRALS_ENABLED:"true", PULSEDEALS_APPLE_OFFER_PRIVATE_KEY:"not-used", PULSEDEALS_APPLE_OFFER_KEY_ID:"key", PULSEDEALS_APPLE_ISSUER_ID:"issuer", PULSEDEALS_REFERRAL_ENVIRONMENT:"Production" };
  const previous = Object.fromEntries(Object.keys(settings).map(k => [k,process.env[k]]));
  Object.assign(process.env,settings);
  try {
    let recorded = 0;
    const admin = {
      from(table:string) { const q = {select(){return q;},eq(){return q;},async single(){return {data:table === "pulsedeals_accounts" ? {app_account_token:owner} : {applied_at:null},error:null};}};return q; },
      async rpc() { recorded++; return {error:null}; },
    } as unknown as SupabaseClient;
    const pending = {id:friend,referral_id:another,product_id:"com.pulsedeals.subscription.weekly",offer_id:"referral-week",environment:Environment.PRODUCTION,nonce:another,issued_at:Date.now()-26*3600000,created_at:new Date(Date.now()-26*3600000).toISOString(),applied_at:null,voided_at:null,original_transaction_id:"original"};
    const revisions: (string|null)[] = [];
    const dependencies = {
      api: {
        async getTransactionHistory(_id:string,revision:string|null) { revisions.push(revision);return {hasMore:revision === null,revision:"next-page",signedTransactions:["signed"]}; },
        async getAllSubscriptionStatuses() { return {data:[{lastTransactions:[{originalTransactionId:"original",signedTransactionInfo:"signed",signedRenewalInfo:"renewal"}]}]}; },
      },
      async transaction() { return transaction(owner,{originalTransactionId:"original",offerType:undefined}); },
      async renewal() { return {originalTransactionId:"original",offerType:2,offerIdentifier:"referral-week"}; },
    };
    assert.equal(await reconcileReferralOffer(admin,owner,pending,dependencies),true);
    assert.deepEqual(revisions,[null,"next-page"]);
    assert.equal(recorded,3);
    dependencies.api.getAllSubscriptionStatuses = async () => ({data:[]});
    await assert.rejects(reconcileReferralOffer(admin,owner,pending,dependencies),/incomplete/);
    dependencies.api.getTransactionHistory = async () => ({hasMore:true,revision:"stuck",signedTransactions:[]});
    await assert.rejects(reconcileReferralOffer(admin,owner,pending,dependencies),/incomplete/);
    dependencies.transaction = async () => { throw new Error("Invalid signature"); };
    dependencies.api.getTransactionHistory = async () => ({hasMore:false,revision:"done",signedTransactions:["tampered"]});
    await assert.rejects(reconcileReferralOffer(admin,owner,pending,dependencies),/Invalid signature/);
  } finally { for (const [key,value] of Object.entries(previous)) { if(value===undefined) delete process.env[key];else process.env[key]=value; } }
});

for (const productId of ["com.pulsedeals.subscription.yearly", "com.pulsedeals.subscription.pro.yearly"]) {
  test(`${productId} trial qualifies once and referral redemption retains annual billing`, async () => {
    const db = await database();
    try {
      await record(db, owner, transaction(owner, { productId, offerType: undefined, expiresDate: Date.now() + 365 * 86_400_000 }));
      await claim(db);
      const trial = transaction(friend, { productId });
      await record(db, friend, trial);
      await record(db, friend, trial);
      assert.equal(await earned(db), 1);
      assert.equal((await summary(db)).redemptionProductID, productId);
      const redemption = await reserve(db);
      const row = (await db.query<{product_id: string}>("select product_id from pulsedeals_referral_redemptions where id=$1", [redemption.id])).rows[0];
      assert.equal(row.product_id, productId);
    } finally { await db.close(); }
  });
}
