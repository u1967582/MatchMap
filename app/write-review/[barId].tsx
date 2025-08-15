import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Image, Alert, Platform } from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '~/utils/supabase';
import { useReviews } from '~/hooks/useReviews';

interface Bar {
  id: string;
  name: string;
  description?: string;
  image_url?: string;
  category?: { name: string } | null;
}

export default function WriteReviewScreen() {
  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [bar, setBar] = useState<Bar | null>(null);
  const [user, setUser] = useState<any>(null);
  const [existingReview, setExistingReview] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  
  const router = useRouter();
  const { barId } = useLocalSearchParams<{ barId: string }>();
  const { createReview, updateReview, getUserReview } = useReviews();

  // Get current user
  useEffect(() => {
    const getUser = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      setUser(authUser);
    };
    getUser();
  }, []);

  // Fetch bar information and check for existing review
  useEffect(() => {
    const fetchBarAndReview = async () => {
      if (!barId || !user?.id) return;
      
      try {
        // Fetch bar data
        const { data: barData, error } = await supabase
          .from('bars')
          .select(`
            id,
            name,
            description,
            bar_categories(name),
            bar_images(image_url, image_order)
          `)
          .eq('id', barId)
          .single();

        if (error) {
          console.error('❌ Error fetching bar:', error);
          return;
        }

        // Transform the data to match our interface
        const transformedBar = {
          id: barData.id,
          name: barData.name,
          description: barData.description,
          // Get the image with image_order = 1, or the first image if none found
          image_url: barData.bar_images?.find((img: any) => img.image_order === 1)?.image_url || 
                    barData.bar_images?.[0]?.image_url || undefined,
          category: barData.bar_categories?.[0] || null,
        };

        setBar(transformedBar);

        // Check if user has already reviewed this bar
        const userReview = await getUserReview(barId, user.id);
        if (userReview) {
          setExistingReview(userReview);
          setRating(userReview.rating);
          setComment(userReview.comment || '');
        }
      } catch (error) {
        console.error('❌ Error fetching bar:', error);
      }
    };

    fetchBarAndReview();
  }, [barId, user?.id, getUserReview]);

  const handleSubmit = async () => {
    if (!rating || !user?.id || !barId) {
      Alert.alert('Error', 'Please select a rating and make sure you are logged in.');
      return;
    }

    if (!comment.trim()) {
      Alert.alert('Error', 'Please write a review comment.');
      return;
    }

    setLoading(true);

    try {
      let success = false;
      
      if (existingReview) {
        // Update existing review
        success = await updateReview(existingReview.id, rating, comment.trim());
      } else {
        // Create new review
        success = await createReview(barId, user.id, rating, comment.trim());
      }

      if (success) {
        Alert.alert('Success', existingReview ? 'Review updated successfully!' : 'Review posted successfully!', [
          { text: 'OK', onPress: () => router.back() }
        ]);
      } else {
        Alert.alert('Error', 'Failed to post review. Please try again.');
      }
    } catch (error) {
      console.error('❌ Error posting review:', error);
      Alert.alert('Error', 'Failed to post review. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    router.back();
  };

  return (
    <View style={styles.container}>
      <Stack.Screen 
        options={{ 
          headerShown: false,
          title: 'Write a Review'
        }} 
      />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {existingReview ? 'Editar Reseña' : 'Escribir Reseña'}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Bar Information */}
      {bar && (
        <View style={styles.barSection}>
          <Image
            source={{
              uri: bar.image_url || 'https://via.placeholder.com/120x120/2A3A4A/A3B3CC?text=Bar'
            }}
            style={styles.barImage}
            resizeMode="cover"
          />
          <View style={styles.barInfo}>
            <Text style={styles.barName}>{bar.name}</Text>
            <Text style={styles.barType}>{bar.category?.name || 'Bar'}</Text>
          </View>
        </View>
      )}

      {/* Rating Section */}
      <View style={styles.ratingSection}>
        <Text style={styles.ratingTitle}>Valora tu experiencia</Text>
        <View style={styles.ratingRow}>
          {[1, 2, 3, 4, 5].map((value) => (
            <TouchableOpacity
              key={value}
              style={[
                styles.ratingButton,
                rating !== null && value <= rating && styles.ratingButtonSelected
              ]}
              onPress={() => setRating(value)}
            >
              <Text style={styles.ratingText}>
                {value}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Review Input */}
      <View style={styles.inputSection}>
        <Text style={styles.inputLabel}>Escribe tu Valoración</Text>
        <TextInput
          placeholder="Write your review..."
          value={comment}
          onChangeText={setComment}
          multiline
          style={styles.textInput}
          placeholderTextColor="#94A3B8"
          textAlignVertical="top"
        />
      </View>

      {/* Submit Button */}
      <TouchableOpacity 
        style={[
          styles.submitButton, 
          (!rating || !comment.trim() || loading) && styles.submitButtonDisabled
        ]} 
        onPress={handleSubmit}
        disabled={!rating || !comment.trim() || loading}
      >
        <Text style={[
          styles.submitButtonText,
          (!rating || !comment.trim() || loading) && styles.submitButtonTextDisabled
        ]}>
          {loading ? 'Publicando...' : 'Publicar Reseña'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1C2A3A',
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2A3A4A',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerSpacer: {
    width: 40, // Same width as back button for centering
  },
  barSection: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#1A2332',
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2A3A4A',
  },
  barImage: {
    width: 120,
    height: 120,
    borderRadius: 12,
    marginRight: 16,
  },
  barInfo: {
    flex: 1,
  },
  barName: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  barType: {
    color: '#94A3B8',
    fontSize: 14,
  },
  inputLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  ratingSection: {
    padding: 20,
    backgroundColor: '#1A2332',
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2A3A4A',
  },
  ratingTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  ratingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  ratingButton: {
    borderWidth: 1,
    borderColor: '#2A3A4A',
    borderRadius: 12,
    padding: 12,
    width: 48,
    alignItems: 'center',
    backgroundColor: '#2A3A4A',
  },
  ratingButtonSelected: {
    backgroundColor: '#1976D2',
    borderColor: '#1976D2',
  },
  ratingText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },

  inputSection: {
    padding: 20,
    flex: 1,
    backgroundColor: '#1A2332',
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2A3A4A',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#2A3A4A',
    borderRadius: 12,
    height: 120,
    padding: 16,
    color: '#FFFFFF',
    fontSize: 16,
    backgroundColor: '#2A3A4A',
  },
  submitButton: {
    backgroundColor: '#1976D2',
    paddingVertical: 16,
    marginHorizontal: 20,
    marginBottom: Platform.OS === 'ios' ? 40 : 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#2A3A4A',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  submitButtonTextDisabled: {
    color: '#94A3B8',
  },
}); 