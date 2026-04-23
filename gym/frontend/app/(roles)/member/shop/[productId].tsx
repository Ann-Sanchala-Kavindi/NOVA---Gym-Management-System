import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { getAuthState } from '@/lib/auth-state';
import { AppColors } from '@/constants/theme';
import { memberApi, ShopProduct } from '@/lib/member-api';
import { useShopCart } from '@/lib/shop-cart';
import { PageHeader } from '@/components/ui/trainer-dashboard';
import { getImageUrl } from '@/lib/image-utils';

const formatCurrency = (value: number) => `$${value.toFixed(2)}`;

export default function ProductDetailPage() {
  const router = useRouter();
  const { productId } = useLocalSearchParams<{ productId?: string }>();
  const token = getAuthState().token;

  const [product, setProduct] = useState<ShopProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const { itemCount, addProduct } = useShopCart();

  const loadProduct = useCallback(async () => {
    if (!token || !productId) {
      setLoading(false);
      return;
    }

    try {
      const products = await memberApi.listShopProducts(token);
      const matched = products.find((p) => p._id === productId) || null;
      setProduct(matched);
      if (!matched) {
        Alert.alert('Not found', 'Product is no longer available.');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load product';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  }, [productId, token]);

  useFocusEffect(
    useCallback(() => {
      loadProduct();
    }, [loadProduct])
  );

  const increment = () => {
    if (!product) return;
    setQuantity((prev) => Math.min(prev + 1, Math.max(1, product.stock)));
  };

  const decrement = () => setQuantity((prev) => Math.max(1, prev - 1));

  const handleAddToCart = () => {
    if (!product) return;
    if (product.stock < quantity) {
      Alert.alert('Out of stock', `${product.name} has only ${product.stock} left.`);
      return;
    }

    addProduct(product, quantity);
    Alert.alert('Added to cart', `${product.name} x${quantity} added to your cart.`);
  };

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={AppColors.primary} />
      </View>
    );
  }

  if (!product) {
    return (
      <View style={styles.loadingWrap}>
        <Text style={styles.emptyText}>Product not available.</Text>
        <TouchableOpacity style={styles.secondaryButton} onPress={() => (router.canGoBack() ? router.back() : router.replace('/(roles)/member/shop'))}>
          <Text style={styles.secondaryButtonText}>Back to shop</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const total = formatCurrency(product.price * quantity);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 120 }}>
      <PageHeader
        title="Product Details"
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/(roles)/member/shop'))}
      />

      <View style={styles.heroImageWrap}>
        {product.imageUrl ? (
          <Image source={{ uri: getImageUrl(product.imageUrl) }} style={styles.heroImage} resizeMode="cover" />
        ) : (
          <View style={styles.heroPlaceholder}>
            <Text style={styles.placeholderEmoji}>🛍️</Text>
          </View>
        )}
        <View style={[styles.badge, product.isActive ? styles.badgeActive : styles.badgeInactive]}>
          <Text style={[styles.badgeText, product.isActive ? styles.badgeTextActive : styles.badgeTextInactive]}>
            {product.isActive ? 'AVAILABLE' : 'HIDDEN'}
          </Text>
        </View>
      </View>

      <View style={styles.contentWrap}>
        <Text style={styles.productName}>{product.name}</Text>
        <Text style={styles.productPrice}>{formatCurrency(product.price)}</Text>
        <Text style={styles.productDescription}>{product.description || 'No description provided.'}</Text>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Stock</Text>
          <Text style={[styles.infoValue, product.stock <= 3 ? styles.infoValueLow : null]}>
            {product.stock > 0 ? `${product.stock} available` : 'Out of stock'}
          </Text>
        </View>

        <View style={styles.quantityRow}>
          <Text style={styles.infoLabel}>Quantity</Text>
          <View style={styles.stepper}>
            <TouchableOpacity style={styles.stepperButton} onPress={decrement}>
              <Text style={styles.stepperButtonText}>-</Text>
            </TouchableOpacity>
            <Text style={styles.quantityValue}>{quantity}</Text>
            <TouchableOpacity style={styles.stepperButton} onPress={increment}>
              <Text style={styles.stepperButtonText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryValue}>{total}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Payment</Text>
            <Text style={styles.summaryValueMuted}>Collected at gym counter</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleAddToCart}
          disabled={product.stock < 1}
        >
          <Text style={styles.primaryButtonText}>ADD TO CART • {total}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryButton} onPress={() => router.push('/(roles)/member/shop/cart' as any)}>
          <Text style={styles.secondaryButtonText}>GO TO CART ({itemCount})</Text>
        </TouchableOpacity>

        <View style={styles.faqCard}>
          <Text style={styles.faqTitle}>Need help?</Text>
          <Text style={styles.faqText}>Orders are prepared by our staff. You will get an in-app notification when your order is confirmed.</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: '#f8fafc',
  },
  emptyText: { fontSize: 14, color: '#475569', marginBottom: 12, textAlign: 'center' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 10,
  },
  backButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
  topBarTitle: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
  heroImageWrap: {
    marginHorizontal: 16,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#e2e8f0',
    height: 240,
    position: 'relative',
  },
  heroImage: { width: '100%', height: '100%' },
  heroPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  placeholderEmoji: { fontSize: 38 },
  badge: {
    position: 'absolute',
    top: 12,
    left: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  badgeActive: { backgroundColor: '#e8f7ec' },
  badgeInactive: { backgroundColor: '#fef3c7' },
  badgeText: { fontSize: 11, fontWeight: '800' },
  badgeTextActive: { color: '#065f46' },
  badgeTextInactive: { color: '#92400e' },
  contentWrap: { paddingHorizontal: 16, paddingTop: 16, gap: 12 },
  productName: { fontSize: 20, fontWeight: '800', color: '#0f172a' },
  productPrice: { fontSize: 18, fontWeight: '800', color: AppColors.primaryDark },
  productDescription: { fontSize: 14, color: '#475569', lineHeight: 20 },
  infoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  infoLabel: { fontSize: 13, color: '#475569', fontWeight: '700' },
  infoValue: { fontSize: 13, color: '#0f172a', fontWeight: '700' },
  infoValueLow: { color: '#c2410c' },
  quantityRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e2e8f0',
    borderRadius: 12,
  },
  stepperButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperButtonText: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  quantityValue: { width: 36, textAlign: 'center', fontSize: 15, fontWeight: '800', color: '#0f172a' },
  summaryCard: {
    backgroundColor: '#0f172a',
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: { fontSize: 13, color: '#cbd5f5', fontWeight: '700' },
  summaryValue: { fontSize: 15, color: '#ffffff', fontWeight: '800' },
  summaryValueMuted: { fontSize: 13, color: '#cbd5f5' },
  primaryButton: {
    backgroundColor: AppColors.primary,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  primaryButtonText: { color: '#ffffff', fontWeight: '800', fontSize: 14, letterSpacing: 0.5 },
  secondaryButton: {
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  secondaryButtonText: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
  faqCard: {
    marginTop: 10,
    backgroundColor: '#eef2ff',
    borderRadius: 12,
    padding: 12,
  },
  faqTitle: { fontSize: 14, fontWeight: '800', color: '#3730a3', marginBottom: 4 },
  faqText: { fontSize: 13, color: '#4338ca', lineHeight: 18 },
});
