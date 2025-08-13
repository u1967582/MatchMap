-- Crear tabla bar_images si no existe
CREATE TABLE IF NOT EXISTS bar_images (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  bar_id UUID NOT NULL REFERENCES bars(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  description TEXT,
  image_order INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para mejor performance
CREATE INDEX IF NOT EXISTS idx_bar_images_bar_id ON bar_images(bar_id);
CREATE INDEX IF NOT EXISTS idx_bar_images_order ON bar_images(bar_id, image_order);

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_bar_images_updated_at 
  BEFORE UPDATE ON bar_images 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column(); 