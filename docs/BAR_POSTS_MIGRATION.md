# 📢 Bar Posts Feature - Database Migration

## 🧱 Table: `bar_posts` (Supabase)

This table stores posts created by bar owners to promote events, offers, or general updates.

### 📊 Schema

| Column       | Type        | Description |
|--------------|-------------|-------------|
| `id`         | `uuid`      | Primary key |
| `bar_id`     | `uuid`      | Foreign key to `bars(id)` |
| `created_at` | `timestamptz` | Auto timestamp |
| `updated_at` | `timestamptz` | Timestamp on modification |
| `title`      | `text`      | Post title |
| `description`| `text`      | Body of the post |
| `image_url`  | `text`      | URL to image in Supabase Storage |
| `start_date` | `date`      | Optional start of event/promotion |
| `end_date`   | `date`      | Optional end of event/promotion |
| `post_type`  | `text`      | One of: 'promocion', 'evento', 'noticia', 'oferta' |
| `is_active`  | `boolean`   | Post status (enabled/disabled) |
| `pinned`     | `boolean`   | Highlighted in UI |

---

## 🗃️ SQL Migration

Run this migration in Supabase SQL Editor or via CLI:

```sql
-- Create bar_posts table
CREATE TABLE IF NOT EXISTS public.bar_posts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    bar_id UUID NOT NULL REFERENCES public.bars(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    image_url TEXT,
    start_date DATE,
    end_date DATE,
    post_type TEXT NOT NULL CHECK (post_type IN ('promocion', 'evento', 'noticia', 'oferta')),
    is_active BOOLEAN DEFAULT true,
    pinned BOOLEAN DEFAULT false
);

-- Enable RLS
ALTER TABLE public.bar_posts ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Allow everyone to read active posts
CREATE POLICY "Everyone can view active posts" ON public.bar_posts
    FOR SELECT USING (is_active = true);

-- Allow bar owners to manage their own posts
CREATE POLICY "Bar owners can manage their own posts" ON public.bar_posts
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.bars 
            WHERE bars.id = bar_posts.bar_id 
            AND EXISTS (
                SELECT 1 FROM public.users 
                WHERE users.id = auth.uid() 
                AND users.bar_id = bars.id
            )
        )
    );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_bar_posts_bar_id ON public.bar_posts(bar_id);
CREATE INDEX IF NOT EXISTS idx_bar_posts_active ON public.bar_posts(is_active);
CREATE INDEX IF NOT EXISTS idx_bar_posts_dates ON public.bar_posts(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_bar_posts_pinned ON public.bar_posts(pinned);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_bar_posts_updated_at 
    BEFORE UPDATE ON public.bar_posts 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

---

## 🔐 RLS Policies Explained

### 1. **Public Read Access**
```sql
CREATE POLICY "Everyone can view active posts" ON public.bar_posts
    FOR SELECT USING (is_active = true);
```
- **Purpose**: Allow all users to read active posts
- **Scope**: Only posts with `is_active = true`
- **Use Case**: Public viewing of bar promotions and events

### 2. **Bar Owner Management**
```sql
CREATE POLICY "Bar owners can manage their own posts" ON public.bar_posts
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.bars 
            WHERE bars.id = bar_posts.bar_id 
            AND EXISTS (
                SELECT 1 FROM public.users 
                WHERE users.id = auth.uid() 
                AND users.bar_id = bars.id
            )
        )
    );
```
- **Purpose**: Allow bar owners to create, read, update, and delete their own posts
- **Scope**: Only posts belonging to bars owned by the authenticated user
- **Use Case**: Bar management functionality

---

## 🚀 Frontend Implementation

### Query Examples

#### **Fetch Active Posts (Public)**
```typescript
const { data: posts } = await supabase
  .from('bar_posts')
  .select('*')
  .eq('bar_id', barId)
  .eq('is_active', true)
  .or(`start_date.is.null,start_date.lte.${today}`)
  .or(`end_date.is.null,end_date.gte.${today}`)
  .order('pinned', { ascending: false })
  .order('created_at', { ascending: false });
```

#### **Create New Post (Owner Only)**
```typescript
const { data: newPost } = await supabase
  .from('bar_posts')
  .insert({
    bar_id: barId,
    title: 'Mi Promoción',
    description: 'Descripción de la promoción',
    post_type: 'promocion',
    start_date: '2024-01-01',
    end_date: '2024-01-31',
    is_active: true,
    pinned: false,
  })
  .select()
  .single();
```

#### **Update Post (Owner Only)**
```typescript
const { error } = await supabase
  .from('bar_posts')
  .update({
    title: 'Título actualizado',
    is_active: false,
  })
  .eq('id', postId);
```

#### **Delete Post (Owner Only)**
```typescript
const { error } = await supabase
  .from('bar_posts')
  .delete()
  .eq('id', postId);
```

---

## 📱 UI Components

### Post Types with Visual Indicators

| Post Type   | Icon        | Color     | Label      |
|-------------|-------------|-----------|------------|
| `promocion` | `pricetag`  | `#10B981` | Promoción  |
| `evento`    | `calendar`  | `#3B82F6` | Evento     |
| `noticia`   | `newspaper` | `#8B5CF6` | Noticia    |
| `oferta`    | `gift`      | `#F59E0B` | Oferta     |

### Features Implemented

- ✅ **Post Creation**: Complete form with all fields
- ✅ **Image Upload**: Using the same robust system as profile images
- ✅ **Post Display**: Cards with type indicators and dates
- ✅ **Owner Actions**: Edit and delete buttons for owners
- ✅ **Pinned Posts**: Special highlighting for important posts
- ✅ **Date Filtering**: Only show posts within valid date range
- ✅ **Active/Inactive**: Toggle post visibility

---

## 🔄 Next Steps

1. **Apply the SQL migration** to your Supabase project
2. **Test the RLS policies** to ensure proper access control
3. **Create edit post screen** (similar to create post screen)
4. **Add post filtering** by type (promoción, evento, etc.)
5. **Implement push notifications** for new posts (optional)

---

## 📋 File Structure

```
app/
├── bar-profile/[barId].tsx     # Main bar profile with posts display
├── create-post/[barId].tsx     # Create new post screen
└── edit-post/[postId].tsx      # Edit existing post (to be created)

docs/
└── BAR_POSTS_MIGRATION.md      # This documentation file
``` 