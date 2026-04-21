import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { getAuthState } from '@/lib/auth-state';
import { tutorialApi, TutorialCategory, TutorialVideo } from '@/lib/tutorial-api';
import { PageHeader, SectionHeader, SurfaceCard } from '@/components/ui/trainer-dashboard';
import { AppColors } from '@/constants/theme';

export default function AdminTutorialsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [savingCategory, setSavingCategory] = useState(false);
  const [savingVideo, setSavingVideo] = useState(false);
  const [categories, setCategories] = useState<TutorialCategory[]>([]);
  const [videos, setVideos] = useState<TutorialVideo[]>([]);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingVideoId, setEditingVideoId] = useState<string | null>(null);
  const [selectedVideoCategoryFilter, setSelectedVideoCategoryFilter] = useState<string>('all');

  const [categoryName, setCategoryName] = useState('');
  const [categoryDescription, setCategoryDescription] = useState('');
  const [videoTitle, setVideoTitle] = useState('');
  const [videoDescription, setVideoDescription] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');

  const resetCategoryForm = () => {
    setEditingCategoryId(null);
    setCategoryName('');
    setCategoryDescription('');
  };

  const resetVideoForm = () => {
    setEditingVideoId(null);
    setVideoTitle('');
    setVideoDescription('');
    setYoutubeUrl('');
  };

  const loadTutorials = useCallback(async () => {
    try {
      setLoading(true);
      const authState = getAuthState();
      if (!authState?.token) {
        setCategories([]);
        setVideos([]);
        return;
      }

      const [categoryRes, videoRes] = await Promise.all([
        tutorialApi.listCategories(authState.token),
        tutorialApi.listVideos(authState.token, selectedVideoCategoryFilter === 'all' ? undefined : selectedVideoCategoryFilter),
      ]);

      setCategories(categoryRes.categories || []);
      setVideos(videoRes.videos || []);

      if (!selectedCategoryId && categoryRes.categories?.length) {
        setSelectedCategoryId(categoryRes.categories[0].id);
      }
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to load tutorials');
    } finally {
      setLoading(false);
    }
  }, [selectedVideoCategoryFilter, selectedCategoryId]);

  useEffect(() => {
    loadTutorials();
  }, [loadTutorials]);

  const createCategory = async () => {
    try {
      const authState = getAuthState();
      if (!authState?.token) return;

      if (!categoryName.trim()) {
        Alert.alert('Validation', 'Category name is required.');
        return;
      }

      setSavingCategory(true);
      const payload = {
        name: categoryName.trim(),
        description: categoryDescription.trim(),
      };

      if (editingCategoryId) {
        await tutorialApi.updateCategory(editingCategoryId, payload, authState.token);
      } else {
        await tutorialApi.createCategory(payload, authState.token);
      }

      resetCategoryForm();
      await loadTutorials();
      Alert.alert('Success', editingCategoryId ? 'Tutorial category updated.' : 'Tutorial category created.');
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to save category');
    } finally {
      setSavingCategory(false);
    }
  };

  const createVideo = async () => {
    try {
      const authState = getAuthState();
      if (!authState?.token) return;

      if (!videoTitle.trim() || !youtubeUrl.trim() || !selectedCategoryId) {
        Alert.alert('Validation', 'Video title, category and YouTube URL are required.');
        return;
      }

      setSavingVideo(true);
      const payload = {
        title: videoTitle.trim(),
        description: videoDescription.trim(),
        categoryId: selectedCategoryId,
        youtubeUrl: youtubeUrl.trim(),
      };

      if (editingVideoId) {
        await tutorialApi.updateVideo(editingVideoId, payload, authState.token);
      } else {
        await tutorialApi.createVideo(payload, authState.token);
      }

      resetVideoForm();
      await loadTutorials();
      Alert.alert('Success', editingVideoId ? 'Tutorial video updated.' : 'Tutorial video created.');
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to save video');
    } finally {
      setSavingVideo(false);
    }
  };

  const editCategory = (item: TutorialCategory) => {
    setEditingCategoryId(item.id);
    setCategoryName(item.name);
    setCategoryDescription(item.description || '');
  };

  const editVideo = (item: TutorialVideo) => {
    setEditingVideoId(item.id);
    setVideoTitle(item.title);
    setVideoDescription(item.description || '');
    setYoutubeUrl(item.youtubeUrl);
    setSelectedCategoryId(item.categoryId || selectedCategoryId);
  };

  const deleteCategory = async (categoryId: string) => {
    try {
      const authState = getAuthState();
      if (!authState?.token) return;

      await tutorialApi.deleteCategory(categoryId, authState.token);
      if (editingCategoryId === categoryId) {
        resetCategoryForm();
      }
      await loadTutorials();
      Alert.alert('Success', 'Tutorial category deleted.');
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to delete category');
    }
  };

  const deleteVideo = async (videoId: string) => {
    try {
      const authState = getAuthState();
      if (!authState?.token) return;

      await tutorialApi.deleteVideo(videoId, authState.token);
      if (editingVideoId === videoId) {
        resetVideoForm();
      }
      await loadTutorials();
      Alert.alert('Success', 'Tutorial video deleted.');
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to delete video');
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <PageHeader title="Tutorial Management" onBack={() => router.back()} />
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={AppColors.primary} />
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentWrap}>
      <PageHeader title="Tutorial Management" subtitle="Create categories and videos" onBack={() => router.back()} />

      <View style={styles.innerWrap}>
        <SectionHeader title={editingCategoryId ? 'Edit Category' : 'Create Category'} />
        <SurfaceCard>
          <TextInput
            value={categoryName}
            onChangeText={setCategoryName}
            placeholder="Category name"
            style={styles.input}
            placeholderTextColor="#9ca3af"
          />
          <TextInput
            value={categoryDescription}
            onChangeText={setCategoryDescription}
            placeholder="Description"
            style={[styles.input, styles.multiInput]}
            multiline
            placeholderTextColor="#9ca3af"
          />
          <TouchableOpacity style={styles.button} onPress={createCategory} disabled={savingCategory}>
            <Text style={styles.buttonText}>{savingCategory ? 'SAVING...' : editingCategoryId ? 'UPDATE CATEGORY' : 'CREATE CATEGORY'}</Text>
          </TouchableOpacity>
          {editingCategoryId ? (
            <TouchableOpacity style={[styles.button, styles.secondaryButton]} onPress={resetCategoryForm}>
              <Text style={styles.secondaryButtonText}>CANCEL EDIT</Text>
            </TouchableOpacity>
          ) : null}
        </SurfaceCard>

        <SectionHeader title={editingVideoId ? 'Edit Video' : 'Create Video'} />
        <SurfaceCard>
          <TextInput
            value={videoTitle}
            onChangeText={setVideoTitle}
            placeholder="Video title"
            style={styles.input}
            placeholderTextColor="#9ca3af"
          />
          <TextInput
            value={youtubeUrl}
            onChangeText={setYoutubeUrl}
            placeholder="YouTube URL"
            style={styles.input}
            placeholderTextColor="#9ca3af"
          />
          <Text style={styles.helperText}>Select category</Text>
          <View style={styles.chipRow}>
            {categories.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[styles.chip, selectedCategoryId === item.id ? styles.chipActive : null]}
                onPress={() => setSelectedCategoryId(item.id)}
              >
                <Text style={[styles.chipText, selectedCategoryId === item.id ? styles.chipTextActive : null]}>{item.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            value={videoDescription}
            onChangeText={setVideoDescription}
            placeholder="Description"
            style={[styles.input, styles.multiInput]}
            multiline
            placeholderTextColor="#9ca3af"
          />
          <TouchableOpacity style={styles.button} onPress={createVideo} disabled={savingVideo}>
            <Text style={styles.buttonText}>{savingVideo ? 'SAVING...' : editingVideoId ? 'UPDATE VIDEO' : 'CREATE VIDEO'}</Text>
          </TouchableOpacity>
          {editingVideoId ? (
            <TouchableOpacity style={[styles.button, styles.secondaryButton]} onPress={resetVideoForm}>
              <Text style={styles.secondaryButtonText}>CANCEL EDIT</Text>
            </TouchableOpacity>
          ) : null}
        </SurfaceCard>

        <SectionHeader title={`Categories (${categories.length})`} />
        {categories.map((item) => (
          <SurfaceCard key={item.id}>
            <Text style={styles.itemTitle}>{item.name}</Text>
            {!!item.description && <Text style={styles.itemDesc}>{item.description}</Text>}
            <Text style={styles.itemMeta}>{item.videoCount || 0} videos</Text>
            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.smallButton} onPress={() => editCategory(item)}>
                <Text style={styles.smallButtonText}>EDIT</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.smallButton, styles.deleteButton]} onPress={() => deleteCategory(item.id)}>
                <Text style={styles.smallButtonText}>DELETE</Text>
              </TouchableOpacity>
            </View>
          </SurfaceCard>
        ))}

        <SectionHeader title={`Videos (${videos.length})`} />
        <SurfaceCard>
          <Text style={styles.helperText}>Filter by category</Text>
          <View style={styles.chipRow}>
            <TouchableOpacity
              style={[styles.chip, selectedVideoCategoryFilter === 'all' ? styles.chipActive : null]}
              onPress={() => setSelectedVideoCategoryFilter('all')}
            >
              <Text style={[styles.chipText, selectedVideoCategoryFilter === 'all' ? styles.chipTextActive : null]}>
                All
              </Text>
            </TouchableOpacity>
            {categories.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[styles.chip, selectedVideoCategoryFilter === item.id ? styles.chipActive : null]}
                onPress={() => setSelectedVideoCategoryFilter(item.id)}
              >
                <Text style={[styles.chipText, selectedVideoCategoryFilter === item.id ? styles.chipTextActive : null]}>
                  {item.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </SurfaceCard>
        {videos.map((item) => (
          <SurfaceCard key={item.id}>
            <Text style={styles.itemTitle}>{item.title}</Text>
            {!!item.description && <Text style={styles.itemDesc}>{item.description}</Text>}
            <Text style={styles.itemMeta}>{item.youtubeUrl}</Text>
            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.smallButton} onPress={() => editVideo(item)}>
                <Text style={styles.smallButtonText}>EDIT</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.smallButton, styles.deleteButton]} onPress={() => deleteVideo(item.id)}>
                <Text style={styles.smallButtonText}>DELETE</Text>
              </TouchableOpacity>
            </View>
          </SurfaceCard>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f2f3f5',
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentWrap: {
    paddingBottom: 120,
  },
  innerWrap: {
    paddingHorizontal: 16,
    paddingTop: 14,
    gap: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d7dde3',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#1f2937',
    fontSize: 14,
    backgroundColor: '#ffffff',
    marginBottom: 10,
  },
  multiInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  helperText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 8,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  chip: {
    borderWidth: 1,
    borderColor: '#d7dde3',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#ffffff',
  },
  chipActive: {
    borderColor: AppColors.primary,
    backgroundColor: AppColors.primaryLight,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4b5563',
  },
  chipTextActive: {
    color: AppColors.primaryDark,
  },
  button: {
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: AppColors.primary,
    marginBottom: 8,
  },
  secondaryButton: {
    backgroundColor: '#e8eef7',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  secondaryButtonText: {
    color: '#1f2937',
    fontSize: 13,
    fontWeight: '800',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  smallButton: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: AppColors.primary,
  },
  deleteButton: {
    backgroundColor: '#b91c1c',
  },
  smallButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1f2937',
    marginBottom: 4,
  },
  itemDesc: {
    fontSize: 13,
    color: '#4b5563',
    marginBottom: 4,
  },
  itemMeta: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '700',
  },
});
