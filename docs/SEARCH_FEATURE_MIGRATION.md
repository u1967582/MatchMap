# 🔍 Search Feature - Database Migration & Setup

## 🎯 Overview

The search feature allows users to find nearby bars based on location, name, and various filters. This document outlines the necessary database changes and setup requirements.

---

## 🗃️ Required Database Changes

### 1. **Add Location Fields to Bars Table**

If your `bars` table doesn't already have location fields, add them:

```sql
-- Add location columns to bars table
ALTER TABLE public.bars 
ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8);

-- Add rating and review count columns
ALTER TABLE public.bars 
ADD COLUMN IF NOT EXISTS rating DECIMAL(3, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS review_count INTEGER DEFAULT 0;

-- Add category field for filtering
ALTER TABLE public.bars 
ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'sports';

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_bars_location ON public.bars(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_bars_rating ON public.bars(rating);
CREATE INDEX IF NOT EXISTS idx_bars_category ON public.bars(category);
CREATE INDEX IF NOT EXISTS idx_bars_active ON public.bars(is_active);
```

### 2. **Update RLS Policies**

Ensure bars are publicly readable for search:

```sql
-- Allow public read access to active bars
CREATE POLICY "Public can view active bars" ON public.bars
    FOR SELECT USING (is_active = true);
```

---

## 📱 Frontend Implementation

### **File Structure**
```
app/
├── search.tsx                    # Main search screen
└── (protected)/
    └── map.tsx                   # Existing map screen

components/ui/
└── BottomTabBar.tsx              # Updated with search tab
```

### **Key Features Implemented**

#### **1. 🔍 Search Functionality**
- **Text Search**: Search bars by name using `ilike` operator
- **Location-based**: Uses device GPS to find nearby bars
- **Real-time**: Updates results as you type

#### **2. 🏷️ Filter System**
- **Categories**: Sports, Pub, Restaurant, Club
- **Distance**: 5km, 10km, 20km, 50km
- **Rating**: Best rated, Least rated, Most reviews

#### **3. 📍 Location Services**
- **GPS Permission**: Requests location access
- **Distance Calculation**: Uses Haversine formula
- **Fallback**: Works without location (shows all bars)

#### **4. 🎨 UI Components**
- **Search Bar**: With clear button and search icon
- **Filter Chips**: Horizontal scrollable filters
- **Bar Cards**: Rich cards with images and info
- **Empty States**: Helpful messages when no results

---

## 🧮 Distance Calculation

The app uses the Haversine formula to calculate distances:

```typescript
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};
```

---

## 🔧 Setup Instructions

### **1. Install Dependencies**
```bash
npx expo install expo-location
```

### **2. Update app.json**
Add location permissions:
```json
{
  "expo": {
    "plugins": [
      [
        "expo-location",
        {
          "locationAlwaysAndWhenInUsePermission": "Allow $(PRODUCT_NAME) to use your location to find nearby bars."
        }
      ]
    ]
  }
}
```

### **3. Apply Database Migrations**
Run the SQL commands above in your Supabase SQL Editor.

### **4. Test the Feature**
1. Navigate to the search tab
2. Grant location permissions
3. Try searching for bars
4. Test filters and sorting

---

## 📊 Query Examples

### **Basic Search**
```typescript
const { data: bars } = await supabase
  .from('bars')
  .select('*')
  .eq('is_active', true)
  .ilike('name', `%${searchQuery}%`);
```

### **Location-based Search**
```typescript
// Get bars within distance
const barsInRange = bars.filter(bar => 
  bar.distance_km && bar.distance_km <= maxDistance
);
```

### **Next Match Integration**
```typescript
// Get upcoming events for bars
const { data: nextMatch } = await supabase
  .from('bar_posts')
  .select('start_date, end_date')
  .eq('bar_id', bar.id)
  .eq('post_type', 'evento')
  .eq('is_active', true)
  .gte('start_date', today)
  .order('start_date', { ascending: true })
  .limit(1);
```

---

## 🎨 UI/UX Features

### **Search Bar**
- **Placeholder**: "Buscar nombre de bar..."
- **Clear Button**: Appears when typing
- **Search Icon**: Left-aligned
- **Submit**: On Enter key

### **Filter Chips**
- **Horizontal Scroll**: For mobile optimization
- **Active State**: Blue background when selected
- **Icons**: Dropdown arrows for visual hierarchy

### **Bar Cards**
- **Image**: Hero image of the bar
- **Name**: Large, bold title
- **Rating**: Star icon + score + review count
- **Distance**: Green text showing km
- **Next Match**: Calendar icon + date/time
- **Address**: Secondary text

### **Empty States**
- **No Results**: Search icon + helpful message
- **No Location**: Permission request message
- **Loading**: "Buscando bares..." text

---

## 🚀 Performance Optimizations

### **1. Database Indexes**
- Location coordinates for distance queries
- Rating and review count for sorting
- Category for filtering
- Active status for public access

### **2. Frontend Optimizations**
- **Debounced Search**: Prevents excessive API calls
- **Memoized Components**: Reduces re-renders
- **Lazy Loading**: Images load as needed
- **Pagination**: Load more results on scroll

### **3. Caching Strategy**
- **Location Cache**: Store user location
- **Search Results**: Cache recent searches
- **Bar Images**: Use React Native Fast Image

---

## 🔄 Future Enhancements

### **1. Advanced Filters**
- **Price Range**: Budget-friendly options
- **Opening Hours**: Currently open bars
- **Amenities**: WiFi, parking, etc.

### **2. Search Improvements**
- **Fuzzy Search**: Handle typos
- **Autocomplete**: Suggest bar names
- **Recent Searches**: Quick access

### **3. Location Features**
- **Map View**: Toggle between list and map
- **Directions**: Open in maps app
- **Save Location**: Remember favorite areas

---

## 📋 Testing Checklist

- [ ] Location permissions work correctly
- [ ] Search by name returns relevant results
- [ ] Distance filters work properly
- [ ] Rating sorting functions correctly
- [ ] Bar cards display all information
- [ ] Navigation to bar profile works
- [ ] Empty states show appropriate messages
- [ ] Performance is acceptable on slower devices

---

## 🐛 Common Issues

### **Location Not Working**
- Check app permissions in device settings
- Ensure `expo-location` is properly installed
- Verify location services are enabled

### **No Search Results**
- Check if bars have `is_active = true`
- Verify search query format
- Ensure database indexes are created

### **Performance Issues**
- Add database indexes for frequently queried fields
- Implement pagination for large result sets
- Optimize image loading and caching 