import React, { useMemo, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';

import { getAuthState } from '@/lib/auth-state';
import { AppColors } from '@/constants/theme';
import { memberApi } from '@/lib/member-api';
import { useShopCart } from '@/lib/shop-cart';
import { PageHeader, SurfaceCard } from '@/components/ui/trainer-dashboard';
import { getImageUrl } from '@/lib/image-utils';

const formatCurrency = (value: number) => `$${value.toFixed(2)}`;

export default function MemberShopCartPage() {
  const router = useRouter();
  const token = getAuthState().token;
  const [checkingOut, setCheckingOut] = useState(false);

  const {
    items,
    itemCount,
    totalAmount,
    setItemQuantity,
    removeProduct,
    clearCart,
  } = useShopCart();

  const payloadItems = useMemo(
    () => items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
    [items]
  );

  const checkout = async () => {
    if (!token) {
      Alert.alert('Login required', 'Please log in again to place your order.');
      return;
    }

    if (!payloadItems.length) {
      Alert.alert('Cart is empty', 'Add products before checkout.');
      return;
    }

    setCheckingOut(true);
    try {
      await memberApi.createOrder(payloadItems, token);
      clearCart();
      Alert.alert('Success', 'Order placed successfully.');
      router.replace('/(roles)/member/shop' as any);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to place order';
      Alert.alert('Error', message);
    } finally {
      setCheckingOut(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentWrap}>
      <PageHeader title="My Cart" subtitle="Buy multiple products together" onBack={() => (router.canGoBack() ? router.back() : router.replace('/(roles)/member/shop'))} />

      <View style={styles.bodyWrap}>
        {items.length === 0 ? (
          <SurfaceCard>
            <Text style={styles.emptyText}>Your cart is empty.</Text>
            <TouchableOpacity style={styles.secondaryButton} onPress={() => router.push('/(roles)/member/shop' as any)}>
              <Text style={styles.secondaryButtonText}>Browse Products</Text>
            </TouchableOpacity>
          </SurfaceCard>
        ) : (
          items.map((item) => (
            <SurfaceCard key={item.productId}>
              <View style={styles.itemRow}>
                {item.imageUrl ? (
                  <Image source={{ uri: getImageUrl(item.imageUrl) }} style={styles.image} resizeMode="cover" />
                ) : (
                  <View style={styles.imagePlaceholder}>
                    <Text style={styles.placeholderEmoji}>🛍️</Text>
                  </View>
                )}

                <View style={styles.itemContent}>
                  <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
                  <Text style={styles.itemPrice}>{formatCurrency(item.price)} each</Text>
                  <Text style={styles.itemSubtotal}>{formatCurrency(item.price * item.quantity)}</Text>

                  <View style={styles.controlsRow}>
                    <View style={styles.stepper}>
                      <TouchableOpacity style={styles.stepperButton} onPress={() => setItemQuantity(item.productId, item.quantity - 1)}>
                        <Text style={styles.stepperButtonText}>-</Text>
                      </TouchableOpacity>
                      <Text style={styles.quantityText}>{item.quantity}</Text>
                      <TouchableOpacity style={styles.stepperButton} onPress={() => setItemQuantity(item.productId, item.quantity + 1)}>
                        <Text style={styles.stepperButtonText}>+</Text>
                      </TouchableOpacity>
                    </View>

                    <TouchableOpacity onPress={() => removeProduct(item.productId)}>
                      <Text style={styles.removeText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </SurfaceCard>
          ))
        )}

        <SurfaceCard>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Items</Text>
            <Text style={styles.summaryValue}>{itemCount}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total</Text>
            <Text style={styles.summaryValue}>{formatCurrency(totalAmount)}</Text>
          </View>
          <Text style={styles.summaryHint}>Payment collected at gym counter.</Text>

          <TouchableOpacity
            style={[styles.checkoutButton, (!items.length || checkingOut) ? styles.checkoutButtonDisabled : null]}
            onPress={checkout}
            disabled={!items.length || checkingOut}
          >
            <Text style={styles.checkoutButtonText}>{checkingOut ? 'PLACING ORDER...' : 'CHECKOUT'}</Text>
          </TouchableOpacity>
        </SurfaceCard>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  contentWrap: {
    paddingBottom: 120,
  },
  bodyWrap: {
    paddingHorizontal: 16,
    gap: 10,
  },
  emptyText: {
    fontSize: 14,
    color: '#475569',
    textAlign: 'center',
    marginBottom: 10,
  },
  itemRow: {
    flexDirection: 'row',
    gap: 12,
  },
  image: {
    width: 84,
    height: 84,
    borderRadius: 10,
    backgroundColor: '#e2e8f0',
  },
  imagePlaceholder: {
    width: 84,
    height: 84,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e2e8f0',
  },
  placeholderEmoji: {
    fontSize: 24,
  },
  itemContent: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  itemPrice: {
    marginTop: 2,
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  itemSubtotal: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: '800',
    color: AppColors.primaryDark,
  },
  controlsRow: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e2e8f0',
    borderRadius: 12,
  },
  stepperButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperButtonText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  quantityText: {
    width: 28,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  removeText: {
    color: '#b91c1c',
    fontWeight: '700',
    fontSize: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  summaryLabel: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '700',
  },
  summaryValue: {
    fontSize: 15,
    color: '#0f172a',
    fontWeight: '900',
  },
  summaryHint: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
    marginBottom: 10,
  },
  checkoutButton: {
    backgroundColor: AppColors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  checkoutButtonDisabled: {
    opacity: 0.6,
  },
  checkoutButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  secondaryButton: {
    marginTop: 8,
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  secondaryButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
});
