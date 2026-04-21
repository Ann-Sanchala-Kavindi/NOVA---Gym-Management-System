import { AppColors } from '@/constants/theme';
import {
  adminApi,
  LeaveRequestItem,
  MemberAssignment,
  Trainer,
  TrainerScheduleItem,
  Equipment,
  Product,
  GymFeedback,
  AdminOrder,
  MembershipUpgradeRequestItem,
} from '@/lib/admin-api';
import { router, useFocusEffect } from 'expo-router';
import { getAuthState, clearAuthState } from '@/lib/auth-state';
import React, { useEffect, useMemo, useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  FlatList,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Modal,
  TextInput,
  BackHandler,
  Image,
  ScrollView,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { TrainerModal } from '@/components/trainer-modal';
import * as ImagePicker from 'expo-image-picker';
import { getImageUrl } from '@/lib/image-utils';

type AdminSection =
  | 'trainers'
  | 'assignments'
  | 'leaveRequests'
  | 'trainerSchedules'
  | 'equipment'
  | 'shop'
  | 'feedback'
  | 'workouts'
  | 'membershipUpgrades'
  | null;

export default function AdminPage() {
  const authState = getAuthState();
  const token = authState.token;
  const user = authState.user;

  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [members, setMembers] = useState<MemberAssignment[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequestItem[]>([]);
  const [trainerSchedules, setTrainerSchedules] = useState<TrainerScheduleItem[]>([]);
  const [assigningMemberId, setAssigningMemberId] = useState<string | null>(null);
  const [updatingLeaveRequestId, setUpdatingLeaveRequestId] = useState<string | null>(null);
  const [memberSearch, setMemberSearch] = useState('');
  const [trainerSearch, setTrainerSearch] = useState('');
  const [assignmentFilter, setAssignmentFilter] = useState<'all' | 'unassigned' | 'assigned'>('all');
  const [assignmentModalVisible, setAssignmentModalVisible] = useState(false);
  const [selectedMember, setSelectedMember] = useState<MemberAssignment | null>(null);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [bulkAssignMode, setBulkAssignMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingTrainer, setEditingTrainer] = useState<Trainer | null>(null);
  const [activeSection, setActiveSection] = useState<AdminSection>(null);
  const [leaveBalanceModalVisible, setLeaveBalanceModalVisible] = useState(false);
  const [selectedTrainerForBalance, setSelectedTrainerForBalance] = useState<Trainer | null>(null);
  const [leaveBalanceInput, setLeaveBalanceInput] = useState('');

  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [equipmentSearch, setEquipmentSearch] = useState('');
  const [equipmentModalVisible, setEquipmentModalVisible] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState<Equipment | null>(null);
  const [equipmentForm, setEquipmentForm] = useState({ name: '', category: 'Other', imageUrl: '', location: '', maintenanceStatus: 'Good', image: null as any, imageUri: '' });
  const pickImage = async () => {
    try {
      // Request permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Camera roll permissions are required to select images.');
        return;
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        setEquipmentForm((prev) => ({
          ...prev,
          image: {
            uri: asset.uri,
            type: 'image/jpeg',
            name: `equipment_${Date.now()}.jpg`,
          },
          imageUri: asset.uri,
        }));
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const [savingEquipment, setSavingEquipment] = useState(false);

  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [productModalVisible, setProductModalVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productForm, setProductForm] = useState({ name: '', description: '', price: '0', stock: '0', imageUrl: '', isActive: true });
  const [savingProduct, setSavingProduct] = useState(false);
  const [updatingProductId, setUpdatingProductId] = useState<string | null>(null);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);

  const [feedbackItems, setFeedbackItems] = useState<GymFeedback[]>([]);
  const [feedbackSummary, setFeedbackSummary] = useState<{ total: number; totals: Record<string, number>; summary: string } | null>(null);
  const [replyModalVisible, setReplyModalVisible] = useState(false);
  const [selectedFeedback, setSelectedFeedback] = useState<GymFeedback | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replyingFeedbackId, setReplyingFeedbackId] = useState<string | null>(null);
  const [deletingFeedbackId, setDeletingFeedbackId] = useState<string | null>(null);

  const [membershipUpgradeRequests, setMembershipUpgradeRequests] = useState<MembershipUpgradeRequestItem[]>([]);
  const [updatingMembershipRequestId, setUpdatingMembershipRequestId] = useState<string | null>(null);

  const [workoutOverview, setWorkoutOverview] = useState<{ monthlySummary: { totalWorkouts: number; totalMinutes: number }; workouts: any[] } | null>(null);

  useFocusEffect(
    React.useCallback(() => {
      const onBackPress = () => {
        if (activeSection !== null) {
          setActiveSection(null);
          return true;
        }
        return false;
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, [activeSection])
  );

  const filteredMembers = useMemo(() => {
    const q = memberSearch.trim().toLowerCase();
    return members.filter((member) => {
      const matchSearch =
        !q ||
        member.name.toLowerCase().includes(q) ||
        member.email.toLowerCase().includes(q) ||
        (member.assignedTrainerName || '').toLowerCase().includes(q);

      const matchFilter =
        assignmentFilter === 'all'
          ? true
          : assignmentFilter === 'unassigned'
            ? !member.assignedTrainerId
            : Boolean(member.assignedTrainerId);

      return matchSearch && matchFilter;
    });
  }, [members, memberSearch, assignmentFilter]);

  const filteredTrainers = useMemo(() => {
    const q = trainerSearch.trim().toLowerCase();
    return trainers.filter(
      (trainer) =>
        !q || trainer.name.toLowerCase().includes(q) || trainer.email.toLowerCase().includes(q)
    );
  }, [trainers, trainerSearch]);

  const feedbackPieData = useMemo(() => {
    const totals = feedbackSummary?.totals || {};
    return [
      { label: 'Positive', value: totals.positive || 0, color: '#22c55e' },
      { label: 'Normal', value: totals.normal || 0, color: '#0ea5e9' },
      { label: 'Negative', value: totals.negative || 0, color: '#ef4444' },
    ];
  }, [feedbackSummary]);

  const filteredEquipment = useMemo(() => {
    const q = equipmentSearch.trim().toLowerCase();
    return equipment.filter((item) => {
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.location.toLowerCase().includes(q)
      );
    });
  }, [equipment, equipmentSearch]);

  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    return products.filter((item) => {
      if (!q) return true;
      return item.name.toLowerCase().includes(q) || item.description.toLowerCase().includes(q);
    });
  }, [products, productSearch]);

  const shopStats = useMemo(() => {
    const activeCount = products.filter((p) => p.isActive).length;
    const lowStock = products.filter((p) => p.stock <= 3).length;
    const totalStock = products.reduce((sum, p) => sum + (p.stock || 0), 0);
    return { activeCount, lowStock, totalStock };
  }, [products]);

  const loadTrainers = async () => {
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const response = await adminApi.listTrainers(token);
      setTrainers(response.trainers || []);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load trainers.';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadMembers = async () => {
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const response = await adminApi.listMembers(token);
      setMembers(response.members || []);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load members.';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadLeaveRequests = async () => {
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const response = await adminApi.listLeaveRequests(token);
      setLeaveRequests(response.leaveRequests || []);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load leave requests.';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadTrainerSchedules = async () => {
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const response = await adminApi.listTrainerSchedules(token);
      setTrainerSchedules(response.trainerSchedules || []);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load trainer schedules.';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadEquipment = async () => {
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      setFailedImages(new Set()); // Clear failed images on reload
      const response = await adminApi.listEquipment(token);
      setEquipment(response.equipment || []);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load equipment.';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadShopData = async () => {
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const [productsResponse, ordersResponse] = await Promise.all([
        adminApi.listProducts(token),
        adminApi.listOrders(token),
      ]);
      setProducts(productsResponse.products || []);
      setOrders(ordersResponse.orders || []);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load shop data.';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadFeedbackData = async () => {
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const response = await adminApi.listFeedback(token);
      setFeedbackItems(response.feedback || []);
      setFeedbackSummary(response.summary || null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load feedback.';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadMembershipUpgradeRequests = async () => {
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const response = await adminApi.listMembershipUpgradeRequests(token);
      setMembershipUpgradeRequests(response.requests || []);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load membership upgrade requests.';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const FeedbackPieChart = ({ data }: { data: Array<{ label: string; value: number; color: string }> }) => {
    const total = data.reduce((sum, item) => sum + item.value, 0);
    const radius = 48;
    const cx = 60;
    const cy = 60;

    if (!total) {
      return (
        <View style={styles.feedbackPiePlaceholder}>
          <Text style={styles.feedbackPiePlaceholderText}>No data</Text>
        </View>
      );
    }

    let startAngle = -Math.PI / 2;

    return (
      <Svg width={120} height={120} viewBox="0 0 120 120">
        {data.map((slice, idx) => {
          if (!slice.value) return null;
          const angle = (slice.value / total) * Math.PI * 2;
          const endAngle = startAngle + angle;
          const largeArc = angle > Math.PI ? 1 : 0;
          const x1 = cx + radius * Math.cos(startAngle);
          const y1 = cy + radius * Math.sin(startAngle);
          const x2 = cx + radius * Math.cos(endAngle);
          const y2 = cy + radius * Math.sin(endAngle);
          const d = `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;
          startAngle = endAngle;
          return <Path key={`${slice.label}-${idx}`} d={d} fill={slice.color} stroke="white" strokeWidth={1} />;
        })}
      </Svg>
    );
  };

  const performDeleteFeedback = async (feedbackId: string) => {
    if (!token) return;
    setDeletingFeedbackId(feedbackId);
    try {
      const response = await adminApi.deleteFeedback(feedbackId, token);
      setFeedbackItems(response.feedback || []);
      setFeedbackSummary(response.summary || null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete feedback.';
      Alert.alert('Error', message);
    } finally {
      setDeletingFeedbackId(null);
    }
  };

  const confirmDeleteFeedback = (feedbackId: string) => {
    Alert.alert('Delete feedback?', 'This will permanently remove the feedback and any replies.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => performDeleteFeedback(feedbackId) },
    ]);
  };

  const loadWorkoutOverview = async () => {
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const response = await adminApi.getWorkoutOverview(token);
      setWorkoutOverview({
        monthlySummary: response.monthlySummary,
        workouts: response.workouts || [],
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load workout overview.';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadTrainers();
  }, [token]);

  const handleRefresh = () => {
    setRefreshing(true);
    if (activeSection === 'assignments') {
      loadMembers();
      return;
    }
    if (activeSection === 'leaveRequests') {
      loadLeaveRequests();
      return;
    }
    if (activeSection === 'trainerSchedules') {
      loadTrainerSchedules();
      return;
    }
    if (activeSection === 'equipment') {
      loadEquipment();
      return;
    }
    if (activeSection === 'shop') {
      loadShopData();
      return;
    }
    if (activeSection === 'feedback') {
      loadFeedbackData();
      return;
    }
    if (activeSection === 'workouts') {
      loadWorkoutOverview();
      return;
    }
    if (activeSection === 'membershipUpgrades') {
      loadMembershipUpgradeRequests();
      return;
    }
    loadTrainers();
  };

  const handleLeaveDecision = async (
    leaveRequestId: string,
    status: 'approved' | 'rejected'
  ) => {
    if (!token) return;
    setUpdatingLeaveRequestId(leaveRequestId);

    try {
      const response = await adminApi.updateLeaveRequestStatus(leaveRequestId, status, token);
      const updated = response.leaveRequest;
      if (!updated) return;

      setLeaveRequests((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      Alert.alert('Success', `Leave request ${status}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update leave request.';
      Alert.alert('Error', message);
    } finally {
      setUpdatingLeaveRequestId(null);
    }
  };

  const handleAssignTrainer = async (member: MemberAssignment, trainer: Trainer | null) => {
    if (!token) return;
    setAssigningMemberId(member.id);

    try {
      const response = await adminApi.assignMemberToTrainer(member.id, trainer?.id || null, token);
      const updatedMember = response.member;
      if (!updatedMember) return;

      setMembers((prev) =>
        prev.map((m) => (m.id === updatedMember.id ? updatedMember : m))
      );
      setSelectedMember(updatedMember);

      Alert.alert(
        'Success',
        trainer ? `${member.name} assigned to ${trainer.name}.` : `${member.name} unassigned from trainer.`
      );
      closeAssignmentPicker();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to assign trainer.';
      Alert.alert('Error', message);
    } finally {
      setAssigningMemberId(null);
    }
  };

  const handleBulkAssignTrainer = async (trainer: Trainer | null) => {
    if (!token || selectedMemberIds.length === 0) return;
    setAssigningMemberId('bulk');

    try {
      const response = await adminApi.bulkAssignMembersToTrainer(selectedMemberIds, trainer?.id || null, token);
      const assignedTrainerId = trainer ? trainer.id : null;
      const assignedTrainerName = trainer ? trainer.name : null;

      setMembers((prev) =>
        prev.map((member) =>
          selectedMemberIds.includes(member.id)
            ? { ...member, assignedTrainerId, assignedTrainerName }
            : member
        )
      );

      Alert.alert('Success', response.message || 'Bulk assignment updated successfully.');
      setSelectedMemberIds([]);
      closeAssignmentPicker();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to bulk assign members.';
      Alert.alert('Error', message);
    } finally {
      setAssigningMemberId(null);
    }
  };

  const handleToggleMemberType = async (member: MemberAssignment) => {
    if (!token) return;

    const nextType = member.memberType === 'premium' ? 'normal' : 'premium';
    try {
      const response = await adminApi.updateMemberType(member.id, nextType, token);
      const updated = response.member;
      if (!updated) return;

      setMembers((prev) =>
        prev.map((item) =>
          item.id === member.id
            ? {
                ...item,
                memberType: updated.memberType,
                assignedTrainerId: updated.memberType === 'premium' ? item.assignedTrainerId : null,
                assignedTrainerName: updated.memberType === 'premium' ? item.assignedTrainerName : null,
              }
            : item
        )
      );

      Alert.alert('Success', `${member.name} is now ${nextType.toUpperCase()}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update member type.';
      Alert.alert('Error', message);
    }
  };

  const toggleMemberSelection = (memberId: string) => {
    setSelectedMemberIds((prev) =>
      prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId]
    );
  };

  const selectAllFilteredMembers = () => {
    setSelectedMemberIds(filteredMembers.map((member) => member.id));
  };

  const clearSelectedMembers = () => {
    setSelectedMemberIds([]);
  };

  const openBulkAssignmentPicker = () => {
    if (selectedMemberIds.length === 0) return;
    setSelectedMember(null);
    setBulkAssignMode(true);
    setTrainerSearch('');
    setAssignmentModalVisible(true);
  };

  const openAssignmentPicker = (member: MemberAssignment) => {
    setSelectedMember(member);
    setBulkAssignMode(false);
    setTrainerSearch('');
    setAssignmentModalVisible(true);
  };

  const closeAssignmentPicker = () => {
    setAssignmentModalVisible(false);
    setSelectedMember(null);
    setBulkAssignMode(false);
    setTrainerSearch('');
  };

  const handleDeleteTrainer = (trainer: Trainer) => {
    Alert.alert('Delete Trainer', `Are you sure you want to delete ${trainer.name}?`, [
      { text: 'Cancel', onPress: () => {} },
      {
        text: 'Delete',
        onPress: async () => {
          if (!token) return;
          try {
            await adminApi.deleteTrainer(trainer.id, token);
            setTrainers((prev) => prev.filter((t) => t.id !== trainer.id));
            Alert.alert('Success', `${trainer.name} has been deleted.`);
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to delete trainer.';
            Alert.alert('Error', message);
          }
        },
        style: 'destructive',
      },
    ]);
  };

  const handleLogout = () => {
    clearAuthState();
    router.replace('/(auth)/login');
  };

  const openTrainerManagement = () => {
    setActiveSection('trainers');
    setLoading(true);
    loadTrainers();
  };

  const openAssignmentManagement = () => {
    setActiveSection('assignments');
    setLoading(true);
    setMemberSearch('');
    setAssignmentFilter('all');
    setSelectedMemberIds([]);
    Promise.all([loadTrainers(), loadMembers()]);
  };

  const openLeaveRequests = () => {
    setActiveSection('leaveRequests');
    setLoading(true);
    loadLeaveRequests();
  };

  const openTrainerSchedules = () => {
    setActiveSection('trainerSchedules');
    setLoading(true);
    loadTrainerSchedules();
  };

  const openEquipmentManagement = () => {
    setActiveSection('equipment');
    setLoading(true);
    setEquipmentSearch('');
    loadEquipment();
  };

  const openShopManagement = () => {
    setActiveSection('shop');
    setLoading(true);
    setProductSearch('');
    loadShopData();
  };

  const openFeedbackManagement = () => {
    router.push('/(roles)/admin-reviews');
  };

  const openWorkoutManagement = () => {
    setActiveSection('workouts');
    setLoading(true);
    loadWorkoutOverview();
  };

  const openMembershipUpgradeManagement = () => {
    setActiveSection('membershipUpgrades');
    setLoading(true);
    loadMembershipUpgradeRequests();
  };

  const openCreateEquipmentModal = () => {
    setEditingEquipment(null);
    setEquipmentForm({ name: '', category: 'Other', imageUrl: '', location: '', maintenanceStatus: 'Good', image: null, imageUri: '' });
    setEquipmentModalVisible(true);
  };

  const openEditEquipmentModal = (item: Equipment) => {
    setEditingEquipment(item);
    setEquipmentForm({
      name: item.name,
      category: item.category,
      imageUrl: item.imageUrl || '',
      location: item.location || '',
      maintenanceStatus: item.maintenanceStatus,
      image: null,
      imageUri: item.imageUrl || '',
    });
    setEquipmentModalVisible(true);
  };

  const handleSaveEquipment = async () => {
    if (!token) return;
    if (!equipmentForm.name.trim()) {
      Alert.alert('Error', 'Equipment name is required.');
      return;
    }

    setSavingEquipment(true);
    try {
      if (editingEquipment) {
        await adminApi.updateEquipment(
          editingEquipment.id,
          {
            name: equipmentForm.name.trim(),
            category: equipmentForm.category as Equipment['category'],
            imageUrl: equipmentForm.imageUrl.trim(),
            location: equipmentForm.location.trim(),
            maintenanceStatus: equipmentForm.maintenanceStatus as Equipment['maintenanceStatus'],
            image: equipmentForm.image,
          },
          token
        );
      } else {
        await adminApi.createEquipment(
          {
            name: equipmentForm.name.trim(),
            category: equipmentForm.category,
            imageUrl: equipmentForm.imageUrl.trim(),
            location: equipmentForm.location.trim(),
            maintenanceStatus: equipmentForm.maintenanceStatus,
            isAvailable: true,
            image: equipmentForm.image,
          },
          token
        );
      }

      setEquipmentModalVisible(false);
      setEditingEquipment(null);
      setEquipmentForm({ name: '', category: 'Other', imageUrl: '', location: '', maintenanceStatus: 'Good', image: null, imageUri: '' });
      loadEquipment();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save equipment.';
      Alert.alert('Error', message);
    } finally {
      setSavingEquipment(false);
    }
  };

  const handleDeleteEquipment = (item: Equipment) => {
    if (!token) return;
    Alert.alert('Delete Equipment', `Delete ${item.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await adminApi.deleteEquipment(item.id, token);
            setEquipment((prev) => prev.filter((e) => e.id !== item.id));
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to delete equipment.';
            Alert.alert('Error', message);
          }
        },
      },
    ]);
  };

  const openCreateProductModal = () => {
    setEditingProduct(null);
    setProductForm({ name: '', description: '', price: '0', stock: '0', imageUrl: '', isActive: true });
    setProductModalVisible(true);
  };

  const openEditProductModal = (product: Product) => {
    setEditingProduct(product);
    setProductForm({
      name: product.name,
      description: product.description || '',
      price: String(product.price || 0),
      stock: String(product.stock || 0),
      imageUrl: product.imageUrl || '',
      isActive: product.isActive,
    });
    setProductModalVisible(true);
  };

  const handleSaveProduct = async () => {
    if (!token) return;
    if (!productForm.name.trim()) {
      Alert.alert('Error', 'Product name is required.');
      return;
    }

    setSavingProduct(true);
    try {
      const payload = {
        name: productForm.name.trim(),
        description: productForm.description.trim(),
        price: Number(productForm.price) || 0,
        stock: Number(productForm.stock) || 0,
        imageUrl: productForm.imageUrl.trim(),
        isActive: productForm.isActive,
      };

      if (editingProduct) {
        await adminApi.updateProduct(editingProduct._id, payload, token);
      } else {
        await adminApi.createProduct(payload, token);
      }

      setProductModalVisible(false);
      setEditingProduct(null);
      setProductForm({ name: '', description: '', price: '0', stock: '0', imageUrl: '', isActive: true });
      loadShopData();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save product.';
      Alert.alert('Error', message);
    } finally {
      setSavingProduct(false);
    }
  };

  const handleDeleteProduct = (product: Product) => {
    if (!token) return;
    Alert.alert('Delete Product', `Delete ${product.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await adminApi.deleteProduct(product._id, token);
            setProducts((prev) => prev.filter((p) => p._id !== product._id));
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to delete product.';
            Alert.alert('Error', message);
          }
        },
      },
    ]);
  };

  const handleToggleProductActive = async (product: Product) => {
    if (!token) return;
    setUpdatingProductId(product._id);
    try {
      const response = await adminApi.updateProduct(product._id, { isActive: !product.isActive }, token);
      setProducts((prev) => prev.map((p) => (p._id === product._id ? response.product : p)));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update product visibility.';
      Alert.alert('Error', message);
    } finally {
      setUpdatingProductId(null);
    }
  };

  const handleUpdateOrderStatus = async (orderId: string, status: AdminOrder['status']) => {
    if (!token) return;
    setUpdatingOrderId(orderId);
    try {
      const response = await adminApi.updateOrderStatus(orderId, status, token);
      setOrders((prev) => prev.map((item) => (item._id === orderId ? response.order : item)));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update order status.';
      Alert.alert('Error', message);
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const openReplyModal = (item: GymFeedback) => {
    setSelectedFeedback(item);
    setReplyText(item.adminReply || '');
    setReplyModalVisible(true);
  };

  const handleReplyFeedback = async () => {
    if (!token || !selectedFeedback) return;
    if (!replyText.trim()) {
      Alert.alert('Error', 'Reply cannot be empty.');
      return;
    }

    setReplyingFeedbackId(selectedFeedback._id);
    try {
      const response = await adminApi.replyFeedback(selectedFeedback._id, replyText.trim(), token);
      setFeedbackItems((prev) => prev.map((item) => (item._id === response.feedback._id ? response.feedback : item)));
      setReplyModalVisible(false);
      setSelectedFeedback(null);
      setReplyText('');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to reply feedback.';
      Alert.alert('Error', message);
    } finally {
      setReplyingFeedbackId(null);
    }
  };

  const openLeaveBalanceModal = (trainer: Trainer) => {
    setSelectedTrainerForBalance(trainer);
    setLeaveBalanceInput('0');
    setLeaveBalanceModalVisible(true);
  };

  const handleSetLeaveBalance = async () => {
    if (!selectedTrainerForBalance || !token) return;

    const balance = parseInt(leaveBalanceInput, 10);
    if (Number.isNaN(balance) || balance < 0) {
      Alert.alert('Error', 'Please enter a valid number');
      return;
    }

    try {
      await adminApi.setTrainerLeaveBalance(selectedTrainerForBalance.id, balance, token);
      Alert.alert('Success', `Leave balance for ${selectedTrainerForBalance.name} set to ${balance} days`);
      setLeaveBalanceModalVisible(false);
      setSelectedTrainerForBalance(null);
      setLeaveBalanceInput('');
      loadTrainers();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to set leave balance.';
      Alert.alert('Error', message);
    }
  };

  const openCreateTrainer = () => {
    setEditingTrainer(null);
    setModalMode('create');
    setModalVisible(true);
  };

  const openEditTrainer = (trainer: Trainer) => {
    setEditingTrainer(trainer);
    setModalMode('edit');
    setModalVisible(true);
  };

  const renderTrainerCard = ({ item }: { item: Trainer }) => (
    <View style={styles.trainerCard}>
      <View style={styles.cardHeader}>
        <View style={styles.cardInfo}>
          <Text style={styles.trainerName}>{item.name}</Text>
          <Text style={styles.trainerEmail}>{item.email}</Text>
        </View>
        <View style={styles.cardActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => openLeaveBalanceModal(item)}
            title="Set Leave Balance"
          >
            <MaterialCommunityIcons name="calendar-clock" size={20} color={AppColors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => openEditTrainer(item)}
          >
            <MaterialCommunityIcons name="pencil-outline" size={20} color={AppColors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleDeleteTrainer(item)}
          >
            <MaterialCommunityIcons name="trash-can-outline" size={20} color={AppColors.error} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.cardDetails}>
        {item.specialization ? (
          <View style={styles.detailRow}>
            <MaterialCommunityIcons name="briefcase" size={16} color={AppColors.textSecondary} />
            <Text style={styles.detailText}>{item.specialization}</Text>
          </View>
        ) : null}

        {item.experienceLevel ? (
          <View style={styles.detailRow}>
            <MaterialCommunityIcons name="star" size={16} color={AppColors.textSecondary} />
            <Text style={styles.detailText}>{item.experienceLevel}</Text>
          </View>
        ) : null}

        {item.hourlyRate !== null ? (
          <View style={styles.detailRow}>
            <MaterialCommunityIcons name="currency-usd" size={16} color={AppColors.textSecondary} />
            <Text style={styles.detailText}>${item.hourlyRate}/hour</Text>
          </View>
        ) : null}

        {item.bio ? (
          <View style={styles.bioRow}>
            <Text style={styles.detailText} numberOfLines={2}>
              {item.bio}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );

  const renderMemberCard = ({ item }: { item: MemberAssignment }) => {
    const isAssigning = assigningMemberId === item.id || assigningMemberId === 'bulk';
    const canAssignTrainer = (item.memberType || 'normal') === 'premium';

    return (
      <View style={styles.memberCard}>
        <View style={styles.cardHeader}>
          <View style={styles.cardInfo}>
            <Text style={styles.trainerName}>{item.name || 'Member'}</Text>
            <Text style={styles.trainerEmail}>{item.email}</Text>
          </View>
        </View>

        <View style={styles.assignmentPillsRow}>
          <View style={[styles.assignmentSummary, styles.assignmentSummaryCompact]}>
            <Text style={styles.assignmentSummaryLabel}>Member Type</Text>
            <Text style={styles.assignmentSummaryValue}>{(item.memberType || 'normal').toUpperCase()}</Text>
          </View>
          <View style={[styles.assignmentSummary, styles.assignmentSummaryCompact]}>
            <Text style={styles.assignmentSummaryLabel}>Assigned Trainer</Text>
            <Text style={styles.assignmentSummaryValue}>{item.assignedTrainerName || 'Unassigned'}</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.assignButton}
          onPress={() => openAssignmentPicker(item)}
          disabled={isAssigning || !canAssignTrainer}
        >
          <Text style={styles.assignButtonText}>
            {!canAssignTrainer
              ? 'Upgrade to Premium to Assign Trainer'
              : item.assignedTrainerId
                ? 'Change Assignment'
                : 'Assign Trainer'}
          </Text>
          <MaterialCommunityIcons name="chevron-right" size={18} color={AppColors.primaryDark} />
        </TouchableOpacity>

        {isAssigning ? (
          <View style={styles.assigningRow}>
            <ActivityIndicator size="small" color={AppColors.primary} />
            <Text style={styles.assigningText}>Saving assignment...</Text>
          </View>
        ) : null}
      </View>
    );
  };

  const renderLeaveRequestCard = ({ item }: { item: LeaveRequestItem }) => {
    const isPending = item.status === 'pending';
    const isUpdating = updatingLeaveRequestId === item.id;

    return (
      <View style={styles.memberCard}>
        <View style={styles.cardHeader}>
          <View style={styles.cardInfo}>
            <Text style={styles.trainerName}>{item.trainerName || 'Trainer'}</Text>
            <Text style={styles.trainerEmail}>{item.trainerEmail}</Text>
          </View>
          <View
            style={[
              styles.statusBadge,
              item.status === 'approved'
                ? styles.statusBadgeApproved
                : item.status === 'rejected'
                  ? styles.statusBadgeRejected
                  : styles.statusBadgePending,
            ]}
          >
            <Text style={styles.statusBadgeText}>{item.status.toUpperCase()}</Text>
          </View>
        </View>

        <View style={styles.cardDetails}>
          <View style={styles.detailRow}>
            <Text style={styles.detailText}>Type: {item.type}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailText}>
              Duration: {new Date(item.startDate).toLocaleDateString()} - {new Date(item.endDate).toLocaleDateString()}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailText}>Reason: {item.reason || 'N/A'}</Text>
          </View>
        </View>

        {isPending ? (
          <View style={styles.leaveActionsWrap}>
            <TouchableOpacity
              style={[styles.leaveDecisionButton, styles.approveButton]}
              onPress={() => handleLeaveDecision(item.id, 'approved')}
              disabled={isUpdating}
            >
              <Text style={styles.leaveDecisionText}>Approve</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.leaveDecisionButton, styles.rejectButton]}
              onPress={() => handleLeaveDecision(item.id, 'rejected')}
              disabled={isUpdating}
            >
              <Text style={styles.leaveDecisionText}>Reject</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {isUpdating ? (
          <View style={styles.assigningRow}>
            <ActivityIndicator size="small" color={AppColors.primary} />
            <Text style={styles.assigningText}>Updating request...</Text>
          </View>
        ) : null}
      </View>
    );
  };

  const emptyState = (
    <View style={styles.emptyState}>
      <MaterialCommunityIcons name="account-group" size={48} color={AppColors.textMuted} />
      <Text style={styles.emptyStateTitle}>No Trainers Yet</Text>
      <Text style={styles.emptyStateSubtitle}>Create your first trainer to get started</Text>
    </View>
  );

  const renderMembershipUpgradeRequestCard = (item: MembershipUpgradeRequestItem) => {
    const isPending = item.status === 'pending';
    const isUpdating = updatingMembershipRequestId === item.id;

    const statusLabel = item.status.toUpperCase();
    const statusColor =
      item.status === 'approved'
        ? '#16a34a'
        : item.status === 'rejected'
          ? '#dc2626'
          : '#f59e0b';

    return (
      <View key={item.id} style={styles.membershipCard}>
        <View style={styles.membershipHeaderRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.membershipMemberName}>{item.memberName || 'Member'}</Text>
            <Text style={styles.membershipMemberEmail}>{item.memberEmail}</Text>
          </View>
          <View style={[styles.membershipStatusPill, { backgroundColor: `${statusColor}15`, borderColor: statusColor }]}
          >
            <Text style={[styles.membershipStatusText, { color: statusColor }]}>{statusLabel}</Text>
          </View>
        </View>

        <View style={styles.membershipMetaRow}>
          <Text style={styles.membershipMetaText}>Current: {item.currentMemberType.toUpperCase()}</Text>
          <Text style={styles.membershipMetaText}>
            Requested: {new Date(item.createdAt).toLocaleDateString()}
          </Text>
        </View>

        {item.reason ? (
          <Text style={styles.membershipReasonText}>Reason: {item.reason}</Text>
        ) : null}

        {item.decisionNote ? (
          <Text style={styles.membershipDecisionText}>Decision note: {item.decisionNote}</Text>
        ) : null}

        {isPending ? (
          <View style={styles.membershipActionsRow}>
            <TouchableOpacity
              style={[styles.membershipActionButton, styles.membershipRejectButton]}
              disabled={isUpdating}
              onPress={async () => {
                if (!token) return;
                setUpdatingMembershipRequestId(item.id);
                try {
                  const response = await adminApi.updateMembershipUpgradeRequestStatus(
                    item.id,
                    'rejected',
                    token
                  );
                  const updated = response.request;
                  setMembershipUpgradeRequests((prev) =>
                    prev.map((req) => (req.id === updated.id ? updated : req))
                  );
                  Alert.alert('Updated', 'Premium request rejected.');
                } catch (error) {
                  const message =
                    error instanceof Error ? error.message : 'Failed to update request.';
                  Alert.alert('Error', message);
                } finally {
                  setUpdatingMembershipRequestId(null);
                }
              }}
            >
              <Text style={styles.membershipRejectText}>Reject</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.membershipActionButton, styles.membershipApproveButton]}
              disabled={isUpdating}
              onPress={async () => {
                if (!token) return;
                setUpdatingMembershipRequestId(item.id);
                try {
                  const response = await adminApi.updateMembershipUpgradeRequestStatus(
                    item.id,
                    'approved',
                    token
                  );
                  const updated = response.request;
                  setMembershipUpgradeRequests((prev) =>
                    prev.map((req) => (req.id === updated.id ? updated : req))
                  );
                  Alert.alert('Updated', 'Member upgraded to PREMIUM.');
                } catch (error) {
                  const message =
                    error instanceof Error ? error.message : 'Failed to update request.';
                  Alert.alert('Error', message);
                } finally {
                  setUpdatingMembershipRequestId(null);
                }
              }}
            >
              <Text style={styles.membershipApproveText}>Approve</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {isUpdating ? (
          <View style={styles.membershipUpdatingRow}>
            <ActivityIndicator size="small" color={AppColors.primary} />
            <Text style={styles.membershipUpdatingText}>Updating request…</Text>
          </View>
        ) : null}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={AppColors.primary} />
      </View>
    );
  }

  return (
    <>
      <View style={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Admin Dashboard</Text>
            <Text style={styles.subtitle}>{user?.email}</Text>
          </View>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <MaterialCommunityIcons name="logout" size={20} color={AppColors.primary} />
          </TouchableOpacity>
        </View>

        {activeSection === null ? (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.managementWrap}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.managementTitle}>Management</Text>

            <TouchableOpacity style={styles.managementCard} onPress={openTrainerManagement}>
              <View style={styles.managementIconWrap}>
                <MaterialCommunityIcons name="account-tie" size={22} color={AppColors.primary} />
              </View>
              <View style={styles.managementTextWrap}>
                <Text style={styles.managementCardTitle}>Manage Trainers</Text>
                <Text style={styles.managementCardSubtitle}>Create, view, edit and delete trainers</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={22} color={AppColors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.managementCard} onPress={openAssignmentManagement}>
              <View style={styles.managementIconWrap}>
                <MaterialCommunityIcons name="account-switch" size={22} color={AppColors.primary} />
              </View>
              <View style={styles.managementTextWrap}>
                <Text style={styles.managementCardTitle}>Manage Members</Text>
                <Text style={styles.managementCardSubtitle}>Search members and assign them to trainers</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={22} color={AppColors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.managementCard} onPress={openLeaveRequests}>
              <View style={styles.managementIconWrap}>
                <MaterialCommunityIcons name="calendar-check" size={22} color={AppColors.primary} />
              </View>
              <View style={styles.managementTextWrap}>
                <Text style={styles.managementCardTitle}>Leave Requests</Text>
                <Text style={styles.managementCardSubtitle}>Approve or reject trainer leave requests</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={22} color={AppColors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.managementCard} onPress={openMembershipUpgradeManagement}>
              <View style={styles.managementIconWrap}>
                <MaterialCommunityIcons name="star-circle" size={22} color={AppColors.primary} />
              </View>
              <View style={styles.managementTextWrap}>
                <Text style={styles.managementCardTitle}>Premium Requests</Text>
                <Text style={styles.managementCardSubtitle}>Approve or reject member premium upgrades</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={22} color={AppColors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.managementCard} onPress={openTrainerSchedules}>
              <View style={styles.managementIconWrap}>
                <MaterialCommunityIcons name="calendar-clock" size={22} color={AppColors.primary} />
              </View>
              <View style={styles.managementTextWrap}>
                <Text style={styles.managementCardTitle}>Trainer Schedules</Text>
                <Text style={styles.managementCardSubtitle}>View each trainer availability allocation</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={22} color={AppColors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.managementCard} onPress={openEquipmentManagement}>
              <View style={styles.managementIconWrap}>
                <MaterialCommunityIcons name="dumbbell" size={22} color={AppColors.primary} />
              </View>
              <View style={styles.managementTextWrap}>
                <Text style={styles.managementCardTitle}>Equipment</Text>
                <Text style={styles.managementCardSubtitle}>Create and maintain workout equipment list</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={22} color={AppColors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.managementCard}
              onPress={() => router.push('/(roles)/admin-tutorials' as any)}
            >
              <View style={styles.managementIconWrap}>
                <MaterialCommunityIcons name="play-circle-outline" size={22} color={AppColors.primary} />
              </View>
              <View style={styles.managementTextWrap}>
                <Text style={styles.managementCardTitle}>Tutorial Management</Text>
                <Text style={styles.managementCardSubtitle}>Manage tutorial categories and YouTube videos</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={22} color={AppColors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.managementCard} onPress={openWorkoutManagement}>
              <View style={styles.managementIconWrap}>
                <MaterialCommunityIcons name="chart-line" size={22} color={AppColors.primary} />
              </View>
              <View style={styles.managementTextWrap}>
                <Text style={styles.managementCardTitle}>Workout Management</Text>
                <Text style={styles.managementCardSubtitle}>Track member workout completion and monthly analytics</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={22} color={AppColors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.managementCard} onPress={openShopManagement}>
              <View style={styles.managementIconWrap}>
                <MaterialCommunityIcons name="storefront-outline" size={22} color={AppColors.primary} />
              </View>
              <View style={styles.managementTextWrap}>
                <Text style={styles.managementCardTitle}>Shop Management</Text>
                <Text style={styles.managementCardSubtitle}>Manage products and monitor member orders</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={22} color={AppColors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.managementCard} onPress={() => router.push('/(roles)/admin-reviews' as any)}>
              <View style={styles.managementIconWrap}>
                <MaterialCommunityIcons name="message-text-outline" size={22} color={AppColors.primary} />
              </View>
              <View style={styles.managementTextWrap}>
                <Text style={styles.managementCardTitle}>Ratings & Reviews</Text>
                <Text style={styles.managementCardSubtitle}>Moderate reviews, reply to members, and manage reported content</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={22} color={AppColors.textMuted} />
            </TouchableOpacity>
          </ScrollView>
        ) : null}

        {activeSection === 'trainers' ? (
          <>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionHeaderLeft}>
                <TouchableOpacity
                  style={styles.backIconButton}
                  onPress={() => setActiveSection(null)}
                >
                  <MaterialCommunityIcons name="arrow-left" size={20} color={AppColors.primaryDark} />
                </TouchableOpacity>
                <Text style={styles.sectionTitle}>
                  {`Manage Trainers (${trainers.length})`}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.createButton}
                onPress={openCreateTrainer}
              >
                <MaterialCommunityIcons name="plus" size={20} color={AppColors.white} />
                <Text style={styles.createButtonText}>Create</Text>
              </TouchableOpacity>
            </View>

            {trainers.length === 0 ? (
              emptyState
            ) : (
              <FlatList
                data={trainers}
                keyExtractor={(item) => item.id}
                renderItem={renderTrainerCard}
                contentContainerStyle={styles.listContainer}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={handleRefresh}
                    colors={[AppColors.primary]}
                  />
                }
              />
            )}
          </>
        ) : null}

        {activeSection === 'assignments' ? (
          <>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionHeaderLeft}>
                <TouchableOpacity
                  style={styles.backIconButton}
                  onPress={() => setActiveSection(null)}
                >
                  <MaterialCommunityIcons name="arrow-left" size={20} color={AppColors.primaryDark} />
                </TouchableOpacity>
                <Text style={styles.sectionTitle}>{`Manage Members (${members.length})`}</Text>
              </View>
            </View>

            <View style={styles.assignmentToolbar}>
              <TextInput
                value={memberSearch}
                onChangeText={setMemberSearch}
                placeholder="Search members, email, or trainer"
                style={styles.assignmentSearchInput}
              />
              <View style={styles.assignmentFilterRow}>
                {([
                  { label: 'All', value: 'all' },
                  { label: 'Unassigned', value: 'unassigned' },
                  { label: 'Assigned', value: 'assigned' },
                ] as const).map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    onPress={() => setAssignmentFilter(option.value)}
                    style={[
                      styles.assignmentFilterChip,
                      assignmentFilter === option.value ? styles.assignmentFilterChipActive : null,
                    ]}
                  >
                    <Text
                      style={[
                        styles.assignmentFilterChipText,
                        assignmentFilter === option.value ? styles.assignmentFilterChipTextActive : null,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.assignmentCountText}>{filteredMembers.length} members</Text>
            </View>

            <FlatList
              data={filteredMembers}
              keyExtractor={(item) => item.id}
              renderItem={renderMemberCard}
              contentContainerStyle={styles.listContainer}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={handleRefresh}
                  colors={[AppColors.primary]}
                />
              }
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <MaterialCommunityIcons name="account-off-outline" size={48} color={AppColors.textMuted} />
                  <Text style={styles.emptyStateTitle}>No Members Found</Text>
                  <Text style={styles.emptyStateSubtitle}>
                    Try changing search/filter or create members first.
                  </Text>
                </View>
              }
            />
          </>
        ) : null}

        {activeSection === 'membershipUpgrades' ? (
          <>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionHeaderLeft}>
                <TouchableOpacity
                  style={styles.backIconButton}
                  onPress={() => setActiveSection(null)}
                >
                  <MaterialCommunityIcons
                    name="arrow-left"
                    size={20}
                    color={AppColors.primaryDark}
                  />
                </TouchableOpacity>
                <Text style={styles.sectionTitle}>{`Premium Requests (${membershipUpgradeRequests.length})`}</Text>
              </View>
            </View>

            {membershipUpgradeRequests.length === 0 ? (
              <View style={styles.emptyState}>
                <MaterialCommunityIcons
                  name="star-circle"
                  size={48}
                  color={AppColors.textMuted}
                />
                <Text style={styles.emptyStateTitle}>No Premium Requests</Text>
                <Text style={styles.emptyStateSubtitle}>
                  When members request premium membership, their requests will appear here.
                </Text>
              </View>
            ) : (
              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={styles.membershipListContainer}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={handleRefresh}
                    colors={[AppColors.primary]}
                  />
                }
              >
                {membershipUpgradeRequests.map(renderMembershipUpgradeRequestCard)}
              </ScrollView>
            )}
          </>
        ) : null}

        {activeSection === 'leaveRequests' ? (
          <>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionHeaderLeft}>
                <TouchableOpacity
                  style={styles.backIconButton}
                  onPress={() => setActiveSection(null)}
                >
                  <MaterialCommunityIcons name="arrow-left" size={20} color={AppColors.primaryDark} />
                </TouchableOpacity>
                <Text style={styles.sectionTitle}>{`Leave Requests (${leaveRequests.length})`}</Text>
              </View>
            </View>

            <FlatList
              data={leaveRequests}
              keyExtractor={(item) => item.id}
              renderItem={renderLeaveRequestCard}
              contentContainerStyle={styles.listContainer}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={handleRefresh}
                  colors={[AppColors.primary]}
                />
              }
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <MaterialCommunityIcons name="calendar-remove" size={48} color={AppColors.textMuted} />
                  <Text style={styles.emptyStateTitle}>No Leave Requests</Text>
                  <Text style={styles.emptyStateSubtitle}>
                    New trainer leave requests will appear here.
                  </Text>
                </View>
              }
            />
          </>
        ) : null}

        {activeSection === 'trainerSchedules' ? (
          <>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionHeaderLeft}>
                <TouchableOpacity
                  style={styles.backIconButton}
                  onPress={() => setActiveSection(null)}
                >
                  <MaterialCommunityIcons name="arrow-left" size={20} color={AppColors.primaryDark} />
                </TouchableOpacity>
                <Text style={styles.sectionTitle}>{`Trainer Schedules (${trainerSchedules.length})`}</Text>
              </View>
            </View>

            <FlatList
              data={trainerSchedules}
              keyExtractor={(item) => item.trainerId}
              contentContainerStyle={styles.listContainer}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={handleRefresh}
                  colors={[AppColors.primary]}
                />
              }
              renderItem={({ item }) => {
                const availableDays = item.days.filter((d) => d.isAvailable);
                return (
                  <View style={styles.scheduleCard}>
                    <View style={styles.scheduleCardHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.trainerName}>{item.trainerName || 'Unnamed Trainer'}</Text>
                        <Text style={styles.trainerEmail}>{item.trainerEmail}</Text>
                      </View>
                      <View style={styles.scheduleBadge}>
                        <Text style={styles.scheduleBadgeText}>{availableDays.length} DAYS</Text>
                      </View>
                    </View>

                    <Text style={styles.scheduleModeText}>
                      {item.sameTimeAllDays ? 'Mode: Same time for all days' : 'Mode: Different time per day'}
                    </Text>

                    {availableDays.length === 0 ? (
                      <Text style={styles.scheduleOffText}>No available days set.</Text>
                    ) : (
                      availableDays.map((day) => (
                        <View key={`${item.trainerId}-${day.day}`} style={styles.scheduleDayRow}>
                          <Text style={styles.scheduleDayLabel}>{day.day}</Text>
                          <Text style={styles.scheduleDayTime}>{day.startTime} - {day.endTime}</Text>
                        </View>
                      ))
                    )}
                  </View>
                );
              }}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <MaterialCommunityIcons name="calendar-clock" size={48} color={AppColors.textMuted} />
                  <Text style={styles.emptyStateTitle}>No Trainer Schedules</Text>
                  <Text style={styles.emptyStateSubtitle}>
                    Trainer schedules will appear after trainers configure their availability.
                  </Text>
                </View>
              }
            />
          </>
        ) : null}

        {activeSection === 'equipment' ? (
          <>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionHeaderLeft}>
                <TouchableOpacity
                  style={styles.backIconButton}
                  onPress={() => setActiveSection(null)}
                >
                  <MaterialCommunityIcons name="arrow-left" size={20} color={AppColors.primaryDark} />
                </TouchableOpacity>
                <Text style={styles.sectionTitle}>{`Equipment (${equipment.length})`}</Text>
              </View>
              <TouchableOpacity style={styles.createButton} onPress={openCreateEquipmentModal}>
                <MaterialCommunityIcons name="plus" size={20} color={AppColors.white} />
                <Text style={styles.createButtonText}>Create</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.assignmentToolbar}>
              <TextInput
                value={equipmentSearch}
                onChangeText={setEquipmentSearch}
                placeholder="Search equipment by name/category/location"
                style={styles.assignmentSearchInput}
              />
              <Text style={styles.assignmentCountText}>{filteredEquipment.length} items</Text>
            </View>

            <FlatList
              data={filteredEquipment}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContainer}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={handleRefresh}
                  colors={[AppColors.primary]}
                />
              }
              renderItem={({ item }) => (
                <View style={styles.memberCard}>
                  {item.imageUrl && !failedImages.has(item.id) ? (
                    <Image
                      source={{ uri: getImageUrl(item.imageUrl) }}
                      style={styles.equipmentCardImage}
                      resizeMode="cover"
                      onError={() => setFailedImages((prev) => new Set(prev).add(item.id))}
                    />
                  ) : item.imageUrl && failedImages.has(item.id) ? (
                    <View style={[styles.equipmentCardImage, styles.imageErrorPlaceholder]}>
                      <MaterialCommunityIcons name="image-broken-variant" size={48} color={AppColors.textMuted} />
                      <Text style={styles.imageErrorText}>Image failed to load</Text>
                      <Text style={styles.imageErrorSubtext}>URL may be invalid</Text>
                    </View>
                  ) : null}
                  <View style={styles.cardHeader}>
                    <View style={styles.cardInfo}>
                      <Text style={styles.trainerName}>{item.name}</Text>
                      <Text style={styles.trainerEmail}>{item.category}</Text>
                    </View>
                    <View style={styles.cardActions}>
                      <TouchableOpacity style={styles.actionButton} onPress={() => openEditEquipmentModal(item)}>
                        <MaterialCommunityIcons name="pencil-outline" size={20} color={AppColors.primary} />
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.actionButton} onPress={() => handleDeleteEquipment(item)}>
                        <MaterialCommunityIcons name="trash-can-outline" size={20} color={AppColors.error} />
                      </TouchableOpacity>
                    </View>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailText}>Location: {item.location || 'N/A'}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailText}>Status: {item.maintenanceStatus}</Text>
                  </View>
                  {item.imageUrl ? (
                    <View style={styles.detailRow}>
                      <Text style={[styles.detailText, { fontSize: 10, color: AppColors.textMuted }]}>
                        Image URL: {item.imageUrl.substring(0, 50)}...
                      </Text>
                    </View>
                  ) : null}
                </View>
              )}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <MaterialCommunityIcons name="dumbbell" size={48} color={AppColors.textMuted} />
                  <Text style={styles.emptyStateTitle}>No Equipment Found</Text>
                  <Text style={styles.emptyStateSubtitle}>Create equipment to enable member workout tracking.</Text>
                </View>
              }
            />
          </>
        ) : null}

        {activeSection === 'workouts' ? (
          <>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionHeaderLeft}>
                <TouchableOpacity style={styles.backIconButton} onPress={() => setActiveSection(null)}>
                  <MaterialCommunityIcons name="arrow-left" size={20} color={AppColors.primaryDark} />
                </TouchableOpacity>
                <Text style={styles.sectionTitle}>Workout Management</Text>
              </View>
            </View>

            <View style={styles.assignmentToolbar}>
              <Text style={styles.assignmentCountText}>
                Monthly: {workoutOverview?.monthlySummary.totalWorkouts || 0} workouts • {workoutOverview?.monthlySummary.totalMinutes || 0} mins
              </Text>
            </View>

            <FlatList
              data={workoutOverview?.workouts || []}
              keyExtractor={(item) => String(item.id)}
              contentContainerStyle={styles.listContainer}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[AppColors.primary]} />}
              renderItem={({ item }) => (
                <View style={styles.memberCard}>
                  <View style={styles.cardHeader}>
                    <View style={styles.cardInfo}>
                      <Text style={styles.trainerName}>{item.memberName || 'Member'}</Text>
                      <Text style={styles.trainerEmail}>{item.memberEmail}</Text>
                    </View>
                    <Text style={styles.assignmentSummaryValue}>{item.durationMinutes} min</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailText}>Equipment: {item.equipmentName} ({item.equipmentCategory})</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailText}>Status: {String(item.status || '').toUpperCase()}</Text>
                  </View>
                </View>
              )}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <MaterialCommunityIcons name="chart-line" size={48} color={AppColors.textMuted} />
                  <Text style={styles.emptyStateTitle}>No Workout Records</Text>
                  <Text style={styles.emptyStateSubtitle}>Member workout completion data will appear here.</Text>
                </View>
              }
            />
          </>
        ) : null}

        {activeSection === 'shop' ? (
          <>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionHeaderLeft}>
                <TouchableOpacity style={styles.backIconButton} onPress={() => setActiveSection(null)}>
                  <MaterialCommunityIcons name="arrow-left" size={20} color={AppColors.primaryDark} />
                </TouchableOpacity>
                <Text style={styles.sectionTitle}>{`Shop Management (${products.length})`}</Text>
              </View>
              <TouchableOpacity style={styles.createButton} onPress={openCreateProductModal}>
                <MaterialCommunityIcons name="plus" size={20} color={AppColors.white} />
                <Text style={styles.createButtonText}>Create</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.assignmentToolbar}>
              <TextInput
                value={productSearch}
                onChangeText={setProductSearch}
                placeholder="Search products"
                style={styles.assignmentSearchInput}
              />
              <Text style={styles.assignmentCountText}>Products: {filteredProducts.length} • Orders: {orders.length}</Text>

              <View style={styles.shopStatsRow}>
                <View style={styles.shopStatCard}>
                  <Text style={styles.shopStatLabel}>Active</Text>
                  <Text style={styles.shopStatValue}>{shopStats.activeCount}</Text>
                </View>
                <View style={styles.shopStatCard}>
                  <Text style={styles.shopStatLabel}>Low stock</Text>
                  <Text style={[styles.shopStatValue, shopStats.lowStock ? styles.shopStatValueWarning : null]}>{shopStats.lowStock}</Text>
                </View>
                <View style={styles.shopStatCard}>
                  <Text style={styles.shopStatLabel}>Total units</Text>
                  <Text style={styles.shopStatValue}>{shopStats.totalStock}</Text>
                </View>
              </View>
            </View>

            <FlatList
              data={filteredProducts}
              numColumns={2}
              columnWrapperStyle={styles.productGridRow}
              keyExtractor={(item) => item._id}
              contentContainerStyle={styles.productGrid}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[AppColors.primary]} />}
              renderItem={({ item }) => (
                <View style={styles.shopProductCard}>
                  <View style={styles.shopProductImageWrap}>
                    {item.imageUrl ? (
                      <Image source={{ uri: getImageUrl(item.imageUrl) }} style={styles.shopProductImage} resizeMode="cover" />
                    ) : (
                      <View style={styles.shopProductPlaceholder}>
                        <MaterialCommunityIcons name="shopping" size={28} color={AppColors.textMuted} />
                      </View>
                    )}
                    <View style={[styles.shopBadge, item.isActive ? styles.shopBadgeActive : styles.shopBadgeInactive]}>
                      <Text style={[styles.shopBadgeText, !item.isActive ? styles.shopBadgeTextMuted : null]}>
                        {item.isActive ? 'ACTIVE' : 'HIDDEN'}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.shopProductName} numberOfLines={2}>{item.name}</Text>
                  <Text style={styles.shopProductDesc} numberOfLines={2}>{item.description || 'No description'}</Text>

                  <View style={styles.shopMetaRow}>
                    <Text style={styles.shopPrice}>${(item.price || 0).toFixed(2)}</Text>
                    <Text style={[styles.shopStock, item.stock <= 3 ? styles.shopLowStock : null]}>Stock: {item.stock}</Text>
                  </View>

                  <View style={styles.shopActionRow}>
                    <TouchableOpacity
                      style={styles.shopActionButton}
                      onPress={() => handleToggleProductActive(item)}
                      disabled={updatingProductId === item._id}
                    >
                      <Text style={styles.shopActionButtonText}>
                        {updatingProductId === item._id ? 'Updating...' : item.isActive ? 'Hide' : 'Show'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.shopActionButton, styles.shopActionButtonSecondary]} onPress={() => openEditProductModal(item)}>
                      <Text style={[styles.shopActionButtonText, styles.shopActionButtonSecondaryText]}>Edit</Text>
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity style={styles.shopDeleteButton} onPress={() => handleDeleteProduct(item)}>
                    <Text style={styles.shopDeleteButtonText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              )}
              ListFooterComponent={
                <View style={styles.shopOrdersBlock}>
                  <Text style={styles.sectionTitle}>Recent Orders</Text>
                  {(orders || []).slice(0, 10).map((order) => (
                    <View key={order._id} style={styles.shopOrderRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.trainerName}>{order.memberId?.name || 'Member'}</Text>
                        <Text style={styles.trainerEmail}>{order.memberId?.email || ''}</Text>
                        <Text style={styles.trainerEmail}>
                          {(order.items || [])
                            .map((item) => `${item.name} x${item.quantity}`)
                            .join(' • ') || 'No items'}
                        </Text>
                        <Text style={styles.trainerEmail}>${typeof order.totalAmount === 'number' ? order.totalAmount.toFixed(2) : order.totalAmount}</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end', gap: 8 }}>
                        <View style={styles.orderStatusBadge}>
                          <Text style={styles.orderStatusBadgeText}>
                            {(order.status === 'shipped' ? 'DELIVERED' : order.status.toUpperCase())}
                          </Text>
                        </View>
                        <View style={styles.orderStatusChips}>
                          {(['pending', 'confirmed', 'packed', 'delivered', 'cancelled'] as const).map((s) => (
                            <TouchableOpacity
                              key={`${order._id}-${s}`}
                              onPress={() => handleUpdateOrderStatus(order._id, s)}
                              disabled={updatingOrderId === order._id}
                              style={[
                                styles.assignmentFilterChip,
                                order.status === s ? styles.assignmentFilterChipActive : null,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.assignmentFilterChipText,
                                  order.status === s ? styles.assignmentFilterChipTextActive : null,
                                ]}
                              >
                                {s}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              }
            />
          </>
        ) : null}

        {activeSection === 'feedback' ? (
          <>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionHeaderLeft}>
                <TouchableOpacity style={styles.backIconButton} onPress={() => setActiveSection(null)}>
                  <MaterialCommunityIcons name="arrow-left" size={20} color={AppColors.primaryDark} />
                </TouchableOpacity>
                <Text style={styles.sectionTitle}>Ratings & Reviews</Text>
              </View>
            </View>

            <View style={styles.assignmentToolbar}>
              <Text style={styles.assignmentCountText}>{feedbackSummary?.summary || 'No summary available'}</Text>
              <Text style={styles.assignmentCountText}>
                Positive: {feedbackSummary?.totals?.positive || 0} • Normal: {feedbackSummary?.totals?.normal || 0} • Negative: {feedbackSummary?.totals?.negative || 0}
              </Text>
            </View>

            <View style={styles.feedbackSummaryRow}>
              <FeedbackPieChart data={feedbackPieData} />
              <View style={styles.feedbackLegend}>
                {feedbackPieData.map((slice) => {
                  const total = feedbackSummary?.total || 0;
                  const pct = total ? Math.round((slice.value / total) * 100) : 0;
                  return (
                    <View key={slice.label} style={styles.feedbackLegendItem}>
                      <View style={[styles.feedbackLegendSwatch, { backgroundColor: slice.color }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.feedbackLegendLabel}>{slice.label}</Text>
                        <Text style={styles.feedbackLegendValue}>{slice.value} ({pct}%)</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>

            <FlatList
              data={feedbackItems}
              keyExtractor={(item) => item._id}
              contentContainerStyle={styles.listContainer}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[AppColors.primary]} />}
              renderItem={({ item }) => (
                <View style={styles.memberCard}>
                  <View style={styles.cardHeader}>
                    <View style={styles.cardInfo}>
                      <Text style={styles.trainerName}>{item.memberId?.name || 'Member'}</Text>
                      <Text style={styles.trainerEmail}>{item.memberId?.email || ''}</Text>
                    </View>
                    <View style={styles.statusBadge}>
                      <Text style={styles.statusBadgeText}>{item.category.toUpperCase()}</Text>
                    </View>
                  </View>
                  <Text style={styles.detailText}>{item.message}</Text>
                  <Text style={styles.trainerEmail}>{item.aiSummaryHint}</Text>
                  {item.adminReply ? <Text style={styles.detailText}>Reply: {item.adminReply}</Text> : null}
                  <View style={styles.feedbackActionsRow}>
                    <TouchableOpacity style={styles.assignButton} onPress={() => openReplyModal(item)}>
                      <Text style={styles.assignButtonText}>Reply</Text>
                      <MaterialCommunityIcons name="chevron-right" size={18} color={AppColors.primaryDark} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.assignButton, styles.dangerButton]}
                      onPress={() => confirmDeleteFeedback(item._id)}
                      disabled={deletingFeedbackId === item._id}
                    >
                      <MaterialCommunityIcons name="trash-can" size={18} color={AppColors.white} />
                      <Text style={[styles.assignButtonText, styles.dangerButtonText]}>
                        {deletingFeedbackId === item._id ? 'Deleting...' : 'Delete'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            />
          </>
        ) : null}
      </View>

      <Modal
        visible={assignmentModalVisible}
        transparent
        animationType="slide"
        onRequestClose={closeAssignmentPicker}
      >
        <View style={styles.assignmentModalBackdrop}>
          <View style={styles.assignmentModalSheet}>
            <View style={styles.assignmentModalHeader}>
              <Text style={styles.assignmentModalTitle}>
                {bulkAssignMode ? 'Assign Selected Members' : 'Assign Trainer'}
              </Text>
              <TouchableOpacity onPress={closeAssignmentPicker}>
                <MaterialCommunityIcons name="close" size={22} color={AppColors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.assignmentModalSubtext}>
              {bulkAssignMode
                ? `${selectedMemberIds.length} members selected`
                : selectedMember
                  ? `${selectedMember.name} (${selectedMember.email})`
                  : ''}
            </Text>

            <TextInput
              value={trainerSearch}
              onChangeText={setTrainerSearch}
              placeholder="Search trainer by name or email"
              style={styles.assignmentSearchInput}
            />

            <FlatList
              data={filteredTrainers}
              keyExtractor={(item) => item.id}
              style={styles.assignmentTrainerList}
              renderItem={({ item }) => {
                const active = selectedMember?.assignedTrainerId === item.id;
                return (
                  <TouchableOpacity
                    style={[styles.assignmentTrainerItem, active ? styles.assignmentTrainerItemActive : null]}
                    onPress={() =>
                      bulkAssignMode
                        ? handleBulkAssignTrainer(item)
                        : selectedMember && handleAssignTrainer(selectedMember, item)
                    }
                    disabled={
                      assigningMemberId === 'bulk' ||
                      assigningMemberId === selectedMember?.id
                    }
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.assignmentTrainerName}>{item.name}</Text>
                      <Text style={styles.assignmentTrainerEmail}>{item.email}</Text>
                    </View>
                    {active ? (
                      <MaterialCommunityIcons name="check-circle" size={20} color={AppColors.primaryDark} />
                    ) : null}
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <Text style={styles.assignmentNoTrainerText}>No trainers match this search.</Text>
              }
            />

            <TouchableOpacity
              style={styles.assignmentUnassignButton}
              onPress={() =>
                bulkAssignMode
                  ? handleBulkAssignTrainer(null)
                  : selectedMember && handleAssignTrainer(selectedMember, null)
              }
              disabled={
                bulkAssignMode
                  ? selectedMemberIds.length === 0 || assigningMemberId === 'bulk'
                  : !selectedMember?.assignedTrainerId || assigningMemberId === selectedMember?.id
              }
            >
              <Text style={styles.assignmentUnassignButtonText}>Unassign Trainer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={equipmentModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setEquipmentModalVisible(false)}
      >
        <View style={styles.assignmentModalBackdrop}>
          <View style={styles.assignmentModalSheet}>
            <View style={styles.assignmentModalHeader}>
              <Text style={styles.assignmentModalTitle}>
                {editingEquipment ? 'Edit Equipment' : 'Create Equipment'}
              </Text>
              <TouchableOpacity onPress={() => setEquipmentModalVisible(false)}>
                <MaterialCommunityIcons name="close" size={22} color={AppColors.textSecondary} />
              </TouchableOpacity>
            </View>

            <TextInput
              value={equipmentForm.name}
              onChangeText={(value) => setEquipmentForm((prev) => ({ ...prev, name: value }))}
              placeholder="Equipment name"
              style={[styles.assignmentSearchInput, styles.modalFieldGap]}
            />

            <View style={{ marginBottom: 12 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: AppColors.text, marginBottom: 8 }}>
                Equipment Image
              </Text>
              <TouchableOpacity
                style={{
                  backgroundColor: AppColors.neutralLight,
                  padding: 12,
                  borderRadius: 8,
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: AppColors.neutral,
                  borderStyle: 'dashed',
                }}
                onPress={pickImage}
              >
                <MaterialCommunityIcons name="camera-plus" size={24} color={AppColors.primary} />
                <Text style={{ fontSize: 12, color: AppColors.primary, marginTop: 4 }}>
                  {equipmentForm.imageUri ? 'Change Image' : 'Select Image from Gallery'}
                </Text>
              </TouchableOpacity>
            </View>

            {(equipmentForm.imageUri || equipmentForm.imageUrl) ? (
              <View style={{ marginBottom: 12, gap: 8 }}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: AppColors.text }}>Preview:</Text>
                <Image
                  source={{ uri: equipmentForm.imageUri || equipmentForm.imageUrl }}
                  style={{ width: '100%', height: 120, borderRadius: 8, backgroundColor: AppColors.neutralLight }}
                  resizeMode="cover"
                />
                <TouchableOpacity
                  style={{ alignSelf: 'flex-start', padding: 4 }}
                  onPress={() => setEquipmentForm((prev) => ({ ...prev, image: null, imageUri: '', imageUrl: '' }))}
                >
                  <Text style={{ fontSize: 12, color: AppColors.error }}>Remove Image</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            <TextInput
              value={equipmentForm.location}
              onChangeText={(value) => setEquipmentForm((prev) => ({ ...prev, location: value }))}
              placeholder="Location"
              style={[styles.assignmentSearchInput, styles.modalFieldGap]}
            />

            <View style={[styles.assignmentFilterRow, styles.modalFieldGap]}>
              {(['Cardio', 'Strength', 'Flexibility', 'Other'] as const).map((category) => (
                <TouchableOpacity
                  key={category}
                  onPress={() => setEquipmentForm((prev) => ({ ...prev, category }))}
                  style={[
                    styles.assignmentFilterChip,
                    equipmentForm.category === category ? styles.assignmentFilterChipActive : null,
                  ]}
                >
                  <Text
                    style={[
                      styles.assignmentFilterChipText,
                      equipmentForm.category === category ? styles.assignmentFilterChipTextActive : null,
                    ]}
                  >
                    {category}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={[styles.assignmentFilterRow, styles.modalFieldGap]}>
              {(['Good', 'NeedsMaintenance', 'OutOfOrder'] as const).map((status) => (
                <TouchableOpacity
                  key={status}
                  onPress={() => setEquipmentForm((prev) => ({ ...prev, maintenanceStatus: status }))}
                  style={[
                    styles.assignmentFilterChip,
                    equipmentForm.maintenanceStatus === status ? styles.assignmentFilterChipActive : null,
                  ]}
                >
                  <Text
                    style={[
                      styles.assignmentFilterChipText,
                      equipmentForm.maintenanceStatus === status ? styles.assignmentFilterChipTextActive : null,
                    ]}
                  >
                    {status}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={styles.assignmentUnassignButton}
              onPress={handleSaveEquipment}
              disabled={savingEquipment}
            >
              <Text style={styles.assignmentUnassignButtonText}>
                {savingEquipment ? 'Saving...' : editingEquipment ? 'Save Changes' : 'Create Equipment'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={productModalVisible} transparent animationType="slide" onRequestClose={() => setProductModalVisible(false)}>
        <View style={styles.assignmentModalBackdrop}>
          <View style={styles.assignmentModalSheet}>
            <View style={styles.assignmentModalHeader}>
              <Text style={styles.assignmentModalTitle}>{editingProduct ? 'Edit Product' : 'Create Product'}</Text>
              <TouchableOpacity onPress={() => setProductModalVisible(false)}>
                <MaterialCommunityIcons name="close" size={22} color={AppColors.textSecondary} />
              </TouchableOpacity>
            </View>

            <TextInput value={productForm.name} onChangeText={(value) => setProductForm((p) => ({ ...p, name: value }))} placeholder="Product name" style={styles.assignmentSearchInput} />
            <TextInput value={productForm.description} onChangeText={(value) => setProductForm((p) => ({ ...p, description: value }))} placeholder="Description" style={styles.assignmentSearchInput} />
            <TextInput value={productForm.price} onChangeText={(value) => setProductForm((p) => ({ ...p, price: value }))} placeholder="Price" keyboardType="decimal-pad" style={styles.assignmentSearchInput} />
            <TextInput value={productForm.stock} onChangeText={(value) => setProductForm((p) => ({ ...p, stock: value }))} placeholder="Stock" keyboardType="number-pad" style={styles.assignmentSearchInput} />
            <TextInput value={productForm.imageUrl} onChangeText={(value) => setProductForm((p) => ({ ...p, imageUrl: value }))} placeholder="Image URL (optional)" style={styles.assignmentSearchInput} />

            {productForm.imageUrl ? (
              <Image source={{ uri: productForm.imageUrl }} style={styles.productPreviewImage} resizeMode="cover" />
            ) : null}

            <View style={[styles.assignmentFilterRow, styles.modalFieldGap]}>
              {[
                { label: 'Active', value: true },
                { label: 'Hidden', value: false },
              ].map((option) => (
                <TouchableOpacity
                  key={option.label}
                  onPress={() => setProductForm((prev) => ({ ...prev, isActive: option.value }))}
                  style={[
                    styles.assignmentFilterChip,
                    productForm.isActive === option.value ? styles.assignmentFilterChipActive : null,
                  ]}
                >
                  <Text
                    style={[
                      styles.assignmentFilterChipText,
                      productForm.isActive === option.value ? styles.assignmentFilterChipTextActive : null,
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.assignmentUnassignButton} onPress={handleSaveProduct} disabled={savingProduct}>
              <Text style={styles.assignmentUnassignButtonText}>{savingProduct ? 'Saving...' : editingProduct ? 'Save Product' : 'Create Product'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={replyModalVisible} transparent animationType="slide" onRequestClose={() => setReplyModalVisible(false)}>
        <View style={styles.assignmentModalBackdrop}>
          <View style={styles.assignmentModalSheet}>
            <View style={styles.assignmentModalHeader}>
              <Text style={styles.assignmentModalTitle}>Reply Feedback</Text>
              <TouchableOpacity onPress={() => setReplyModalVisible(false)}>
                <MaterialCommunityIcons name="close" size={22} color={AppColors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.assignmentModalSubtext}>{selectedFeedback?.memberId?.name || 'Member'}</Text>
            <TextInput
              value={replyText}
              onChangeText={setReplyText}
              placeholder="Write reply"
              multiline
              style={[styles.assignmentSearchInput, { minHeight: 100, textAlignVertical: 'top' }]}
            />

            <TouchableOpacity
              style={styles.assignmentUnassignButton}
              onPress={handleReplyFeedback}
              disabled={replyingFeedbackId === selectedFeedback?._id}
            >
              <Text style={styles.assignmentUnassignButtonText}>
                {replyingFeedbackId === selectedFeedback?._id ? 'Sending...' : 'Send Reply'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <TrainerModal
        visible={modalVisible}
        token={token || ''}
        mode={modalMode}
        trainerToEdit={editingTrainer}
        onClose={() => {
          setModalVisible(false);
          setEditingTrainer(null);
          setModalMode('create');
        }}
        onSuccess={() => {
          setModalVisible(false);
          setEditingTrainer(null);
          setModalMode('create');
          loadTrainers();
        }}
      />

      {/* Leave Balance Modal */}
      <Modal
        visible={leaveBalanceModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setLeaveBalanceModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.leaveBalanceModalContent}>
            <Text style={styles.leaveBalanceModalTitle}>
              Set Leave Balance for {selectedTrainerForBalance?.name}
            </Text>
            <Text style={styles.leaveBalanceModalSubtitle}>
              Enter the total number of leave days this trainer can take
            </Text>

            <TextInput
              style={styles.leaveBalanceInput}
              placeholder="Number of days"
              placeholderTextColor={AppColors.textMuted}
              keyboardType="number-pad"
              value={leaveBalanceInput}
              onChangeText={setLeaveBalanceInput}
            />

            <View style={styles.leaveBalanceModalButtonRow}>
              <TouchableOpacity
                style={[styles.leaveBalanceModalButton, styles.leaveBalanceModalCancelButton]}
                onPress={() => setLeaveBalanceModalVisible(false)}
              >
                <Text style={styles.leaveBalanceModalCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.leaveBalanceModalButton, styles.leaveBalanceModalConfirmButton]}
                onPress={handleSetLeaveBalance}
              >
                <Text style={styles.leaveBalanceModalConfirmButtonText}>Set Balance</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.white,
    paddingTop: 60,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: AppColors.white,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: AppColors.text,
  },
  subtitle: {
    fontSize: 14,
    color: AppColors.textSecondary,
    marginTop: 4,
  },
  logoutButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: AppColors.text,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backIconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f0f0',
  },
  managementWrap: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: 24,
    gap: 10,
  },
  managementTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: AppColors.text,
    marginBottom: 12,
  },
  managementCard: {
    borderWidth: 1,
    borderColor: '#e8e8e8',
    borderRadius: 12,
    backgroundColor: '#ffffff',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 4,
  },
  managementIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#eef4ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  managementTextWrap: {
    flex: 1,
  },
  membershipListContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 12,
  },
  membershipCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 8,
  },
  membershipHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  membershipMemberName: {
    fontSize: 15,
    fontWeight: '700',
    color: AppColors.text,
  },
  membershipMemberEmail: {
    fontSize: 12,
    color: AppColors.textSecondary,
    marginTop: 2,
  },
  membershipStatusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  membershipStatusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  membershipMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  membershipMetaText: {
    fontSize: 11,
    color: AppColors.textSecondary,
  },
  membershipReasonText: {
    fontSize: 12,
    color: AppColors.text,
    marginTop: 4,
  },
  membershipDecisionText: {
    fontSize: 12,
    color: AppColors.textSecondary,
    marginTop: 2,
  },
  membershipActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  membershipActionButton: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  membershipRejectButton: {
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
  },
  membershipApproveButton: {
    borderColor: '#bbf7d0',
    backgroundColor: '#ecfdf5',
  },
  membershipRejectText: {
    color: '#b91c1c',
    fontSize: 13,
    fontWeight: '700',
  },
  membershipApproveText: {
    color: '#15803d',
    fontSize: 13,
    fontWeight: '700',
  },
  membershipUpdatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  membershipUpdatingText: {
    fontSize: 12,
    color: AppColors.textSecondary,
  },
  managementCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: AppColors.text,
  },
  managementCardSubtitle: {
    fontSize: 12,
    color: AppColors.textSecondary,
    marginTop: 2,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: AppColors.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  createButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: AppColors.white,
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  trainerCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e8e8e8',
  },
  memberCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e7edf5',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  equipmentCardImage: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    marginBottom: 12,
  },
  imageErrorPlaceholder: {
    backgroundColor: AppColors.neutralLight,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  imageErrorText: {
    fontSize: 14,
    fontWeight: '600',
    color: AppColors.error,
  },
  imageErrorSubtext: {
    fontSize: 12,
    color: AppColors.textMuted,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  cardInfo: {
    flex: 1,
  },
  trainerName: {
    fontSize: 16,
    fontWeight: '700',
    color: AppColors.text,
    marginBottom: 4,
  },
  trainerEmail: {
    fontSize: 12,
    color: AppColors.textSecondary,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginRight: -6,
  },
  actionButton: {
    padding: 6,
  },
  cardDetails: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bioRow: {
    marginTop: 4,
  },
  detailText: {
    fontSize: 13,
    color: AppColors.textSecondary,
    flex: 1,
  },
  assignmentSummary: {
    marginBottom: 0,
  },
  assignmentPillsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  assignmentSummaryCompact: {
    flex: 1,
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#f8fbff',
    borderWidth: 1,
    borderColor: '#e5eef8',
  },
  assignmentSummaryLabel: {
    fontSize: 11,
    color: AppColors.textMuted,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  assignmentSummaryValue: {
    fontSize: 13,
    color: AppColors.text,
    fontWeight: '700',
  },
  assignButton: {
    borderWidth: 1,
    borderColor: '#dbe8c8',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#eef8de',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  feedbackActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  dangerButton: {
    backgroundColor: '#ef4444',
    borderColor: '#ef4444',
  },
  dangerButtonText: {
    color: AppColors.white,
  },
  assignButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: AppColors.primaryDark,
  },
  assignmentToolbar: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 10,
    gap: 10,
  },
  feedbackSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  feedbackLegend: {
    flex: 1,
    gap: 8,
  },
  feedbackLegendItem: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  feedbackLegendSwatch: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  feedbackLegendLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: AppColors.text,
  },
  feedbackLegendValue: {
    fontSize: 12,
    color: AppColors.textMuted,
  },
  feedbackPiePlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  feedbackPiePlaceholderText: {
    fontSize: 12,
    color: AppColors.textMuted,
    fontWeight: '700',
  },
  assignmentSearchInput: {
    borderWidth: 1,
    borderColor: '#e1e1e1',
    backgroundColor: '#ffffff',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: AppColors.text,
  },
  assignmentFilterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  modalFieldGap: {
    marginBottom: 12,
  },
  assignmentFilterChip: {
    borderWidth: 1,
    borderColor: '#dadada',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#ffffff',
  },
  assignmentFilterChipActive: {
    borderColor: AppColors.primary,
    backgroundColor: '#ebf7d9',
  },
  assignmentFilterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: AppColors.textSecondary,
  },
  assignmentFilterChipTextActive: {
    color: AppColors.primaryDark,
  },
  assignmentCountText: {
    fontSize: 12,
    color: AppColors.textSecondary,
    fontWeight: '600',
  },
  inlineTextButton: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  inlineTextButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: AppColors.primaryDark,
  },
  bulkActionBar: {
    marginHorizontal: 20,
    marginTop: 4,
    marginBottom: 10,
    backgroundColor: '#eef8de',
    borderWidth: 1,
    borderColor: '#d9eac0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bulkActionText: {
    fontSize: 13,
    color: AppColors.primaryDark,
    fontWeight: '700',
  },
  bulkActionButton: {
    backgroundColor: AppColors.primary,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  bulkActionButtonText: {
    fontSize: 12,
    color: AppColors.white,
    fontWeight: '700',
  },
  assignmentChip: {
    borderWidth: 1,
    borderColor: '#dadada',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: '#ffffff',
  },
  assignmentChipActive: {
    backgroundColor: '#e8f4d4',
    borderColor: AppColors.primary,
  },
  assignmentChipText: {
    fontSize: 12,
    color: AppColors.textSecondary,
    fontWeight: '600',
  },
  assignmentChipTextActive: {
    color: AppColors.primaryDark,
  },
  unassignChip: {
    borderWidth: 1,
    borderColor: '#f2c0c0',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: '#fff5f5',
  },
  unassignChipText: {
    fontSize: 12,
    color: AppColors.error,
    fontWeight: '600',
  },
  assigningRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  assigningText: {
    fontSize: 12,
    color: AppColors.textSecondary,
  },
  statusBadge: {
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusBadgePending: {
    backgroundColor: '#fff8d9',
  },
  statusBadgeApproved: {
    backgroundColor: '#e8f7ec',
  },
  statusBadgeRejected: {
    backgroundColor: '#fdeaea',
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: AppColors.text,
  },
  leaveActionsWrap: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  leaveDecisionButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  approveButton: {
    backgroundColor: AppColors.primary,
  },
  rejectButton: {
    backgroundColor: AppColors.error,
  },
  leaveDecisionText: {
    color: AppColors.white,
    fontSize: 13,
    fontWeight: '700',
  },
  assignmentModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
    justifyContent: 'flex-end',
  },
  assignmentModalSheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 24,
    maxHeight: '78%',
  },
  assignmentModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  assignmentModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: AppColors.text,
  },
  assignmentModalSubtext: {
    fontSize: 12,
    color: AppColors.textSecondary,
    marginBottom: 12,
  },
  assignmentTrainerList: {
    marginTop: 10,
    maxHeight: 320,
  },
  assignmentTrainerItem: {
    borderWidth: 1,
    borderColor: '#e7e7e7',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ffffff',
  },
  assignmentTrainerItemActive: {
    borderColor: AppColors.primary,
    backgroundColor: '#eef8de',
  },
  assignmentTrainerName: {
    fontSize: 14,
    fontWeight: '700',
    color: AppColors.text,
  },
  assignmentTrainerEmail: {
    fontSize: 12,
    color: AppColors.textSecondary,
    marginTop: 2,
  },
  assignmentNoTrainerText: {
    fontSize: 12,
    color: AppColors.textSecondary,
    textAlign: 'center',
    marginTop: 16,
  },
  assignmentUnassignButton: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#f2c0c0',
    backgroundColor: '#fff5f5',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  assignmentUnassignButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: AppColors.error,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: AppColors.text,
    marginTop: 16,
  },
  emptyStateSubtitle: {
    fontSize: 14,
    color: AppColors.textSecondary,
    marginTop: 8,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  leaveBalanceModalContent: {
    backgroundColor: AppColors.white,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  leaveBalanceModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: AppColors.text,
    marginBottom: 8,
  },
  leaveBalanceModalSubtitle: {
    fontSize: 14,
    color: AppColors.textSecondary,
    marginBottom: 20,
  },
  leaveBalanceInput: {
    borderWidth: 1,
    borderColor: AppColors.textMuted,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: AppColors.text,
    marginBottom: 20,
  },
  leaveBalanceModalButtonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  leaveBalanceModalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  leaveBalanceModalCancelButton: {
    backgroundColor: AppColors.surface,
  },
  leaveBalanceModalCancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: AppColors.text,
  },
  leaveBalanceModalConfirmButton: {
    backgroundColor: AppColors.primary,
  },
  leaveBalanceModalConfirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: AppColors.white,
  },
  scheduleCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e8e8e8',
  },
  scheduleCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 10,
  },
  scheduleBadge: {
    backgroundColor: '#e8f8df',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  scheduleBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#246300',
  },
  scheduleModeText: {
    fontSize: 12,
    color: AppColors.textSecondary,
    marginBottom: 8,
  },
  scheduleOffText: {
    fontSize: 12,
    color: AppColors.textMuted,
  },
  scheduleDayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
    borderTopWidth: 1,
    borderTopColor: '#ececec',
  },
  scheduleDayLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: AppColors.text,
  },
  scheduleDayTime: {
    fontSize: 13,
    fontWeight: '600',
    color: AppColors.primaryDark,
  },
  shopStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  shopStatCard: {
    flex: 1,
    backgroundColor: '#f6f8fb',
    borderWidth: 1,
    borderColor: '#e5ebf2',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  shopStatLabel: {
    fontSize: 11,
    color: AppColors.textSecondary,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  shopStatValue: {
    fontSize: 16,
    fontWeight: '800',
    color: AppColors.text,
    marginTop: 2,
  },
  shopStatValueWarning: {
    color: AppColors.error,
  },
  productGrid: {
    paddingHorizontal: 16,
    paddingBottom: 20,
    gap: 12,
  },
  productGridRow: {
    gap: 12,
  },
  shopProductCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5ebf2',
    padding: 12,
    gap: 10,
  },
  shopProductImageWrap: {
    height: 120,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#f5f7fb',
  },
  shopProductImage: {
    width: '100%',
    height: '100%',
  },
  shopProductPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shopBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 10,
  },
  shopBadgeActive: {
    backgroundColor: '#e8f7ec',
  },
  shopBadgeInactive: {
    backgroundColor: '#fff4e5',
  },
  shopBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0f172a',
  },
  shopBadgeTextMuted: {
    color: '#9a3412',
  },
  shopProductName: {
    fontSize: 15,
    fontWeight: '800',
    color: AppColors.text,
  },
  shopProductDesc: {
    fontSize: 12,
    color: AppColors.textSecondary,
  },
  shopMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  shopPrice: {
    fontSize: 14,
    fontWeight: '800',
    color: AppColors.primaryDark,
  },
  shopStock: {
    fontSize: 12,
    fontWeight: '700',
    color: AppColors.textSecondary,
  },
  shopLowStock: {
    color: AppColors.error,
  },
  shopActionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  shopActionButton: {
    flex: 1,
    backgroundColor: AppColors.primary,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  shopActionButtonSecondary: {
    backgroundColor: '#eef2ff',
    borderWidth: 1,
    borderColor: '#e0e7ff',
  },
  shopActionButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: AppColors.white,
  },
  shopActionButtonSecondaryText: {
    color: AppColors.primaryDark,
  },
  shopDeleteButton: {
    marginTop: 4,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#fff5f5',
    borderWidth: 1,
    borderColor: '#fee2e2',
    alignItems: 'center',
  },
  shopDeleteButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: AppColors.error,
  },
  shopOrdersBlock: {
    marginTop: 12,
    gap: 10,
    paddingBottom: 12,
  },
  shopOrderRow: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5ebf2',
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  orderStatusBadge: {
    backgroundColor: '#eef2ff',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  orderStatusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#312e81',
  },
  orderStatusChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    maxWidth: 180,
  },
  productPreviewImage: {
    width: '100%',
    height: 120,
    borderRadius: 10,
    marginBottom: 12,
  },
});

