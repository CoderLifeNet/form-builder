import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { FormRepository, makePool, MigrationRunner } from "./index.js";

const dbUrl = process.env.FORM_RUN_DB_TESTS === "true" ? process.env.FORM_TEST_DB_URL : undefined;

const integration = dbUrl ? describe : describe.skip;

integration("form postgres integration", () => {
  let pool: ReturnType<typeof makePool>;
  let repo: FormRepository;
  let runner: MigrationRunner;

  beforeAll(async () => {
    pool = makePool(dbUrl);
    repo = new FormRepository(pool);
    runner = new MigrationRunner(pool);
    await runner.migrate();
  });

  afterAll(async () => {
    await pool.end();
  });

  it("creates and publishes a form, then writes record revisions", async () => {
    const ctx = { tenantId: "tenant_test", actorId: "owner1" };

    const created = await repo.createForm(ctx, {
      name: `Integration ${Date.now()}`,
      draft: {
        metadata: {
          formId: "it_form",
          name: "IT Form",
          schemaVersion: "1.0.0"
        },
        sections: [{ id: "s1", title: "S1", order: 0 }],
        fields: [
          {
            id: "field_title",
            key: "title",
            type: "text",
            label: "Title",
            required: true,
            sectionId: "s1",
            row: 0,
            width: 12,
            rules: []
          }
        ],
        dependencyVersions: {}
      }
    });

    const published = await repo.publishDraft(ctx, created.formId, created.draftRevision);
    const saved = await repo.createRecordRevision({
      ctx,
      formId: created.formId,
      definitionId: published.definitionId,
      values: { field_title: "Need keyboard" },
      selectedLabels: {}
    });

    expect(saved.revisionNumber).toBe(1);

    const saved2 = await repo.createRecordRevision({
      ctx,
      formId: created.formId,
      definitionId: published.definitionId,
      recordId: saved.recordId,
      values: { field_title: "Need monitor" },
      selectedLabels: {}
    });

    expect(saved2.revisionNumber).toBe(2);
  });
});

integration("sequential upgrade and bindings", () => {
  let pool: ReturnType<typeof makePool>;
  beforeAll(async()=>{pool=makePool(dbUrl);await new MigrationRunner(pool).migrate();});
  afterAll(async()=>{await pool.end();});
  it("resolves parent latest, child pinned and optimistic reset without changing history",async()=>{
    const repo=new FormRepository(pool);const ctx={tenantId:`binding_${Date.now()}`,actorId:"owner"};
    const created=await repo.createForm(ctx,{name:"Binding form",draft:{metadata:{formId:"f",name:"Binding form",schemaVersion:"1.0.0"},sections:[],fields:[],dependencyVersions:{}}});
    const first=await repo.publishDraft(ctx,created.formId,1);
    const parent={type:"workspace",id:"parent"};const child={type:"project",id:"child"};
    await repo.saveBinding(ctx,parent,{formId:created.formId,mode:"latest",expectedRevision:0});
    await repo.saveBinding(ctx,child,{formId:created.formId,mode:"pinned",definitionId:first.definitionId,expectedRevision:0});
    const draft=await repo.getDraft(ctx,created.formId);
    const saved=await repo.saveDraft(ctx,created.formId,draft!.revision,draft!.definition);
    const second=await repo.publishDraft(ctx,created.formId,saved.revision);
    expect((await repo.resolveBinding(ctx,[parent,child]))?.definitionId).toBe(first.definitionId);
    await expect(repo.resetBinding(ctx,child,99)).rejects.toThrow("BINDING_CONFLICT");
    await repo.resetBinding(ctx,child,1);
    expect((await repo.resolveBinding(ctx,[parent,child]))?.definitionId).toBe(second.definitionId);
    expect(await repo.resolveBinding({tenantId:"outsider",actorId:"outsider"},[parent,child])).toBeNull();
  });
});

integration("upgrade from the original internal schema",()=>{
 it("preserves a published record while applying 0002 and reports migration status",async()=>{
  const { Pool }=await import("pg");const { migrations }=await import("./migrations.js");
  const schema=`upgrade_${Date.now()}_${Math.floor(Math.random()*100000)}`;
  const admin=new Pool({connectionString:dbUrl});
  await admin.query(`CREATE SCHEMA ${schema}`);
  const isolated=new Pool({connectionString:dbUrl,max:1});
  try {
   await isolated.query(`SET search_path TO ${schema}`);
   await isolated.query(migrations[0].sql);
   await isolated.query("INSERT INTO schema_migrations (id) VALUES ($1)",[migrations[0].id]);
   const repo=new FormRepository(isolated);const ctx={tenantId:"upgrade",actorId:"owner"};
   const form=await repo.createForm(ctx,{name:"Original",draft:{metadata:{formId:"f",name:"Original",schemaVersion:"1.0.0"},sections:[],fields:[],dependencyVersions:{}}});
   const publication=await repo.publishDraft(ctx,form.formId,1);
   const record=await repo.createRecordRevision({ctx,formId:form.formId,definitionId:publication.definitionId,values:{old:"preserved"},selectedLabels:{}});
   const runner=new MigrationRunner(isolated);
   expect((await runner.status()).pending).toContain("0002_storage_deletion_queue");
   await runner.migrate();await runner.migrate();
   expect((await runner.status()).pending).toEqual([]);
   expect((await repo.listRecordRevisions(ctx,record.recordId))[0].values).toEqual({old:"preserved"});
  } finally { await isolated.query("SET search_path TO public");await isolated.end();await admin.query(`DROP SCHEMA ${schema} CASCADE`);await admin.end(); }
 });
});

integration("transactional record idempotency",()=>{
 let pool: ReturnType<typeof makePool>;
 let repo: FormRepository;
 const ctx={tenantId:`idem_${Date.now()}`,actorId:"owner"};
 let formId:string;let definitionId:string;
 beforeAll(async()=>{
  pool=makePool(dbUrl);repo=new FormRepository(pool);await new MigrationRunner(pool).migrate();
  const form=await repo.createForm(ctx,{name:"Idempotency",draft:{metadata:{formId:"f",name:"Idempotency",schemaVersion:"1.0.0"},fields:[],sections:[],dependencyVersions:{}}});
  formId=form.formId;definitionId=(await repo.publishDraft(ctx,formId,1)).definitionId;
 });
 afterAll(async()=>{await pool.end();});
 it("rolls back a mutation before replay persistence and then replays one committed result",async()=>{
  const payload={value:"test"};
  await expect(repo.withIdempotency(ctx,"records.save","rollback",payload,async transactionClient=>{
   await repo.createRecordRevision({ctx,formId,definitionId,values:payload,selectedLabels:{},transactionClient});
   throw new Error("Response persistence interrupted");
  })).rejects.toThrow("interrupted");
  expect(Number((await pool.query("SELECT count(*) FROM records WHERE tenant_id=$1",[ctx.tenantId])).rows[0].count)).toBe(0);
  const saved=await repo.withIdempotency(ctx,"records.save","rollback",payload,async transactionClient=>({statusCode:201,response:await repo.createRecordRevision({ctx,formId,definitionId,values:payload,selectedLabels:{},transactionClient})}));
  const replay=await repo.withIdempotency(ctx,"records.save","rollback",payload,async()=>{throw new Error("Must not execute on replay");});
  expect(replay).toEqual(saved);
  expect(Number((await pool.query("SELECT count(*) FROM records WHERE tenant_id=$1",[ctx.tenantId])).rows[0].count)).toBe(1);
  await expect(repo.withIdempotency(ctx,"records.save","rollback",{value:"changed"},async()=>saved)).rejects.toThrow("IDEMPOTENCY_PAYLOAD_MISMATCH");
  await expect(repo.withIdempotency({...ctx,actorId:"other"},"records.save","rollback",payload,async()=>saved)).rejects.toThrow("FORBIDDEN");
 });
 it.skipIf(process.env.FORM_DB_PROFILE === "portable")("serializes concurrent retries on native PostgreSQL",async()=>{
  const payload={value:"concurrent"};
  const outcomes=await Promise.all(Array.from({length:4},()=>repo.withIdempotency(ctx,"records.save","concurrent",payload,async transactionClient=>({statusCode:201,response:await repo.createRecordRevision({ctx,formId,definitionId,values:payload,selectedLabels:{},transactionClient})}))));
  expect(outcomes.every(outcome=>JSON.stringify(outcome)===JSON.stringify(outcomes[0]))).toBe(true);
  const rows=await pool.query("SELECT count(*) FROM idempotency_keys WHERE tenant_id=$1 AND key_value=$2",[ctx.tenantId,"concurrent"]);
  expect(Number(rows.rows[0].count)).toBe(1);
 });
});
