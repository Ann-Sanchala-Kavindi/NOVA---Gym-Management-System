import { useSyncExternalStore } from 'react';

import type { ShopProduct } from './member-api';

export type CartItem = {
  productId: string;
  name: string;
  price: number;
  imageUrl: string;
  stock: number;
  quantity: number;
};

type CartSnapshot = {
  items: CartItem[];
};

const cartState: CartSnapshot = {
  items: [],
};

const listeners = new Set<() => void>();

function emitChange() {
  listeners.forEach((listener) => listener());
}

function clampQuantity(quantity: number, stock: number) {
  const safeStock = Math.max(0, Math.floor(Number(stock) || 0));
  const safeQuantity = Math.floor(Number(quantity) || 0);
  if (safeStock <= 0) return 0;
  return Math.max(1, Math.min(safeQuantity, safeStock));
}

function updateStock(item: CartItem, nextStock: number) {
  const stock = Math.max(0, Math.floor(Number(nextStock) || 0));
  const quantity = clampQuantity(item.quantity, stock);
  return {
    ...item,
    stock,
    quantity,
  };
}

function upsertProduct(product: ShopProduct, quantity: number) {
  const safeStock = Math.max(0, Math.floor(Number(product.stock) || 0));
  if (safeStock <= 0) {
    return;
  }

  const existingIndex = cartState.items.findIndex((item) => item.productId === product._id);
  if (existingIndex < 0) {
    const initialQuantity = clampQuantity(quantity, safeStock);
    if (initialQuantity <= 0) return;

    cartState.items = [
      ...cartState.items,
      {
        productId: product._id,
        name: product.name,
        price: Number(product.price) || 0,
        imageUrl: product.imageUrl || '',
        stock: safeStock,
        quantity: initialQuantity,
      },
    ];
    emitChange();
    return;
  }

  const existing = cartState.items[existingIndex];
  const nextQuantity = clampQuantity(existing.quantity + quantity, safeStock);
  const nextItems = [...cartState.items];
  nextItems[existingIndex] = {
    ...existing,
    name: product.name,
    price: Number(product.price) || 0,
    imageUrl: product.imageUrl || '',
    stock: safeStock,
    quantity: nextQuantity,
  };
  cartState.items = nextItems;
  emitChange();
}

function remove(productId: string) {
  const before = cartState.items.length;
  cartState.items = cartState.items.filter((item) => item.productId !== productId);
  if (before !== cartState.items.length) {
    emitChange();
  }
}

function setQuantity(productId: string, quantity: number) {
  const index = cartState.items.findIndex((item) => item.productId === productId);
  if (index < 0) {
    return;
  }

  const current = cartState.items[index];
  const normalizedQuantity = clampQuantity(quantity, current.stock);

  if (normalizedQuantity <= 0) {
    remove(productId);
    return;
  }

  const nextItems = [...cartState.items];
  nextItems[index] = {
    ...current,
    quantity: normalizedQuantity,
  };

  cartState.items = nextItems;
  emitChange();
}

function refreshStock(products: ShopProduct[]) {
  if (!Array.isArray(products) || products.length === 0 || cartState.items.length === 0) {
    return;
  }

  const stockMap = new Map(products.map((product) => [product._id, product.stock]));
  let changed = false;

  const nextItems = cartState.items
    .map((item) => {
      if (!stockMap.has(item.productId)) {
        changed = true;
        return null;
      }

      const next = updateStock(item, Number(stockMap.get(item.productId) || 0));
      if (next.quantity <= 0) {
        changed = true;
        return null;
      }

      if (next.quantity !== item.quantity || next.stock !== item.stock) {
        changed = true;
      }

      return next;
    })
    .filter(Boolean) as CartItem[];

  if (changed) {
    cartState.items = nextItems;
    emitChange();
  }
}

function clear() {
  if (!cartState.items.length) return;
  cartState.items = [];
  emitChange();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return cartState.items;
}

export function useShopCart() {
  const items = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalAmount = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return {
    items,
    itemCount,
    totalAmount,
    addProduct: upsertProduct,
    removeProduct: remove,
    setItemQuantity: setQuantity,
    clearCart: clear,
    refreshStock,
  };
}
