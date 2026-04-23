import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { getAuthState } from '@/lib/auth-state';
import { memberApi, ShopOrder, ShopProduct } from '@/lib/member-api';
import { useShopCart } from '@/lib/shop-cart';
import { AppColors } from '@/constants/theme';
import { PageHeader, SectionHeader, SurfaceCard } from '@/components/ui/trainer-dashboard';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getImageUrl } from '@/lib/image-utils';

const formatCurrency = (value: number) => `$${value.toFixed(2)}`;

type SortMode = 'featured' | 'price-low' | 'price-high' | 'name';
type ShopTab = 'products' | 'orders';

const inferCategory = (product: ShopProduct) => {
  const haystack = `${product.name} ${product.description}`.toLowerCase();
  if (/protein|supplement|creatine|whey|bcaa|vitamin|mass/.test(haystack)) return 'Supplements';
  if (/glove|band|belt|bag|shaker|bottle|towel/.test(haystack)) return 'Accessories';
  if (/mat|dumbbell|rope|bar|equipment|kettlebell/.test(haystack)) return 'Equipment';
  if (/bar|snack|meal|oats|nutrition/.test(haystack)) return 'Nutrition';
  return 'Other';
};

export default function MemberShopPage() {
  const router = useRouter();
  const authState = getAuthState();
  const token = authState.token;

  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [orders, setOrders] = useState<ShopOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<ShopTab>('products');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('featured');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const { itemCount, addProduct, refreshStock } = useShopCart();

  const loadData = useCallback(async () => {
    if (!token) {
      Alert.alert('Login required', 'Please log in again to access shop products.');
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const [productData, orderData] = await Promise.all([
        memberApi.listShopProducts(token),
        memberApi.listMyOrders(token),
      ]);
      setProducts(productData || []);
      setOrders(orderData || []);
      refreshStock(productData || []);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load shop';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleAddToCart = (product: ShopProduct) => {
    if (product.stock < 1) {
      Alert.alert('Out of stock', `${product.name} is currently unavailable.`);
      return;
    }

    addProduct(product, 1);
    Alert.alert('Added to cart', `${product.name} is in your cart.`);
  };

  const activeProducts = useMemo(
    () => (products || []).filter((product) => product.isActive),
    [products]
  );

  const categories = useMemo(() => {
    const unique = new Set<string>();
    activeProducts.forEach((product) => unique.add(inferCategory(product)));
    return ['all', ...Array.from(unique)];
  }, [activeProducts]);

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let list = activeProducts.filter((product) => {
      const matchesQuery =
        !q ||
        product.name.toLowerCase().includes(q) ||
        (product.description || '').toLowerCase().includes(q);

      const category = inferCategory(product);
      const matchesCategory = activeCategory === 'all' ? true : category === activeCategory;

      return matchesQuery && matchesCategory;
    });

    if (sortMode === 'price-low') {
      list = [...list].sort((a, b) => a.price - b.price);
    } else if (sortMode === 'price-high') {
      list = [...list].sort((a, b) => b.price - a.price);
    } else if (sortMode === 'name') {
      list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    }

    return list;
  }, [activeProducts, searchQuery, activeCategory, sortMode]);

  const sortedOrders = useMemo(
    () => [...orders].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [orders]
  );

  const renderProductCard = ({ item }: { item: ShopProduct }) => (
    <View style={styles.productCard}>
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => router.push({ pathname: '/(roles)/member/shop/[productId]', params: { productId: item._id } })}
      >
        <View style={styles.productImageWrap}>
          {item.imageUrl ? (
            <Image source={{ uri: getImageUrl(item.imageUrl) }} style={styles.productImage} resizeMode="cover" />
          ) : (
            <View style={styles.productImagePlaceholder}>
              <Text style={styles.placeholderEmoji}>🛍️</Text>
            </View>
          )}
          <View style={[styles.stockPill, item.stock > 3 ? styles.stockPillHealthy : styles.stockPillLow]}>
            <Text style={[styles.stockPillText, item.stock <= 3 ? styles.stockPillTextLow : null]}>
              {item.stock > 0 ? `${item.stock} in stock` : 'Out of stock'}
            </Text>
          </View>
        </View>
        <Text style={styles.productName} numberOfLines={2}>
          {item.name}
        </Text>
        <Text style={styles.productDescription} numberOfLines={2}>
          {item.description || 'No description provided.'}
        </Text>
        <View style={styles.productMetaRow}>
          <Text style={styles.productPrice}>{formatCurrency(item.price)}</Text>
          <Text style={styles.productCategory}>{inferCategory(item)}</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.buyButton}
        onPress={() => handleAddToCart(item)}
      >
        <MaterialCommunityIcons name="cart-plus" size={16} color="#ffffff" />
        <Text style={styles.buyButtonText}>ADD TO CART</Text>
      </TouchableOpacity>
    </View>
  );

  const renderOrderCard = ({ item }: { item: ShopOrder }) => (
    <View style={styles.orderRow}>
      <View style={styles.orderIconWrap}>
        <MaterialCommunityIcons name="receipt-text-outline" size={16} color="#3730a3" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.orderText}>Order #{item._id.slice(-6).toUpperCase()}</Text>
        <Text style={styles.orderSubtext}>{new Date(item.createdAt).toLocaleString()}</Text>
        <Text style={styles.orderItemsText} numberOfLines={2}>
          {(item.items || []).map((orderItem) => `${orderItem.name} x${orderItem.quantity}`).join(' • ')}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 6 }}>
        <View style={styles.orderStatusPill}>
          <Text style={styles.orderStatus}>{item.status.toUpperCase()}</Text>
        </View>
        <Text style={styles.orderTotal}>{formatCurrency(item.totalAmount || 0)}</Text>
      </View>
    </View>
  );

  const renderHeader = (showProductTools: boolean) => (
    <View style={styles.headerWrap}>
      <PageHeader
        title="Member Shop"
        subtitle="Curated gear, nutrition, and essentials."
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/(roles)/member'))}
      />
      <View style={styles.heroCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.heroEyebrow}>NEW</Text>
          <Text style={styles.heroTitle}>Upgrade your training stack</Text>
          <Text style={styles.heroSubtitle}>Shop products picked by your trainers.</Text>
        </View>
        <View style={styles.heroBadge}>
          <Text style={styles.heroBadgeText}>🔥 Fresh drops</Text>
        </View>
      </View>
      <TouchableOpacity style={styles.cartSummaryCard} onPress={() => router.push('/(roles)/member/shop/cart' as any)}>
        <View style={styles.cartInfoLeft}>
          <MaterialCommunityIcons name="cart-outline" size={20} color="#0f172a" />
          <View>
            <Text style={styles.cartSummaryLabel}>Cart</Text>
            <Text style={styles.cartSummaryCount}>{itemCount} item{itemCount === 1 ? '' : 's'}</Text>
          </View>
        </View>
        <Text style={styles.cartSummaryAction}>View Cart</Text>
      </TouchableOpacity>

      <View style={styles.tabsRow}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'products' && styles.tabButtonActive]}
          onPress={() => setActiveTab('products')}
        >
          <MaterialCommunityIcons name="shopping-outline" size={16} color={activeTab === 'products' ? '#0369a1' : '#64748b'} />
          <Text style={[styles.tabButtonText, activeTab === 'products' && styles.tabButtonTextActive]}>Buy Products</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'orders' && styles.tabButtonActive]}
          onPress={() => setActiveTab('orders')}
        >
          <MaterialCommunityIcons name="clipboard-list-outline" size={16} color={activeTab === 'orders' ? '#0369a1' : '#64748b'} />
          <Text style={[styles.tabButtonText, activeTab === 'orders' && styles.tabButtonTextActive]}>My Orders</Text>
        </TouchableOpacity>
      </View>

      {showProductTools ? (
        <>
          <View style={styles.searchWrap}>
            <MaterialCommunityIcons name="magnify" size={20} color="#64748b" />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search products..."
              style={styles.searchInput}
              placeholderTextColor="#94a3b8"
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <MaterialCommunityIcons name="close-circle" size={18} color="#94a3b8" />
              </TouchableOpacity>
            ) : null}
          </View>

          <View style={styles.filterBlock}>
            <Text style={styles.filterTitle}>Category</Text>
            <View style={styles.filterRow}>
              {categories.map((category) => {
                const active = activeCategory === category;
                return (
                  <TouchableOpacity
                    key={category}
                    onPress={() => setActiveCategory(category)}
                    style={[styles.filterChip, active && styles.filterChipActive]}
                  >
                    <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                      {category === 'all' ? 'All' : category}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.filterTitle}>Sort By</Text>
            <View style={styles.filterRow}>
              {([
                { key: 'featured', label: 'Featured' },
                { key: 'price-low', label: 'Price ↑' },
                { key: 'price-high', label: 'Price ↓' },
                { key: 'name', label: 'Name' },
              ] as const).map((option) => {
                const active = sortMode === option.key;
                return (
                  <TouchableOpacity
                    key={option.key}
                    onPress={() => setSortMode(option.key)}
                    style={[styles.filterChip, active && styles.filterChipActive]}
                  >
                    <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <SectionHeader title={`Products (${filteredProducts.length})`} />
        </>
      ) : (
        <SectionHeader title={`My Orders (${sortedOrders.length})`} />
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={AppColors.primary} />
      </View>
    );
  }

  if (activeTab === 'orders') {
    return (
      <FlatList
        key="orders-list"
        data={sortedOrders}
        keyExtractor={(item) => item._id}
        renderItem={renderOrderCard}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={renderHeader(false)}
        ListEmptyComponent={
          <SurfaceCard>
            <Text style={styles.productDescription}>You have not placed any orders yet.</Text>
          </SurfaceCard>
        }
        refreshing={refreshing}
        onRefresh={onRefresh}
      />
    );
  }

  return (
    <FlatList
      key="products-grid"
      data={filteredProducts}
      numColumns={2}
      columnWrapperStyle={styles.productRow}
      keyExtractor={(item) => item._id}
      renderItem={renderProductCard}
      contentContainerStyle={styles.listContent}
      ListHeaderComponent={renderHeader(true)}
      ListEmptyComponent={
        <SurfaceCard>
          <Text style={styles.productDescription}>No products match your current search or filters.</Text>
        </SurfaceCard>
      }
      refreshing={refreshing}
      onRefresh={onRefresh}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8f9fa' },
  listContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 120, gap: 12 },
  headerWrap: { gap: 10 },
  heroCard: {
    backgroundColor: '#0f172a',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  heroEyebrow: { color: '#a5b4fc', fontWeight: '800', fontSize: 12, letterSpacing: 0.5, marginBottom: 4 },
  heroTitle: { color: '#ffffff', fontSize: 18, fontWeight: '800', marginBottom: 6 },
  heroSubtitle: { color: '#cbd5f5', fontSize: 13, lineHeight: 18 },
  heroBadge: {
    backgroundColor: '#f97316',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
  },
  heroBadgeText: { color: '#ffffff', fontWeight: '800', fontSize: 12 },
  cartSummaryCard: {
    backgroundColor: '#ecfeff',
    borderWidth: 1,
    borderColor: '#bae6fd',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cartSummaryLabel: {
    color: '#0f172a',
    fontSize: 12,
    fontWeight: '700',
  },
  cartSummaryCount: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '900',
    marginTop: 2,
  },
  cartSummaryAction: {
    color: '#0369a1',
    fontSize: 13,
    fontWeight: '800',
  },
  cartInfoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  tabsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderBottomWidth: 1,
    borderBottomColor: '#dbe5ef',
    marginTop: 2,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    backgroundColor: '#f8fafc',
  },
  tabButtonActive: {
    borderBottomColor: '#0ea5e9',
    backgroundColor: '#ffffff',
  },
  tabButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#64748b',
  },
  tabButtonTextActive: {
    color: '#0f172a',
    fontWeight: '800',
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#dbe5ef',
    borderRadius: 12,
    paddingHorizontal: 12,
    backgroundColor: '#ffffff',
    minHeight: 46,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0f172a',
    paddingVertical: 9,
  },
  filterBlock: {
    borderWidth: 1,
    borderColor: '#e6edf5',
    borderRadius: 14,
    padding: 12,
    backgroundColor: '#ffffff',
    gap: 8,
  },
  filterTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#334155',
    marginTop: 2,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    borderWidth: 1,
    borderColor: '#d7e2ee',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: '#f8fafc',
  },
  filterChipActive: {
    borderColor: '#0284c7',
    backgroundColor: '#e0f2fe',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  filterChipTextActive: {
    color: '#0369a1',
  },
  productRow: { gap: 12 },
  productCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e9eef3',
    gap: 8,
  },
  productImageWrap: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#f1f5f9',
    height: 140,
    marginBottom: 6,
  },
  productImage: { width: '100%', height: '100%' },
  productImagePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderEmoji: { fontSize: 28 },
  stockPill: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  stockPillHealthy: { backgroundColor: '#e7f7ec' },
  stockPillLow: { backgroundColor: '#fff1d6' },
  stockPillText: { fontSize: 11, fontWeight: '700', color: '#0f172a' },
  stockPillTextLow: { color: '#c2410c' },
  productName: { fontSize: 15, fontWeight: '800', color: '#1f2b33' },
  productDescription: { fontSize: 13, color: '#667085', lineHeight: 18 },
  productMetaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  productPrice: { fontSize: 15, fontWeight: '800', color: AppColors.primaryDark },
  productCategory: { fontSize: 11, fontWeight: '700', color: '#475569' },
  buyButton: {
    marginTop: 4,
    backgroundColor: AppColors.primary,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  buyButtonText: { color: '#ffffff', fontWeight: '800', fontSize: 13, letterSpacing: 0.5 },
  ordersSection: { marginTop: 18, gap: 8 },
  orderRow: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e9eef3',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  orderText: { fontSize: 14, fontWeight: '800', color: '#111827' },
  orderSubtext: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  orderIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#e0e7ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  orderItemsText: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
  },
  orderTotal: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  orderStatusPill: {
    backgroundColor: '#eef2ff',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  orderStatus: { fontSize: 12, fontWeight: '800', color: '#3730a3' },
});
