"use server";

/**
 * Image upload and replacement.
 *
 * Uploads go to Supabase Storage under the bucket the image is for, and a
 * `media` row records the alt text and crop. Everything that shows the image —
 * a product card, a hero banner, the media library — points at that row, so
 * replacing a file or fixing its alt text updates every place at once.
 */

import { revalidatePath } from "next/cache";
import { can, currentAdmin, sessionClient } from "@mridul/supabase/server";
import type { ActionResult } from "./catalogue";

const OK = (message: string): ActionResult => ({ ok: true, message });
const FAIL = (message: string): ActionResult => ({ ok: false, message });

const MAX_BYTES = 10 * 1024 * 1024;
// Hero banners are full-bleed, and the `banners` bucket allows more than the
// product buckets do.
const BANNER_MAX_BYTES = 15 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/avif"];

/** Keeps uploaded names predictable and safe to put in a URL. */
function safeName(name: string): string {
  const dot = name.lastIndexOf(".");
  const stem = (dot > 0 ? name.slice(0, dot) : name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  const ext =
    dot > 0
      ? name
          .slice(dot + 1)
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "")
      : "jpg";
  return `${stem || "image"}.${ext}`;
}

/**
 * Adds an image to a product.
 *
 * The upload path is prefixed with the product slug so the bucket stays
 * navigable, and suffixed with a counter so re-uploading a file with the same
 * name does not silently replace a different product's photograph.
 */
export async function uploadProductImage(formData: FormData): Promise<ActionResult> {
  const admin = await currentAdmin();
  if (!can(admin, "catalog_manager")) return FAIL("You cannot upload product images.");

  const productId = String(formData.get("product_id") ?? "");
  const slug = String(formData.get("product_slug") ?? "product");
  const alt = String(formData.get("alt") ?? "").trim();
  const focal = String(formData.get("focal") ?? "").trim() || "50% center";
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) return FAIL("Choose an image.");
  if (file.size > MAX_BYTES) return FAIL("That image is larger than 10MB.");
  if (!ALLOWED.includes(file.type)) return FAIL("Use a JPEG, PNG, WebP or AVIF.");
  if (!alt) {
    // Enforced here rather than left optional: alt text added later is alt
    // text never added.
    return FAIL("Describe the image so screen readers can announce it.");
  }

  const db = await sessionClient();

  const { count } = await db
    .from("product_images")
    .select("id", { count: "exact", head: true })
    .eq("product_id", productId);
  const position = count ?? 0;

  const path = `${slug}/${position + 1}-${safeName(file.name)}`;

  const { error: uploadError } = await db.storage
    .from("products")
    .upload(path, file, { contentType: file.type, upsert: true });
  if (uploadError) return FAIL(`Upload failed: ${uploadError.message}`);

  const { data: media, error: mediaError } = await db
    .from("media")
    .upsert(
      {
        bucket: "products",
        path,
        alt,
        focal,
        mime_type: file.type,
        byte_size: file.size,
        uploaded_by: admin?.id ?? null,
      },
      { onConflict: "bucket,path" },
    )
    .select("id")
    .single();
  if (mediaError) return FAIL(mediaError.message);

  const { error: linkError } = await db
    .from("product_images")
    .insert({ product_id: productId, media_id: media.id, position });
  if (linkError) return FAIL(linkError.message);

  revalidatePath(`/products/${productId}`);
  revalidatePath("/media");
  return OK(position === 0 ? "Uploaded and set as the thumbnail." : "Image added.");
}

/**
 * Swaps the picture behind one product image, keeping its place in the order.
 *
 * Clicking a photograph and choosing a file is how someone expects to change
 * a picture, so this action carries the existing alt text and crop across
 * rather than asking for them again — the description of an ivory saree still
 * describes it after a better photograph of the same saree is uploaded. It can
 * be corrected underneath if the new picture differs.
 *
 * A new media row is written rather than the old file overwritten, so the
 * previous photograph survives a mistaken upload.
 */
export async function replaceProductImage(formData: FormData): Promise<ActionResult> {
  const admin = await currentAdmin();
  if (!can(admin, "catalog_manager")) return FAIL("You cannot change product images.");

  const productId = String(formData.get("product_id") ?? "");
  const mediaId = String(formData.get("media_id") ?? "");
  const slug = String(formData.get("product_slug") ?? "product");
  const file = formData.get("file");

  if (!productId || !mediaId) return FAIL("Missing image.");
  if (!(file instanceof File) || file.size === 0) return FAIL("Choose an image.");
  if (file.size > MAX_BYTES) return FAIL("That image is larger than 10MB.");
  if (!ALLOWED.includes(file.type)) return FAIL("Use a JPEG, PNG, WebP or AVIF.");

  const db = await sessionClient();

  const { data: previous, error: previousError } = await db
    .from("media")
    .select("alt, focal")
    .eq("id", mediaId)
    .single();
  if (previousError) return FAIL(previousError.message);

  const path = `${slug}/${Date.now()}-${safeName(file.name)}`;
  const { error: uploadError } = await db.storage
    .from("products")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) return FAIL(`Upload failed: ${uploadError.message}`);

  const { data: media, error: mediaError } = await db
    .from("media")
    .insert({
      bucket: "products",
      path,
      alt: previous.alt,
      focal: previous.focal,
      mime_type: file.type,
      byte_size: file.size,
      uploaded_by: admin?.id ?? null,
    })
    .select("id")
    .single();
  if (mediaError) return FAIL(mediaError.message);

  const { error: linkError } = await db
    .from("product_images")
    .update({ media_id: media.id })
    .eq("product_id", productId)
    .eq("media_id", mediaId);
  if (linkError) return FAIL(linkError.message);

  revalidatePath(`/products/${productId}`);
  revalidatePath("/");
  return OK("Picture changed.");
}

/** Removes an image from a product. The file stays in the bucket. */
export async function removeProductImage(formData: FormData): Promise<ActionResult> {
  const admin = await currentAdmin();
  if (!can(admin, "catalog_manager")) return FAIL("You cannot edit product images.");

  const imageId = String(formData.get("image_id") ?? "");
  const productId = String(formData.get("product_id") ?? "");

  const db = await sessionClient();
  const { error } = await db
    .from("product_images")
    .delete()
    .eq("product_id", productId)
    .eq("media_id", imageId);
  if (error) return FAIL(error.message);

  // Close the gap so positions stay 0..n-1 and the thumbnail is always first.
  const { data: remaining } = await db
    .from("product_images")
    .select("id, position")
    .eq("product_id", productId)
    .order("position");

  for (const [index, row] of (remaining ?? []).entries()) {
    if (row.position !== index) {
      await db.from("product_images").update({ position: index }).eq("id", row.id);
    }
  }

  revalidatePath(`/products/${productId}`);
  revalidatePath("/media");
  return OK("Image removed.");
}

/**
 * Makes one photograph the thumbnail.
 *
 * Shuffling images one slot at a time asked the admin to work out positions in
 * their head; the only thing they actually wanted was "show this one on the
 * listing". Everything else keeps its order behind it.
 *
 * Positions are rewritten one row at a time because there is no transaction
 * here: the chosen image parks at -1, the ones above it shift down from the
 * back so two rows never hold the same position, and it lands at 0.
 */
export async function setThumbnail(formData: FormData): Promise<ActionResult> {
  const admin = await currentAdmin();
  if (!can(admin, "catalog_manager")) return FAIL("You cannot reorder product images.");

  const productId = String(formData.get("product_id") ?? "");
  const mediaId = String(formData.get("media_id") ?? "");
  if (!productId || !mediaId) return FAIL("Missing image.");

  const db = await sessionClient();
  const { data: images, error } = await db
    .from("product_images")
    .select("id, media_id, position")
    .eq("product_id", productId)
    .order("position");
  if (error) return FAIL(error.message);

  const rows = images ?? [];
  const index = rows.findIndex((image) => image.media_id === mediaId);
  if (index < 0) return FAIL("That image is not on this product.");
  if (index === 0) return OK("Already the thumbnail.");

  const chosen = rows[index];
  const { error: parkError } = await db
    .from("product_images")
    .update({ position: -1 })
    .eq("id", chosen.id);
  if (parkError) return FAIL(parkError.message);

  // Back to front, so each row moves into a slot that has just been vacated.
  for (let i = index - 1; i >= 0; i -= 1) {
    const { error: shiftError } = await db
      .from("product_images")
      .update({ position: i + 1 })
      .eq("id", rows[i].id);
    if (shiftError) return FAIL(shiftError.message);
  }

  const { error: placeError } = await db
    .from("product_images")
    .update({ position: 0 })
    .eq("id", chosen.id);
  if (placeError) return FAIL(placeError.message);

  revalidatePath(`/products/${productId}`);
  revalidatePath("/products");
  revalidatePath("/");
  return OK("Now the thumbnail.");
}

/** Moves a product image one position left or right; position zero is the thumbnail. */
export async function moveProductImage(formData: FormData): Promise<ActionResult> {
  const admin = await currentAdmin();
  if (!can(admin, "catalog_manager")) return FAIL("You cannot reorder product images.");

  const productId = String(formData.get("product_id") ?? "");
  const mediaId = String(formData.get("media_id") ?? "");
  const direction = String(formData.get("direction") ?? "");
  if (!productId || !mediaId || !["up", "down"].includes(direction)) {
    return FAIL("Missing image or direction.");
  }

  const db = await sessionClient();
  const { data: images, error } = await db
    .from("product_images")
    .select("id, media_id, position")
    .eq("product_id", productId)
    .order("position");
  if (error) return FAIL(error.message);

  const index = (images ?? []).findIndex((image) => image.media_id === mediaId);
  const targetIndex = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || targetIndex < 0 || targetIndex >= (images ?? []).length) {
    return FAIL("That image is already at the edge.");
  }

  const current = images![index];
  const target = images![targetIndex];
  const temporaryPosition = -1;
  const { error: temporaryError } = await db
    .from("product_images")
    .update({ position: temporaryPosition })
    .eq("id", current.id);
  if (temporaryError) return FAIL(temporaryError.message);
  const { error: targetError } = await db
    .from("product_images")
    .update({ position: current.position })
    .eq("id", target.id);
  if (targetError) return FAIL(targetError.message);
  const { error: currentError } = await db
    .from("product_images")
    .update({ position: target.position })
    .eq("id", current.id);
  if (currentError) return FAIL(currentError.message);

  revalidatePath(`/products/${productId}`);
  return OK(targetIndex === 0 ? "Set as the storefront thumbnail." : "Image order updated.");
}

/** Alt text and crop, editable without re-uploading the file. */
export async function updateMedia(formData: FormData): Promise<ActionResult> {
  const admin = await currentAdmin();
  if (!can(admin, "catalog_manager", "content_manager")) {
    return FAIL("You cannot edit media.");
  }

  const id = String(formData.get("media_id") ?? "");
  const productId = String(formData.get("product_id") ?? "");
  const alt = String(formData.get("alt") ?? "").trim();
  const focal = String(formData.get("focal") ?? "50% center").trim();
  if (!alt) return FAIL("Alt text cannot be empty.");

  const db = await sessionClient();
  const { error } = await db.from("media").update({ alt, focal }).eq("id", id);
  if (error) return FAIL(error.message);

  revalidatePath("/media");
  if (productId) revalidatePath(`/products/${productId}`);
  return OK("Saved.");
}

/** Uploads a fresh category hero and points the category at it without deleting history. */
export async function uploadCategoryImage(formData: FormData): Promise<ActionResult> {
  const admin = await currentAdmin();
  if (!can(admin, "catalog_manager")) return FAIL("You cannot change category images.");

  const categoryId = String(formData.get("category_id") ?? "");
  const slug = String(formData.get("category_slug") ?? "category");
  const alt = String(formData.get("alt") ?? "").trim();
  const file = formData.get("file");
  if (!categoryId) return FAIL("Missing category.");
  if (!(file instanceof File) || file.size === 0) return FAIL("Choose an image.");
  if (file.size > MAX_BYTES) return FAIL("That image is larger than 10MB.");
  if (!ALLOWED.includes(file.type)) return FAIL("Use a JPEG, PNG, WebP or AVIF.");
  if (!alt) return FAIL("Describe the image for screen readers.");

  const db = await sessionClient();
  const path = `categories/${slug}-${Date.now()}-${safeName(file.name)}`;
  const { error: uploadError } = await db.storage
    .from("collections")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) return FAIL(`Upload failed: ${uploadError.message}`);

  const { data: media, error: mediaError } = await db
    .from("media")
    .insert({
      bucket: "collections",
      path,
      alt,
      focal: "50% center",
      mime_type: file.type,
      byte_size: file.size,
      uploaded_by: admin?.id ?? null,
    })
    .select("id")
    .single();
  if (mediaError) return FAIL(mediaError.message);

  const { error: categoryError } = await db
    .from("categories")
    .update({ hero_media_id: media.id })
    .eq("id", categoryId);
  if (categoryError) return FAIL(categoryError.message);

  revalidatePath("/categories");
  revalidatePath("/");
  return OK("Category image changed.");
}

/**
 * Uploads a fresh hero banner and points the slide at it.
 *
 * The image lives with the banner that shows it rather than in a separate
 * library, because someone editing the homepage thinks "replace this banner",
 * not "find this file". The previous media row is left untouched, so a banner
 * swapped by mistake can be pointed back at it.
 */
export async function uploadHeroImage(formData: FormData): Promise<ActionResult> {
  const admin = await currentAdmin();
  if (!can(admin, "content_manager")) return FAIL("You cannot change homepage banners.");

  const slideId = String(formData.get("slide_id") ?? "");
  const alt = String(formData.get("alt") ?? "").trim();
  const file = formData.get("file");
  if (!slideId) return FAIL("Missing banner.");
  if (!(file instanceof File) || file.size === 0) return FAIL("Choose an image.");
  if (file.size > BANNER_MAX_BYTES) return FAIL("That image is larger than 15MB.");
  if (!ALLOWED.includes(file.type)) return FAIL("Use a JPEG, PNG, WebP or AVIF.");
  if (!alt) return FAIL("Describe the image so screen readers can announce it.");

  const db = await sessionClient();
  const path = `hero/${Date.now()}-${safeName(file.name)}`;
  const { error: uploadError } = await db.storage
    .from("banners")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) return FAIL(`Upload failed: ${uploadError.message}`);

  const { data: media, error: mediaError } = await db
    .from("media")
    .insert({
      bucket: "banners",
      path,
      alt,
      focal: "50% center",
      mime_type: file.type,
      byte_size: file.size,
      uploaded_by: admin?.id ?? null,
    })
    .select("id")
    .single();
  if (mediaError) return FAIL(mediaError.message);

  const { error: slideError } = await db
    .from("hero_slides")
    .update({ media_id: media.id })
    .eq("id", slideId);
  if (slideError) return FAIL(slideError.message);

  revalidatePath("/homepage");
  revalidatePath("/");
  return OK("Banner image changed.");
}

/**
 * Replaces the file behind an existing media row.
 *
 * Everything already pointing at the row follows automatically, which is the
 * whole reason images are a table rather than a path written into a component.
 */
export async function replaceMediaFile(formData: FormData): Promise<ActionResult> {
  const admin = await currentAdmin();
  if (!can(admin, "catalog_manager", "content_manager")) {
    return FAIL("You cannot replace media.");
  }

  const id = String(formData.get("media_id") ?? "");
  const bucket = String(formData.get("bucket") ?? "");
  const path = String(formData.get("path") ?? "");
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) return FAIL("Choose an image.");
  if (file.size > MAX_BYTES) return FAIL("That image is larger than 10MB.");
  if (!ALLOWED.includes(file.type)) return FAIL("Use a JPEG, PNG, WebP or AVIF.");

  const db = await sessionClient();
  const { error: uploadError } = await db.storage
    .from(bucket)
    .upload(path, file, { contentType: file.type, upsert: true });
  if (uploadError) return FAIL(`Upload failed: ${uploadError.message}`);

  await db.from("media").update({ mime_type: file.type, byte_size: file.size }).eq("id", id);

  revalidatePath("/media");
  revalidatePath("/");
  return OK("File replaced everywhere it is used.");
}

