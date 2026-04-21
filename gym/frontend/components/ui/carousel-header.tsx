import React, { useEffect, useRef } from 'react';
import { Animated, FlatList, StyleSheet, Text, TouchableOpacity, View, Dimensions, ScrollView, Image, ImageBackground } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AppColors } from '@/constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export interface CarouselSlide {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  bgColor: string;
  textColor: string;
  iconColor: string;
  image?: any;
  route?: string;
}

const DEFAULT_SLIDES: CarouselSlide[] = [
  {
    id: '1',
    title: 'Ready to Workout?',
    subtitle: 'Start your fitness journey today',
    icon: 'dumbbell',
    bgColor: '#E8F7F0',
    textColor: '#1a2f2a',
    iconColor: AppColors.primary,
  },
  {
    id: '2',
    title: 'Nutrition Matters',
    subtitle: 'Follow your personalized meal plan',
    icon: 'leaf-circle',
    bgColor: '#FFF5E8',
    textColor: '#2a1f14',
    iconColor: '#FF9800',
  },
  {
    id: '3',
    title: 'Track Progress',
    subtitle: 'View your fitness stats and achievements',
    icon: 'chart-line',
    bgColor: '#E8F4FF',
    textColor: '#0f2847',
    iconColor: '#2196F3',
  },
  {
    id: '4',
    title: 'Book Trainer',
    subtitle: 'Get professional guidance and support',
    icon: 'account-tie',
    bgColor: '#F8E8FF',
    textColor: '#2a1a3a',
    iconColor: '#9C27B0',
  },
];

interface CarouselHeaderProps {
  slides?: CarouselSlide[];
  userGreeting?: string;
  memberName?: string;
  trainerName?: string;
  rightBadges?: React.ReactNode;
  onSlideChange?: (index: number) => void;
  autoScroll?: boolean;
  autoScrollInterval?: number;
  onSlidePress?: (slide: CarouselSlide) => void;
}

export function CarouselHeader({
  slides = DEFAULT_SLIDES,
  userGreeting,
  memberName,
  trainerName,
  rightBadges,
  onSlideChange,
  autoScroll = true,
  autoScrollInterval = 5000,
  onSlidePress,
}: CarouselHeaderProps) {
  const [activeIndex, setActiveIndex] = React.useState(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const scrollPosition = useRef(0);

  useEffect(() => {
    if (!autoScroll) return;

    const interval = setInterval(() => {
      const nextIndex = (activeIndex + 1) % slides.length;
      scrollToIndex(nextIndex);
    }, autoScrollInterval);

    return () => clearInterval(interval);
  }, [activeIndex, slides.length, autoScroll, autoScrollInterval]);

  const scrollToIndex = (index: number) => {
    const offset = index * PAGE_WIDTH;
    scrollViewRef.current?.scrollTo({ x: offset, animated: true });
  };

  const handleScroll = (event: any) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const currentIndex = Math.round(contentOffsetX / PAGE_WIDTH);
    if (currentIndex !== activeIndex) {
      setActiveIndex(currentIndex);
      onSlideChange?.(currentIndex);
    }
  };

  return (
    <View style={styles.carouselContainer}>
      {/* Header Info */}
      <View style={styles.headerTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>{userGreeting || 'Welcome Back!'}</Text>
          <Text style={styles.memberName}>{memberName || 'Member'}</Text>
          {trainerName && <Text style={styles.trainerInfo}>Trainer: {trainerName}</Text>}
        </View>
        {rightBadges ? <View style={styles.rightBadgesWrap}>{rightBadges}</View> : null}
      </View>

      {/* Carousel */}
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        scrollEventThrottle={16}
        onScroll={handleScroll}
        showsHorizontalScrollIndicator={false}
        style={styles.carouselScroll}
        contentContainerStyle={styles.carouselContent}
      >
        {slides.map((slide) => (
          <View key={slide.id} style={styles.slidePage}>
            <CarouselSlide slide={slide} onPress={onSlidePress} />
          </View>
        ))}
      </ScrollView>

      {/* Pagination Dots */}
      <View style={styles.dotsContainer}>
        {slides.map((_, index) => (
          <TouchableOpacity
            key={`dot-${index}`}
            style={[
              styles.dot,
              {
                backgroundColor: index === activeIndex ? AppColors.primary : '#ddd',
                width: index === activeIndex ? 28 : 8,
              },
            ]}
            onPress={() => scrollToIndex(index)}
          />
        ))}
      </View>
    </View>
  );
}

const PAGE_WIDTH = SCREEN_WIDTH;
const SLIDE_WIDTH = SCREEN_WIDTH - 32;

function CarouselSlide({ slide, onPress }: { slide: CarouselSlide; onPress?: (slide: CarouselSlide) => void }) {
  const hasImage = Boolean(slide.image);

  return (
    <TouchableOpacity
      activeOpacity={onPress ? 0.9 : 1}
      onPress={() => onPress?.(slide)}
      style={[
        styles.slide,
        {
          backgroundColor: slide.bgColor,
        },
      ]}
    >
      {hasImage ? (
        <ImageBackground source={slide.image} style={styles.slideImageBg} imageStyle={styles.slideImageBgStyle} resizeMode="cover">
          <View style={styles.imageOverlay} >
            <View style={[styles.iconWrapper, styles.iconWrapperOnImage]}>
              <MaterialCommunityIcons name={slide.icon as any} size={24} color="#ffffff" />
            </View>

            <Text style={[styles.slideTitle, styles.slideTitleOnImage]}>{slide.title}</Text>
            <Text style={[styles.slideSubtitle, styles.slideSubtitleOnImage]}>{slide.subtitle}</Text>
          </View>
        </ImageBackground>
      ) : (
        <View style={styles.slideContent}>
          <View style={styles.iconWrapper}>
            <MaterialCommunityIcons name={slide.icon as any} size={48} color={slide.iconColor} />
          </View>

          <Text style={[styles.slideTitle, { color: slide.textColor }]}>{slide.title}</Text>
          <Text style={[styles.slideSubtitle, { color: slide.textColor }]}>
            {slide.subtitle}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  carouselContainer: {
    paddingTop: 28,
    paddingHorizontal: 16,
    backgroundColor: '#f8f9fa',
    marginBottom: 12,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  greeting: {
    fontSize: 13,
    color: '#999999',
    fontWeight: '500',
    marginBottom: 4,
  },
  memberName: {
    fontSize: 20,
    fontWeight: '900',
    color: '#1f2b33',
    marginBottom: 4,
  },
  trainerInfo: {
    fontSize: 12,
    color: AppColors.primaryDark,
    fontWeight: '600',
  },
  rightBadgesWrap: {
    marginLeft: 12,
    marginTop: 6,
    marginRight: 4,
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
  },
  carouselScroll: {
    marginHorizontal: -16,
    marginBottom: 12,
  },
  carouselContent: {
    paddingHorizontal: 0,
  },
  slidePage: {
    width: PAGE_WIDTH,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  slide: {
    width: SLIDE_WIDTH,
    borderRadius: 18,
    padding: 0,
    marginRight: 0,
    justifyContent: 'center',
    alignItems: 'center',
    height: 128,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 3,
  },
  slideContent: {
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  slideImageBg: {
    width: '100%',
    height: '100%',
    justifyContent: 'flex-end',
  },
  slideImageBgStyle: {
    borderRadius: 18,
  },
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.36)',
  },
  iconWrapper: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconWrapperOnImage: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(15, 23, 42, 0.36)',
    marginBottom: 8,
  },
  slideTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  slideTitleOnImage: {
    color: '#ffffff',
    textAlign: 'left',
    marginBottom: 2,
    fontSize: 15,
  },
  slideSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    opacity: 0.8,
  },
  slideSubtitleOnImage: {
    color: '#e2e8f0',
    textAlign: 'left',
    opacity: 1,
    fontSize: 12,
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 12,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
});
