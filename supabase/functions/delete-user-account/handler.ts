// supabase/functions/delete-user-account/handler.ts
// Lógica separada de index.ts para poder testearla (deno test).
// deno-lint-ignore-file no-explicit-any

export interface Deps {
  getClient: () => any;
}

const json = (body: Record<string, unknown>, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

/**
 * Borra todos los objetos bajo un prefijo de un bucket (recursivo).
 * Best-effort: un fallo aquí no debe impedir el borrado de la cuenta.
 */
async function removePrefix(supabase: any, bucket: string, prefix: string) {
  const { data: entries, error } = await supabase.storage.from(bucket).list(prefix, { limit: 1000 });
  if (error || !entries?.length) return;

  const files: string[] = [];
  for (const entry of entries) {
    const path = `${prefix}/${entry.name}`;
    // Las "carpetas" del storage se listan sin id
    if (entry.id === null) {
      await removePrefix(supabase, bucket, path);
    } else {
      files.push(path);
    }
  }

  if (files.length > 0) {
    const { error: removeError } = await supabase.storage.from(bucket).remove(files);
    if (removeError) {
      console.error(`[DELETE-ACCOUNT] Error borrando ${bucket}/${prefix}:`, removeError.message);
    }
  }
}

/** Ficheros sueltos en la raíz de bar-images con el formato `bar-${barId}-...` */
async function removeRootBarFiles(supabase: any, barId: string) {
  const { data: entries } = await supabase.storage
    .from("bar-images")
    .list("", { limit: 1000, search: `bar-${barId}-` });
  const files = (entries ?? []).filter((e: any) => e.id !== null).map((e: any) => e.name);
  if (files.length > 0) {
    await supabase.storage.from("bar-images").remove(files);
  }
}

export function createHandler(deps: Deps) {
  return async (req: Request): Promise<Response> => {
    try {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return json({ success: false, error: "Missing authorization header" }, 401);
      }

      const supabase = deps.getClient();

      // El usuario a borrar se deriva SIEMPRE del JWT, nunca del body
      const token = authHeader.replace("Bearer ", "");
      const { data: { user: callerUser }, error: authError } = await supabase.auth.getUser(token);

      if (authError || !callerUser) {
        return json({ success: false, error: "Unauthorized" }, 401);
      }

      // Compatibilidad con clientes que envían userId: debe coincidir con el JWT
      const body = await req.json().catch(() => ({}));
      if (body?.userId && body.userId !== callerUser.id) {
        return json({ success: false, error: "Unauthorized: can only delete your own account" }, 403);
      }

      const userId = callerUser.id;
      console.log(`[DELETE-ACCOUNT] Starting deletion for user ${userId}`);

      // 1. Datos de la base de datos (transaccional)
      const { data: deletedBarIds, error: dataError } = await supabase.rpc("delete_user_data", {
        p_user_id: userId,
      });

      if (dataError) {
        console.error("[DELETE-ACCOUNT] Error en delete_user_data:", dataError.message);
        return json({ success: false, error: "Failed to delete user data" }, 500);
      }

      // 2. Ficheros del storage (best-effort)
      try {
        await removePrefix(supabase, "avatars", userId);
        await removePrefix(supabase, "bar-claim-documents", userId);
        await removePrefix(supabase, "ticket-claims", userId);
        for (const barId of (deletedBarIds as string[] | null) ?? []) {
          await removePrefix(supabase, "bar-images", barId);
          await removeRootBarFiles(supabase, barId);
        }
      } catch (storageError) {
        console.error("[DELETE-ACCOUNT] Error limpiando storage:", storageError);
      }

      // 3. Usuario de auth (requiere service_role)
      const { error: deleteAuthError } = await supabase.auth.admin.deleteUser(userId);

      if (deleteAuthError) {
        console.error("[DELETE-ACCOUNT] Error deleting auth user:", deleteAuthError.message);
        return json({ success: false, error: "Failed to delete authentication user" }, 500);
      }

      console.log(`[DELETE-ACCOUNT] Successfully deleted user ${userId}`);
      return json({ success: true }, 200);
    } catch (error) {
      console.error("[DELETE-ACCOUNT] Unexpected error:", error);
      return json({ success: false, error: "Internal server error" }, 500);
    }
  };
}
