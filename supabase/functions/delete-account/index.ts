// delete-account — permanently deletes the calling user's account and all of
// their data. Verifies the caller's JWT, then uses the service role to delete
// the auth.users row; every user-owned table FK-cascades from there
// (profiles → dogs, markers; and marker_votes/active_walks/walk_history/
// friendships/user_badges reference auth.users directly, all ON DELETE
// CASCADE — verified against the live schema). Dog photos live in Storage,
// which does not cascade, so we clear the user's folder here too.
//
// SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY are injected by
// the Supabase Edge runtime automatically — no custom secrets to set.
//
// JWT verification stays ON (the default): the platform rejects unauthenticated
// calls before this code runs, and we re-resolve the user from the token so a
// caller can only ever delete themselves.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Missing Authorization header" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Resolve the caller from their JWT — this, not any request body, decides
    // whose account is deleted.
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return json({ error: "Invalid or expired session" }, 401);
    }
    const userId = user.id;

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Best-effort Storage cleanup (not FK-cascaded). Never blocks the delete.
    try {
      const { data: files } = await admin.storage.from("dog-photos").list(userId);
      if (files && files.length > 0) {
        await admin.storage
          .from("dog-photos")
          .remove(files.map((f) => `${userId}/${f.name}`));
      }
    } catch (_e) {
      // Orphaned photo is acceptable; a failed account delete is not.
    }

    // The cascade delete of all DB rows.
    const { error: delErr } = await admin.auth.admin.deleteUser(userId);
    if (delErr) {
      return json({ error: delErr.message }, 500);
    }

    return json({ success: true }, 200);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
