-- ============================================
-- MIGRACIÓN: Documento de verificación para reclamos de propiedad de bares
-- Fecha: 2026-08-09
-- Objetivo:
--  - Añadir columna document_path a bar_claims para poder exigir una
--    prueba (foto de documento) al reclamar la propiedad de un bar.
--  - Políticas RLS sobre storage.objects para el bucket privado
--    bar-claim-documents (creado manualmente, no gestionado por migración).
-- ============================================

alter table public.bar_claims add column if not exists document_path text;

drop policy if exists "bar_claim_documents_insert_own" on storage.objects;
create policy "bar_claim_documents_insert_own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'bar-claim-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "bar_claim_documents_select_own_or_admin" on storage.objects;
create policy "bar_claim_documents_select_own_or_admin"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'bar-claim-documents'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_super_admin()
  )
);
