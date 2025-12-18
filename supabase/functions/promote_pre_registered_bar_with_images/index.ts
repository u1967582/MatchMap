import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Extrae el bar_id del retorno del RPC (puede ser string, objeto, o null)
 */
function extractBarId(data: unknown): string | null {
  if (!data) return null;
  
  // Si es string directamente, retornar
  if (typeof data === "string") return data;
  
  // Si es objeto, buscar en propiedades comunes
  if (typeof data === "object") {
    const o = data as Record<string, unknown>;
    for (const k of ["bar_id", "id", "barId", "barid"]) {
      if (typeof o[k] === "string") return o[k] as string;
    }
  }
  
  return null;
}

/**
 * Convierte URL pública a path de bucket (normalización)
 * Si file_path viene como URL completa, extrae solo el path
 */
function toBucketPath(pathOrUrl: string, bucket: string): string {
  const marker = `/storage/v1/object/public/${bucket}/`;
  return pathOrUrl.includes(marker) ? pathOrUrl.split(marker)[1] : pathOrUrl;
}

serve(async (req) => {
  try {
    const { preBarId, ownerId } = await req.json();

    // Validación de parámetros
    if (!preBarId || !ownerId) {
      console.error("[ERROR] Missing required parameters");
      return new Response(
        JSON.stringify({ error: "preBarId and ownerId required" }), 
        { status: 400 }
      );
    }

    console.log(`[START] Promoting pre-bar ${preBarId} for owner ${ownerId}`);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const bucket = "bar-images";

    // ========================================
    // 0) VERIFICAR ESTADO DEL PRE-BAR
    // ========================================
    console.log("[CHECK] Verifying pre-bar state...");
    const { data: preBarRow, error: preBarErr } = await supabase
      .from("auto_pre_register_bars")
      .select("converted_bar_id, status, name")
      .eq("id", preBarId)
      .single();

    if (preBarErr) {
      console.error("[CHECK ERROR]", preBarErr);
      return new Response(
        JSON.stringify({ error: preBarErr.message }), 
        { status: 400 }
      );
    }

    let barId: string | null = null;

    // ========================================
    // CASO 1: Bar ya creado, verificar si imágenes fueron migradas
    // ========================================
    if (preBarRow?.converted_bar_id) {
      console.log("[PARTIAL CONVERSION] Bar already created, checking images...");
      console.log(`  - Bar ID: ${preBarRow.converted_bar_id}`);
      console.log(`  - Status: ${preBarRow.status}`);

      // Verificar si las imágenes ya fueron migradas
      const { data: existingImages } = await supabase
        .from("bar_images")
        .select("id")
        .eq("bar_id", preBarRow.converted_bar_id)
        .limit(1);

      const { data: existingMenus } = await supabase
        .from("bar_menus")
        .select("id")
        .eq("bar_id", preBarRow.converted_bar_id)
        .limit(1);

      const hasImages = (existingImages && existingImages.length > 0) || 
                       (existingMenus && existingMenus.length > 0);

      if (hasImages) {
        console.log("[ALREADY COMPLETE] Images already migrated, nothing to do");
        return new Response(
          JSON.stringify({ 
            success: true, 
            barId: preBarRow.converted_bar_id,
            alreadyConverted: true,
            barImagesCount: 0,
            menuImagesCount: 0,
            message: "Bar and images already migrated"
          }), 
          { 
            status: 200,
            headers: { "Content-Type": "application/json" }
          }
        );
      }

      // Bar creado pero imágenes NO migradas → usar converted_bar_id y migrar imágenes
      console.log("[RESUME] Bar created but images not migrated. Resuming migration...");
      barId = preBarRow.converted_bar_id;
    } 
    // ========================================
    // CASO 2: Bar NO creado, crear con RPC
    // ========================================
    else {
      // Verificar status (solo permitir pre_registered para creación nueva)
      if (preBarRow?.status !== "pre_registered") {
        console.error("[INVALID STATUS]", preBarRow?.status);
        return new Response(
          JSON.stringify({ 
            error: `Invalid status: ${preBarRow?.status}. Expected "pre_registered"` 
          }), 
          { status: 400 }
        );
      }

      console.log("[NEW CONVERSION] Creating new bar with RPC...");
      console.log(`  - Status: ${preBarRow.status}`);
      console.log(`  - converted_bar_id: NULL (not created yet)`);

      // Llamar RPC para crear el bar
      console.log("[RPC] Calling promote_pre_registered_bar...");
      const { data: rpcData, error: rpcErr } = await supabase.rpc(
        "promote_pre_registered_bar",
        {
          p_pre_bar_id: preBarId,
          p_owner_id: ownerId,
        }
      );

      if (rpcErr) {
        console.error("[RPC ERROR]", rpcErr);
        return new Response(
          JSON.stringify({ error: rpcErr.message }), 
          { status: 400 }
        );
      }

      console.log("[RPC] Response data:", rpcData);

      // Extraer barId del retorno (puede ser string u objeto)
      barId = extractBarId(rpcData);

      // FAIL FAST: Si no se obtiene un UUID válido, detener
      if (!barId) {
        console.error("[CRITICAL] RPC did not return a valid barId", { rpcData });
        return new Response(
          JSON.stringify({ 
            error: "RPC did not return a valid barId", 
            rpcData 
          }), 
          { status: 500 }
        );
      }

      console.log(`[SUCCESS] Bar created with ID: ${barId}`);
    }

    // En este punto, barId SIEMPRE tiene un valor válido (creado ahora o existente)
    console.log(`[MIGRATION] Using bar ID: ${barId}`);

    // Helper para obtener URL pública
    const getPublicUrl = (path: string): string => {
      return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
    };

    // ========================================
    // 2) MIGRAR IMÁGENES DEL BAR
    // ========================================
    console.log("[BAR IMAGES] Fetching from auto_pre_register_bar_images...");
    const { data: barImgs, error: barImgsErr } = await supabase
      .from("auto_pre_register_bar_images")
      .select("file_path, image_order, description")
      .eq("auto_pre_bar_id", preBarId)
      .order("image_order", { ascending: true });

    if (barImgsErr) {
      console.error("[BAR IMAGES ERROR]", barImgsErr);
    } else {
      console.log(`[BAR IMAGES] Found ${barImgs?.length || 0} images`);
    }

    let barImagesCount = 0;
    for (const img of barImgs ?? []) {
      try {
        // Normalizar path (por si viene como URL completa)
        const oldPath = toBucketPath(img.file_path, bucket);
        const fileName = oldPath.split("/").pop();
        
        if (!fileName) {
          console.error(`[BAR IMAGE] Invalid file path: ${oldPath}`);
          continue;
        }

        const newPath = `${barId}/bar/${fileName}`;

        console.log(`[BAR IMAGE] Moving: ${oldPath} → ${newPath}`);

        // Mover archivo en storage
        const { error: moveErr } = await supabase.storage
          .from(bucket)
          .move(oldPath, newPath);

        if (moveErr) {
          console.error(`[BAR IMAGE] Move error:`, moveErr);
          continue;
        }

        // Insertar en bar_images con URL pública COMPLETA
        const publicUrl = getPublicUrl(newPath);
        const { error: insertErr } = await supabase
          .from("bar_images")
          .insert({
            bar_id: barId,
            image_url: publicUrl,  // ✅ URL PÚBLICA COMPLETA
            image_order: img.image_order,
            description: img.description ?? null,
          });

        if (insertErr) {
          console.error(`[BAR IMAGE] Insert error:`, insertErr);
          continue;
        }

        barImagesCount++;
        console.log(`[BAR IMAGE] ✅ Migrated: ${fileName}`);
      } catch (err) {
        console.error(`[BAR IMAGE] Unexpected error:`, err);
      }
    }

    console.log(`[BAR IMAGES] Total migrated: ${barImagesCount}`);

    // ========================================
    // 3) MIGRAR IMÁGENES DEL MENÚ
    // ========================================
    console.log("[MENU IMAGES] Fetching from auto_pre_register_bar_menus...");
    const { data: menuImgs, error: menuImgsErr } = await supabase
      .from("auto_pre_register_bar_menus")
      .select("file_path, image_order")
      .eq("auto_pre_bar_id", preBarId)
      .order("image_order", { ascending: true });

    if (menuImgsErr) {
      console.error("[MENU IMAGES ERROR]", menuImgsErr);
    } else {
      console.log(`[MENU IMAGES] Found ${menuImgs?.length || 0} images`);
    }

    let menuImagesCount = 0;
    for (const img of menuImgs ?? []) {
      try {
        // Normalizar path (por si viene como URL completa)
        const oldPath = toBucketPath(img.file_path, bucket);
        const fileName = oldPath.split("/").pop();
        
        if (!fileName) {
          console.error(`[MENU IMAGE] Invalid file path: ${oldPath}`);
          continue;
        }

        const newPath = `${barId}/menu/${fileName}`;

        console.log(`[MENU IMAGE] Moving: ${oldPath} → ${newPath}`);

        // Mover archivo en storage
        const { error: moveErr } = await supabase.storage
          .from(bucket)
          .move(oldPath, newPath);

        if (moveErr) {
          console.error(`[MENU IMAGE] Move error:`, moveErr);
          continue;
        }

        // Insertar en bar_menus con URL pública COMPLETA
        const publicUrl = getPublicUrl(newPath);
        const { error: insertErr } = await supabase
          .from("bar_menus")
          .insert({
            bar_id: barId,
            image_url: publicUrl,  // ✅ URL PÚBLICA COMPLETA
            image_order: img.image_order,
          });

        if (insertErr) {
          console.error(`[MENU IMAGE] Insert error:`, insertErr);
          continue;
        }

        menuImagesCount++;
        console.log(`[MENU IMAGE] ✅ Migrated: ${fileName}`);
      } catch (err) {
        console.error(`[MENU IMAGE] Unexpected error:`, err);
      }
    }

    console.log(`[MENU IMAGES] Total migrated: ${menuImagesCount}`);

    // ========================================
    // 4) RESPUESTA EXITOSA
    // ========================================
    console.log(`[COMPLETE] Bar ${barId} promoted successfully`);
    console.log(`  - Bar images: ${barImagesCount}`);
    console.log(`  - Menu images: ${menuImagesCount}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        barId,
        barImagesCount,
        menuImagesCount,
      }), 
      { 
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    );

  } catch (err) {
    console.error("[CRITICAL ERROR]", err);
    return new Response(
      JSON.stringify({ 
        error: "Unexpected error", 
        details: String(err) 
      }), 
      { status: 500 }
    );
  }
});
