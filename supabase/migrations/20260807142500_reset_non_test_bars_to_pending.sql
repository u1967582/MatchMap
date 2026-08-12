-- Vuelve a poner en revisión todos los bares reales que no son de test,
-- para poder re-verificarlos todos desde la pestaña "Propietarios".
update public.bars
set verification_status = 'pending',
    verified_at = null,
    verified_by = null,
    verification_notes = null
where is_test = false
  and verification_status <> 'pending';
