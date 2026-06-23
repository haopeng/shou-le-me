import type { SupabaseClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { getAuthContext, isAuthContext, jsonError } from "../../_lib/server";

export const runtime = "nodejs";

const avatarBucket = "slim-avatars";
const maxAvatarBytes = 5 * 1024 * 1024;
const mimeToExtension: Record<string, string> = {
  "image/gif": "gif",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
};

async function ensureAvatarBucket(admin: SupabaseClient) {
  const { data: bucket } = await admin.storage.getBucket(avatarBucket);

  if (bucket) {
    if (!bucket.public) {
      const { error } = await admin.storage.updateBucket(avatarBucket, {
        public: true,
        fileSizeLimit: maxAvatarBytes,
        allowedMimeTypes: Object.keys(mimeToExtension)
      });
      return error;
    }
    return null;
  }

  const { error } = await admin.storage.createBucket(avatarBucket, {
    public: true,
    fileSizeLimit: maxAvatarBytes,
    allowedMimeTypes: Object.keys(mimeToExtension)
  });

  if (error && !/already exists/i.test(error.message)) {
    return error;
  }

  return null;
}

export async function POST(request: NextRequest) {
  const context = await getAuthContext(request);
  if (!isAuthContext(context)) {
    return context;
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("avatar");

  if (!(file instanceof File)) {
    return jsonError("Avatar image is required.", 400, "AVATAR_REQUIRED");
  }

  const contentType = file.type.toLowerCase();
  const extension = mimeToExtension[contentType];

  if (!extension) {
    return jsonError("Upload a PNG, JPG, WebP, or GIF image.", 400, "UNSUPPORTED_AVATAR_TYPE");
  }

  if (file.size <= 0 || file.size > maxAvatarBytes) {
    return jsonError("Avatar image must be 5MB or smaller.", 400, "AVATAR_TOO_LARGE");
  }

  const bucketError = await ensureAvatarBucket(context.admin);
  if (bucketError) {
    return jsonError(bucketError.message, 500, "AVATAR_BUCKET_ERROR");
  }

  const objectPath = `${context.user.id}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await context.admin.storage.from(avatarBucket).upload(objectPath, bytes, {
    cacheControl: "31536000",
    contentType,
    upsert: false
  });

  if (uploadError) {
    return jsonError(uploadError.message, 500, "AVATAR_UPLOAD_ERROR");
  }

  const { data: publicUrlData } = context.admin.storage.from(avatarBucket).getPublicUrl(objectPath);
  const avatarUrl = publicUrlData.publicUrl;

  const { data, error } = await context.admin
    .from("slim_profiles")
    .update({
      avatar_url: avatarUrl,
      updated_at: new Date().toISOString()
    })
    .eq("id", context.user.id)
    .select("id,email,full_name,nickname,avatar_url,locale")
    .single();

  if (error) {
    return jsonError(error.message, 500);
  }

  return NextResponse.json({
    profile: {
      id: data.id,
      email: data.email,
      fullName: data.full_name,
      nickname: data.nickname,
      avatarUrl: data.avatar_url,
      locale: data.locale
    }
  });
}
