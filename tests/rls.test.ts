/**
 * Family isolation tests against the local Supabase stack (real Postgres + RLS).
 * Requires `npx supabase start`.
 */
import { createHash, randomBytes } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { admin, newUser } from "./helpers";

type U = Awaited<ReturnType<typeof newUser>>;
let a1: U, a2: U, b1: U, outsider: U;
let famA: string, famB: string, childA: string, itemA: string, docA: string;

beforeAll(async () => {
  [a1, a2, b1, outsider] = await Promise.all([newUser("a1"), newUser("a2"), newUser("b1"), newUser("out")]);
  famA = (await a1.client.rpc("create_family", { p_name: "Family A", p_timezone: "America/New_York", p_display_name: "A1" })).data!;
  famB = (await b1.client.rpc("create_family", { p_name: "Family B", p_timezone: "America/Chicago", p_display_name: "B1" })).data!;
  childA = (await a1.client.from("children").insert({ family_id: famA, first_name: "Kid A" }).select("id").single()).data!.id;
  docA = (await a1.client.from("source_documents").insert({ family_id: famA, channel: "paste", content_hash: "h-a", text_content: "secret" }).select("id").single()).data!.id;
  itemA = (await a1.client.from("items").insert({ family_id: famA, kind: "task", title: "A task", child_id: childA }).select("id").single()).data!.id;
  await a1.client.from("item_sources").insert({ item_id: itemA, document_id: docA, family_id: famA });

  // Invite a2 by email.
  const token = randomBytes(16).toString("base64url");
  const hash = createHash("sha256").update(token).digest("hex");
  const inv = await a1.client.from("family_invites").insert({ family_id: famA, email: a2.email, token_hash: hash, invited_by: a1.id });
  expect(inv.error).toBeNull();
  const wrong = await outsider.client.rpc("accept_invite", { p_token: token, p_display_name: "Out" });
  expect(wrong.error?.message).toMatch(/different email/);
  const ok = await a2.client.rpc("accept_invite", { p_token: token, p_display_name: "A2" });
  expect(ok.error).toBeNull();
  const again = await a2.client.rpc("accept_invite", { p_token: token, p_display_name: "A2" });
  expect(again.error).not.toBeNull();
});

describe("family workspace sharing", () => {
  it("second parent sees the same family data", async () => {
    const { data } = await a2.client.from("items").select("id, title").eq("family_id", famA);
    expect(data?.map((d) => d.id)).toContain(itemA);
    const members = await a2.client.from("family_members").select("display_name").eq("family_id", famA);
    expect(members.data?.map((m) => m.display_name).sort()).toEqual(["A1", "A2"]);
  });

  it("second parent can complete a task", async () => {
    const { error } = await a2.client.from("items").update({ completed_at: new Date().toISOString(), completed_by: a2.id }).eq("id", itemA);
    expect(error).toBeNull();
  });
});

describe("cross-family isolation", () => {
  it("cannot read another family's rows", async () => {
    for (const table of ["families", "family_members", "children", "items", "source_documents", "item_sources", "family_invites"] as const) {
      const { data } = await b1.client.from(table).select("*").eq(table === "families" ? "id" : "family_id", famA);
      expect(data ?? [], `${table} leaked`).toHaveLength(0);
    }
  });

  it("cannot write into another family", async () => {
    const ins = await b1.client.from("items").insert({ family_id: famA, kind: "task", title: "intrusion" });
    expect(ins.error).not.toBeNull();
    const upd = await b1.client.from("items").update({ title: "hacked" }).eq("id", itemA).select();
    expect(upd.data ?? []).toHaveLength(0);
    const del = await b1.client.from("items").delete().eq("id", itemA).select();
    expect(del.data ?? []).toHaveLength(0);
    const { data } = await a1.client.from("items").select("title").eq("id", itemA).single();
    expect(data?.title).toBe("A task");
  });

  it("cannot link own rows to another family's child or document", async () => {
    const r = await b1.client.from("items").insert({ family_id: famB, kind: "task", title: "x", child_id: childA });
    expect(r.error?.message).toMatch(/child does not belong/);
    const itemB = (await b1.client.from("items").insert({ family_id: famB, kind: "task", title: "b" }).select("id").single()).data!.id;
    const s = await b1.client.from("item_sources").insert({ item_id: itemB, document_id: docA, family_id: famB });
    expect(s.error?.message).toMatch(/document does not belong/);
  });

  it("cannot assign a task to someone outside the family", async () => {
    const r = await a1.client.from("items").update({ assignee_id: b1.id }).eq("id", itemA);
    expect(r.error?.message).toMatch(/assignee/);
  });

  it("users without a family see nothing and cannot create rows", async () => {
    const { data } = await outsider.client.from("items").select("id");
    expect(data ?? []).toHaveLength(0);
    const r = await outsider.client.from("children").insert({ family_id: famA, first_name: "x" });
    expect(r.error).not.toBeNull();
  });

  it("only one family per user", async () => {
    const r = await a1.client.rpc("create_family", { p_name: "Second", p_timezone: "UTC", p_display_name: "A1" });
    expect(r.error?.message).toMatch(/already/);
  });
});

describe("secrets and storage", () => {
  it("integration secrets are never readable by users", async () => {
    await admin().from("integration_secrets").insert({ family_id: famA, kind: "gmail", owner_ref: famA, ciphertext: "x" });
    const { data } = await a1.client.from("integration_secrets").select("*");
    expect(data ?? []).toHaveLength(0);
    const ins = await a1.client.from("integration_secrets").insert({ family_id: famA, kind: "x", owner_ref: famA, ciphertext: "y" });
    expect(ins.error).not.toBeNull();
  });

  it("storage objects are private to the family", async () => {
    const path = `${famA}/${docA}/note.png`;
    const png = Buffer.from("89504e470d0a1a0a", "hex");
    const up = await a1.client.storage.from("documents").upload(path, png, { contentType: "image/png" });
    expect(up.error).toBeNull();
    expect((await a2.client.storage.from("documents").download(path)).error).toBeNull();
    expect((await b1.client.storage.from("documents").download(path)).error).not.toBeNull();
    const intrude = await b1.client.storage.from("documents").upload(`${famA}/x/evil.png`, png, { contentType: "image/png" });
    expect(intrude.error).not.toBeNull();
    const signed = await b1.client.storage.from("documents").createSignedUrl(path, 60);
    expect(signed.error).not.toBeNull();
  });

  it("owner can remove a member, who then loses access", async () => {
    const r = await a1.client.from("family_members").delete().eq("family_id", famA).eq("user_id", a2.id);
    expect(r.error).toBeNull();
    const { data } = await a2.client.from("items").select("id").eq("family_id", famA);
    expect(data ?? []).toHaveLength(0);
  });
});
