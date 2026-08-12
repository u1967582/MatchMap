CREATE TABLE public.bar_requests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bar_name      TEXT NOT NULL,
  city          TEXT NOT NULL,
  address       TEXT,
  is_owner      BOOLEAN NOT NULL DEFAULT FALSE,
  owner_name    TEXT,
  owner_phone   TEXT,
  owner_email   TEXT,
  notes         TEXT,
  status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_notes   TEXT,
  reviewed_at   TIMESTAMPTZ,
  reviewed_by   UUID REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.bar_requests ENABLE ROW LEVEL SECURITY;

-- Usuarios: pueden insertar y leer sus propias solicitudes
CREATE POLICY "bar_requests_insert_own"
  ON public.bar_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "bar_requests_select_own"
  ON public.bar_requests FOR SELECT
  USING (auth.uid() = user_id);

-- Admins (is_super_user): leen y actualizan todo
CREATE POLICY "bar_requests_select_admin"
  ON public.bar_requests FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_super_user = TRUE)
  );

CREATE POLICY "bar_requests_update_admin"
  ON public.bar_requests FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_super_user = TRUE)
  );
