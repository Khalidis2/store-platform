import { getSupabaseServerClient } from "./supabase-server";

const MAX_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

/**
 * Uploads an image to the store-images bucket (see
 * migrations/010_phase19_image_upload.sql) using the current request's own
 * authenticated Supabase session — not a service-role client. RLS on
 * storage.objects only requires "authenticated", not a match against a
 * specific store, so the real tenant boundary is the caller: only call
 * this from a Server Action that has already verified ownership via
 * getOwnedStore(). `pathPrefix` should include the store id for exactly
 * that reason — it doesn't enforce anything on its own, it just keeps
 * different stores' files from colliding or overwriting each other.
 */
export async function uploadImage(file: File, pathPrefix: string): Promise<string> {
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error("Image must be JPEG, PNG, WEBP, or GIF");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("Image must be under 5MB");
  }

  const ext = file.type.split("/")[1];
  const path = `${pathPrefix}-${crypto.randomUUID()}.${ext}`;

  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.storage.from("store-images").upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) throw new Error(`Image upload failed: ${error.message}`);

  const {
    data: { publicUrl },
  } = supabase.storage.from("store-images").getPublicUrl(path);

  return publicUrl;
}
