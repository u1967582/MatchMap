-- Migration: Update bars rating and review_count with triggers
-- This migration creates triggers to automatically update bars.rating and bars.review_count
-- based on the actual reviews in the reviews table

-- First, let's create a function to calculate and update the rating and review_count
CREATE OR REPLACE FUNCTION update_bar_rating_and_count()
RETURNS TRIGGER AS $$
DECLARE
  bar_id_to_update uuid;
BEGIN
  -- Determine which bar_id to update
  IF TG_OP = 'DELETE' THEN
    bar_id_to_update := OLD.bar_id;
  ELSE
    bar_id_to_update := NEW.bar_id;
  END IF;

  -- Update the bars table with calculated values from reviews
  UPDATE bars 
  SET 
    rating = COALESCE(
      (SELECT ROUND(AVG(rating)::numeric, 1)
       FROM reviews 
       WHERE bar_id = bar_id_to_update
      ), 0
    ),
    review_count = COALESCE(
      (SELECT COUNT(*) 
       FROM reviews 
       WHERE bar_id = bar_id_to_update
      ), 0
    )
  WHERE id = bar_id_to_update;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS trigger_update_bar_rating_on_insert ON reviews;
DROP TRIGGER IF EXISTS trigger_update_bar_rating_on_update ON reviews;
DROP TRIGGER IF EXISTS trigger_update_bar_rating_on_delete ON reviews;

-- Create trigger for INSERT operations on reviews table
CREATE TRIGGER trigger_update_bar_rating_on_insert
  AFTER INSERT ON reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_bar_rating_and_count();

-- Create trigger for UPDATE operations on reviews table
CREATE TRIGGER trigger_update_bar_rating_on_update
  AFTER UPDATE ON reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_bar_rating_and_count();

-- Create trigger for DELETE operations on reviews table
CREATE TRIGGER trigger_update_bar_rating_on_delete
  AFTER DELETE ON reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_bar_rating_and_count();

-- Update existing bars with current review data
-- This will populate the rating and review_count for existing bars
UPDATE bars 
SET 
  rating = COALESCE(
    (SELECT ROUND(AVG(rating)::numeric, 1)
     FROM reviews 
     WHERE bar_id = bars.id
    ), 0
  ),
  review_count = COALESCE(
    (SELECT COUNT(*) 
     FROM reviews 
     WHERE bar_id = bars.id
    ), 0
  ); 