"use server";

/**
 * Admin writes.
 *
 * Every one of these runs through the signed-in user's session, so row-level
 * security decides whether the write lands. A content manager calling a
 * product update gets a database error, not a silent success — the UI hiding
 * a button is a convenience, not the control.
 *
 * Each action re-checks the role before touching anything. That is belt and
 * braces on purpose: the policy is the real gate, but failing early gives a
 * readable message instead of a raw Postgres error.
 */

import { revalidatePath } from "next/cache";
import { can, currentAdmin, sessionClient } from "@mridul/supabase/server";
import { audit } from "./audit";

export type ActionResult = { ok: boolean; message: string };

const OK = (message: string): ActionResult => ({ ok: true, message });
const FAIL = (message: string): ActionResult => ({ ok: false, message });

/** Rupees typed into a form become paise. Rejects anything not a number. */
function toPaise(raw: FormDataEntryValue | null): number | null {
  const text = String(raw ?? "")
    .trim()
    .replace(/[,\s₹]/g, "");
  if (text === "") return null;
  const rupees = Number(text);
  if (!Number.isFinite(rupees) || rupees < 0) return null;
  return Math.round(rupees * 100);
}

/** Like `toInt`, but for a value that may legitimately be absent. */
function toIntOrNull(raw: FormDataEntryValue | null): number | null {
  if (raw === null) return null;
  return toInt(raw);
}

function toInt(raw: FormDataEntryValue | null): number | null {
  const text = String(raw ?? "").trim();
  if (text === "") return null;
  const value = Number.parseInt(text, 10);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

export async function updateProduct(formData: FormData): Promise<ActionResult> {
  const admin = await currentAdmin();
  if (!can(admin, "catalog_manager")) return FAIL("You cannot edit products.");

  const id = String(formData.get("id") ?? "");
  if (!id) return FAIL("Missing product.");
  const categoryId = String(formData.get("category_id") ?? "");
  if (!categoryId) return FAIL("Choose a category.");

  const pricePaise = toPaise(formData.get("price"));
  if (pricePaise === null) return FAIL("Price must be a number.");

  // Asked for on every product, so the listing always shows a struck-through
  // "was" price beside what the piece actually costs.
  const compareRaw = String(formData.get("compare_at") ?? "").trim();
  if (compareRaw === "") return FAIL("Enter the was price, higher than the price.");
  const compareAtPaise = toPaise(formData.get("compare_at"));
  if (compareAtPaise === null) return FAIL("Was price must be a number.");
  // The database enforces this too; catching it here gives a sentence rather
  // than a constraint violation.
  if (compareAtPaise <= pricePaise) {
    return FAIL("The was price must be higher than the price, or nothing is struck through.");
  }

  const db = await sessionClient();
  const { error } = await db
    .from("products")
    .update({
      name: String(formData.get("name") ?? "").trim(),
      subtitle: String(formData.get("subtitle") ?? "").trim(),
      primary_category_id: categoryId,
      description: String(formData.get("description") ?? "").trim(),
      blouse_details: String(formData.get("blouse_details") ?? "").trim() || null,
      fabric: String(formData.get("fabric") ?? "").trim(),
      colour_name: String(formData.get("colour_name") ?? "").trim(),
      colour_hex: String(formData.get("colour_hex") ?? "#c8a39a").trim(),
      swatches: formData.getAll("swatches").map(String).filter(Boolean),
      occasion: String(formData.get("occasion") ?? "").trim(),
      technique: String(formData.get("technique") ?? "").trim(),
      care: String(formData.get("care") ?? "")
        .split("\n")
        .map((value) => value.trim())
        .filter(Boolean),
      price_paise: pricePaise,
      compare_at_paise: compareAtPaise,
      badge: (String(formData.get("badge") ?? "") || null) as never,
      is_active: formData.get("is_active") === "on",
    })
    .eq("id", id);

  if (error) return FAIL(error.message);

  revalidatePath("/products");
  revalidatePath(`/products/${id}`);
  return OK("Saved.");
}

/* ---------------------------------------------------------------------------
 * Stock
 *
 * Stock is the one number in this admin that something else writes too: every
 * order placed on the website decrements it, under a row lock, while the shop
 * may well be looking at a page that was rendered before that happened.
 *
 * So a save says what it expects to find as well as what it wants to write. If
 * the shelf has moved since the page was drawn, nothing is written and the
 * shop is told what it moved to. The alternative — writing anyway — silently
 * erases the sale, and the first symptom is an oversell weeks later.
 * ------------------------------------------------------------------------- */

type StockChange = {
  variantId: string;
  onHand: number;
  /** What the form displayed. Null when the caller had nothing to compare. */
  expected: number | null;
};

async function saveStock(changes: StockChange[]): Promise<ActionResult> {
  if (changes.length === 0) return FAIL("Nothing to save.");

  const db = await sessionClient();
  const { data, error } = await db.rpc("admin_set_stock", {
    p_changes: changes.map((change) => ({
      variant_id: change.variantId,
      on_hand: change.onHand,
      expected: change.expected,
    })),
  });

  if (error) {
    // PGRST202 is "no such function": migration 0019 has not been applied to
    // this database yet. Saving stock is not something to refuse over that, so
    // fall back to the old direct write — unguarded, as it always was, and no
    // worse than before.
    if (error.code === "PGRST202") {
      for (const change of changes) {
        const { error: writeError } = await db
          .from("inventory")
          .update({ on_hand: change.onHand })
          .eq("variant_id", change.variantId);
        if (writeError) return FAIL(writeError.message);
      }
      return OK("Stock saved.");
    }
    return FAIL(error.message);
  }

  const result = (data ?? {}) as {
    ok?: boolean;
    changed?: number;
    conflicts?: { label: string; expected: number; actual: number }[];
  };

  if (result.ok === false) {
    const clashes = result.conflicts ?? [];
    // Name the pieces and the numbers. "Someone else changed this" tells the
    // shop nothing they can act on.
    const detail = clashes
      .map(
        (clash) =>
          `${clash.label}: you had ${clash.expected}, it is now ${clash.actual}`,
      )
      .join("; ");
    return FAIL(
      `Stock changed while you were on this page, so nothing was saved. ${detail}. ` +
        "Reload to see the current counts, then set what is actually on the shelf.",
    );
  }

  // What it was as well as what it became. A stock count that has been
  // corrected twice in a week is a question worth being able to ask.
  if (result.changed !== 0) {
    await audit(
      "stock.set",
      "inventory",
      changes.length === 1 ? changes[0].variantId : `${changes.length} options`,
      { counts: changes.map((change) => change.expected) },
      { counts: changes.map((change) => change.onHand) },
    );
  }

  return OK(
    result.changed === 0 ? "No change to save." : "Stock saved.",
  );
}

/** Updates a variant and its stock together, from the product editor. */
export async function updateVariant(formData: FormData): Promise<ActionResult> {
  const admin = await currentAdmin();
  if (!can(admin, "catalog_manager")) return FAIL("You cannot edit product options.");

  const productId = String(formData.get("product_id") ?? "");
  const variantId = String(formData.get("variant_id") ?? "");
  const label = String(formData.get("label") ?? "").trim();
  const sku = String(formData.get("sku") ?? "").trim();
  const priceDeltaPaise = toPaise(formData.get("price_delta"));
  const onHand = toInt(formData.get("on_hand"));

  if (!productId || !variantId) return FAIL("Missing product option.");
  if (!label || !sku) return FAIL("Option name and SKU are required.");
  if (priceDeltaPaise === null || onHand === null) {
    return FAIL("Price adjustment and stock must be zero or more.");
  }

  const db = await sessionClient();
  const { error: variantError } = await db
    .from("product_variants")
    .update({ label, sku, price_delta_paise: priceDeltaPaise })
    .eq("id", variantId)
    .eq("product_id", productId);
  if (variantError) return FAIL(variantError.message);

  const stock = await saveStock([
    { variantId, onHand, expected: toIntOrNull(formData.get("on_hand_was")) },
  ]);
  if (!stock.ok) return stock;

  revalidatePath("/products");
  revalidatePath(`/products/${productId}`);
  return OK("Option and stock saved.");
}

/**
 * Stock, per variant.
 *
 * Set directly rather than adjusted by a delta: an admin correcting a count is
 * stating what is on the shelf, not describing a movement.
 */
export async function updateStock(formData: FormData): Promise<ActionResult> {
  const admin = await currentAdmin();
  if (!can(admin, "catalog_manager")) return FAIL("You cannot change stock.");

  const variantId = String(formData.get("variant_id") ?? "");
  const onHand = toInt(formData.get("on_hand"));
  if (!variantId) return FAIL("Missing variant.");
  if (onHand === null) return FAIL("Stock must be a whole number, zero or more.");

  const result = await saveStock([
    { variantId, onHand, expected: toIntOrNull(formData.get("on_hand_was")) },
  ]);
  if (!result.ok) return result;

  revalidatePath("/inventory");
  revalidatePath("/products");
  return OK(onHand === 0 ? "Marked out of stock." : `Stock set to ${onHand}.`);
}

/**
 * Sets the stock for every option of one product in a single save.
 *
 * Stock is the thing that changes most often and the thing least worth opening
 * a full editor for, so the list page carries its own control. Each option
 * arrives as `stock:<variant id>`, which keeps the form flat and lets a product
 * with six sizes and one with two share the same action.
 */
export async function updateProductStock(formData: FormData): Promise<ActionResult> {
  const admin = await currentAdmin();
  if (!can(admin, "catalog_manager")) return FAIL("You cannot change stock.");

  const wanted: StockChange[] = [];
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("stock:")) continue;
    const variantId = key.slice("stock:".length);
    const onHand = toInt(value);
    if (onHand === null) return FAIL("Stock must be a whole number, zero or more.");
    // The count this row was drawn with, sent back so the save can tell
    // whether the shelf moved underneath it.
    wanted.push({
      variantId,
      onHand,
      expected: toIntOrNull(formData.get(`was:${variantId}`)),
    });
  }
  if (wanted.length === 0) return FAIL("Nothing to save.");

  // One call, one transaction: six options save together or not at all.
  const saved = await saveStock(wanted);
  if (!saved.ok) return saved;

  revalidatePath("/products");
  revalidatePath("/inventory");
  revalidatePath("/");

  const total = wanted.reduce((sum, row) => sum + row.onHand, 0);
  return OK(total === 0 ? "Saved. Now out of stock." : `Saved. ${total} in stock.`);
}

/**
 * Removes one option from a product entirely.
 *
 * Unlike hiding a product, this really does delete — an option added by
 * mistake should not linger. It is safe to do: `order_items` snapshots the
 * name, code and price it was bought at, so past orders keep reading
 * correctly, and the inventory row goes with it.
 *
 * The last option is refused. A product with no options cannot be bought, and
 * "delete the size" is not a way anyone means to unpublish a saree.
 */
export async function deleteVariant(formData: FormData): Promise<ActionResult> {
  const admin = await currentAdmin();
  if (!can(admin, "catalog_manager")) return FAIL("You cannot remove options.");

  const productId = String(formData.get("product_id") ?? "");
  const variantId = String(formData.get("variant_id") ?? "");
  if (!productId || !variantId) return FAIL("Missing option.");

  const db = await sessionClient();

  const { data: siblings, error: countError } = await db
    .from("product_variants")
    .select("id, label")
    .eq("product_id", productId);
  if (countError) return FAIL(countError.message);
  if ((siblings ?? []).length <= 1) {
    return FAIL("This is the only option left. Hide the product instead.");
  }

  const label = siblings?.find((row) => row.id === variantId)?.label ?? "That option";

  const { error } = await db.from("product_variants").delete().eq("id", variantId);
  if (error) return FAIL(error.message);

  revalidatePath(`/products/${productId}`);
  revalidatePath("/products");
  revalidatePath("/");
  return OK(`${label} removed.`);
}

/**
 * Mark a product sold out, or back in stock, without touching its counts.
 *
 * Shoppers still see it — blurred, badged, not buyable. Different from hiding,
 * which takes it off the site, and from zeroing stock, which throws the real
 * numbers away. Holding a piece back for a week should not mean retyping its
 * inventory when it returns.
 */
export async function toggleSoldOut(formData: FormData): Promise<ActionResult> {
  const admin = await currentAdmin();
  if (!can(admin, "catalog_manager")) return FAIL("You cannot edit products.");

  const id = String(formData.get("id") ?? "");
  const soldOut = formData.get("sold_out") === "true";
  if (!id) return FAIL("Missing product.");

  const db = await sessionClient();
  const { error } = await db.from("products").update({ is_sold_out: soldOut }).eq("id", id);
  if (error) return FAIL(error.message);

  revalidatePath("/products");
  revalidatePath(`/products/${id}`);
  revalidatePath("/");
  return OK(soldOut ? "Shown as sold out." : "Back in stock.");
}

/** Show or hide a product on the storefront without deleting anything. */
export async function toggleProductActive(formData: FormData): Promise<ActionResult> {
  const admin = await currentAdmin();
  if (!can(admin, "catalog_manager")) return FAIL("You cannot edit products.");

  const id = String(formData.get("id") ?? "");
  const active = formData.get("active") === "true";

  const db = await sessionClient();
  const { error } = await db.from("products").update({ is_active: active }).eq("id", id);
  if (error) return FAIL(error.message);

  revalidatePath("/products");
  revalidatePath(`/products/${id}`);
  revalidatePath("/");
  return OK(active ? "Product is live." : "Product hidden from the storefront.");
}

/**
 * Creates a product with one variant and no images.
 *
 * Starts inactive on purpose — a new row with no photography should never
 * appear on the storefront because someone clicked "add".
 */
export async function createProduct(formData: FormData): Promise<ActionResult> {
  const admin = await currentAdmin();
  if (!can(admin, "catalog_manager")) return FAIL("You cannot add products.");

  const name = String(formData.get("name") ?? "").trim();
  const categoryId = String(formData.get("category_id") ?? "");
  const pricePaise = toPaise(formData.get("price"));
  const initialStock = toInt(formData.get("initial_stock"));
  const compareRaw = String(formData.get("compare_at") ?? "").trim();
  const compareAtPaise = compareRaw ? toPaise(formData.get("compare_at")) : null;

  if (!name) return FAIL("Give the product a name.");
  if (!categoryId) return FAIL("Choose a category.");
  if (pricePaise === null) return FAIL("Price must be a number.");
  if (initialStock === null) return FAIL("Opening stock must be a whole number.");
  if (!compareRaw) return FAIL("Enter the was price, higher than the price.");
  if (compareAtPaise === null || compareAtPaise <= pricePaise) {
    return FAIL("The was price must be higher than the price, or nothing is struck through.");
  }

  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  if (!slug) return FAIL("That name cannot be turned into a web address.");

  const db = await sessionClient();

  const { data: product, error } = await db
    .from("products")
    .insert({
      slug,
      name,
      subtitle: String(formData.get("subtitle") ?? "").trim(),
      description: String(formData.get("description") ?? "").trim(),
      primary_category_id: categoryId,
      price_paise: pricePaise,
      compare_at_paise: compareAtPaise,
      fabric: String(formData.get("fabric") ?? "").trim(),
      colour_name: String(formData.get("colour_name") ?? "").trim(),
      occasion: String(formData.get("occasion") ?? "").trim(),
      technique: String(formData.get("technique") ?? "").trim(),
      is_active: false,
    })
    .select("id")
    .single();

  if (error) {
    return FAIL(
      error.code === "23505" ? "A product with that name already exists." : error.message,
    );
  }

  // One variant so the product is buyable the moment it is switched on.
  const { data: variant, error: variantError } = await db
    .from("product_variants")
    .insert({
      product_id: product.id,
      sku: `${slug.toUpperCase().slice(0, 12)}-01`,
      label: String(formData.get("variant_label") ?? "Standard").trim() || "Standard",
      price_delta_paise: 0,
      position: 0,
    })
    .select("id")
    .single();
  if (variantError) return FAIL(`Product created, but the variant failed: ${variantError.message}`);

  if (variant) {
    const { error: stockError } = await db
      .from("inventory")
      .update({ on_hand: initialStock })
      .eq("variant_id", variant.id);
    if (stockError) return FAIL(`Product created, but opening stock failed: ${stockError.message}`);
  }

  revalidatePath("/products");
  return OK("Created as a draft. Add images, then switch it live.");
}

