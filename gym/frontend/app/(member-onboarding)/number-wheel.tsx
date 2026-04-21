import React, { useEffect, useMemo, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

type NumberWheelProps = {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
};

const ITEM_HEIGHT = 56;
const VISIBLE_COUNT = 5;
const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_COUNT;
const PICKER_PADDING = (PICKER_HEIGHT - ITEM_HEIGHT) / 2;

export function NumberWheel({ value, min, max, onChange }: NumberWheelProps) {
  const scrollRef = useRef<ScrollView>(null);
  const values = useMemo(() => Array.from({ length: max - min + 1 }, (_, i) => min + i), [min, max]);

  const clamp = (n: number) => Math.max(min, Math.min(max, n));

  useEffect(() => {
    const index = clamp(value) - min;
    const y = index * ITEM_HEIGHT;
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y, animated: false });
    });
  }, [min, value]);

  const onScrollDone = (y: number) => {
    const rawIndex = Math.round(y / ITEM_HEIGHT);
    const nextValue = clamp(min + rawIndex);
    if (nextValue !== value) {
      onChange(nextValue);
    }

    const snappedY = (nextValue - min) * ITEM_HEIGHT;
    scrollRef.current?.scrollTo({ y: snappedY, animated: true });
  };

  return (
    <View style={styles.wrap}>
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={{ paddingVertical: PICKER_PADDING }}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        onMomentumScrollEnd={(e) => onScrollDone(e.nativeEvent.contentOffset.y)}
        onScrollEndDrag={(e) => onScrollDone(e.nativeEvent.contentOffset.y)}
      >
        {values.map((item) => {
          const selected = item === value;
          return (
            <Pressable key={item} style={styles.item} onPress={() => onChange(item)}>
              <Text style={[styles.text, selected && styles.textSelected]}>{item}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View pointerEvents="none" style={styles.selectionTop} />
      <View pointerEvents="none" style={styles.selectionBottom} />
    </View>
  );
}

// This file is also discovered as a route by Expo Router, so provide a default component.
export default function NumberWheelRoutePlaceholder() {
  return (
    <View style={styles.routePlaceholderWrap}>
      <Text style={styles.routePlaceholderText}>Number wheel component file.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: PICKER_HEIGHT,
    width: 150,
    position: 'relative',
  },
  scroll: {
    flex: 1,
  },
  item: {
    height: ITEM_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontSize: 24,
    color: '#a6a6a8',
    fontWeight: '700',
  },
  textSelected: {
    fontSize: 48,
    color: '#17c700',
  },
  selectionTop: {
    position: 'absolute',
    width: 92,
    height: 4,
    borderRadius: 3,
    backgroundColor: '#17c700',
    top: (PICKER_HEIGHT - ITEM_HEIGHT) / 2 - 2,
    alignSelf: 'center',
  },
  selectionBottom: {
    position: 'absolute',
    width: 92,
    height: 4,
    borderRadius: 3,
    backgroundColor: '#17c700',
    bottom: (PICKER_HEIGHT - ITEM_HEIGHT) / 2 - 2,
    alignSelf: 'center',
  },
  routePlaceholderWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#ffffff',
  },
  routePlaceholderText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
});
