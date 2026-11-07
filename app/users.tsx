
import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TextInput,
  Pressable,
  RefreshControl,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

const API_URL = 'https://findback-lostandfound.onrender.com';
const TOKEN_STORAGE_KEY = 'findback_token';
const USER_STORAGE_KEY = 'findback_user';

type User = {
  _id: string;
  name: string;
  email: string;
};

type SavedUser = {
  id?: string;
  _id?: string;
  name?: string;
  email?: string;
};

export default function UsersScreen() {
  const router = useRouter();

  const [users, setUsers] = useState<User[]>([]);
  const [currentUserId, setCurrentUserId] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  const getAuthConfig = async () => {
    const token = await AsyncStorage.getItem(TOKEN_STORAGE_KEY);

    if (!token) {
      throw new Error('NO_TOKEN');
    }

    return {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      timeout: 15000,
    };
  };

  const handleAuthError = (error: unknown) => {
    if (
      error instanceof Error &&
      error.message === 'NO_TOKEN'
    ) {
      Alert.alert(
        'Login Required',
        'Please log in to access user management.',
        [
          {
            text: 'Go to Login',
            onPress: () => router.replace('/login'),
          },
        ]
      );
      return true;
    }

    if (
      axios.isAxiosError(error) &&
      error.response?.status === 401
    ) {
      Alert.alert(
        'Session Expired',
        'Please log in again.',
        [
          {
            text: 'Login',
            onPress: async () => {
              await AsyncStorage.multiRemove([
                TOKEN_STORAGE_KEY,
                USER_STORAGE_KEY,
              ]);
              router.replace('/login');
            },
          },
        ]
      );
      return true;
    }

    return false;
  };

  const fetchUsers = async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true);
      else setLoading(true);

      const savedUser = await AsyncStorage.getItem(USER_STORAGE_KEY);

      if (savedUser) {
        const parsedUser: SavedUser = JSON.parse(savedUser);
        setCurrentUserId(parsedUser.id || parsedUser._id || '');
      }

      const config = await getAuthConfig();

      const response = await axios.get(
        `${API_URL}/api/users`,
        config
      );

      setUsers(response.data.users ?? []);
    } catch (error: unknown) {
      if (!handleAuthError(error)) {
        Alert.alert(
          'Error',
          axios.isAxiosError(error)
            ? error.response?.data?.message || 'Could not load users.'
            : 'Could not load users.'
        );
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchUsers();
    }, [])
  );

  const startEdit = (user: User) => {
    if (user._id !== currentUserId) {
      Alert.alert(
        'Permission Denied',
        'You can only edit your own account.'
      );
      return;
    }

    setEditingId(user._id);
    setName(user.name);
    setEmail(user.email);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setName('');
    setEmail('');
  };

  const saveEdit = async () => {
    if (!editingId) return;

    if (editingId !== currentUserId) {
      Alert.alert('Permission Denied', 'You can only edit your own account.');
      return;
    }

    if (!name.trim() || !email.trim()) {
      Alert.alert('Required', 'Name and email cannot be empty.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }

    try {
      const config = await getAuthConfig();

      const response = await axios.put(
        `${API_URL}/api/users/${editingId}`,
        {
          name: name.trim(),
          email: email.trim().toLowerCase(),
        },
        config
      );

      Alert.alert(
        'Success',
        response.data.message || 'User updated successfully.'
      );

      cancelEdit();
      await fetchUsers(true);
    } catch (error: unknown) {
      if (!handleAuthError(error)) {
        Alert.alert(
          'Update Failed',
          axios.isAxiosError(error)
            ? error.response?.data?.message || 'Could not update user.'
            : 'Could not update user.'
        );
      }
    }
  };

  const deleteUser = (user: User) => {
    if (user._id !== currentUserId) {
      Alert.alert(
        'Permission Denied',
        'You can only delete your own account.'
      );
      return;
    }

    Alert.alert(
      'Delete Account',
      `Are you sure you want to delete your account, ${user.name}? You will need to sign up again to use FindBack.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const config = await getAuthConfig();

              const response = await axios.delete(
                `${API_URL}/api/users/${user._id}`,
                config
              );

              await AsyncStorage.multiRemove([
                TOKEN_STORAGE_KEY,
                USER_STORAGE_KEY,
              ]);

              Alert.alert(
                'Account Deleted',
                response.data.message || 'Your account was deleted.',
                [
                  {
                    text: 'OK',
                    onPress: () => router.replace('/login'),
                  },
                ]
              );
            } catch (error: unknown) {
              if (!handleAuthError(error)) {
                Alert.alert(
                  'Delete Failed',
                  axios.isAxiosError(error)
                    ? error.response?.data?.message || 'Could not delete account.'
                    : 'Could not delete account.'
                );
              }
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#40205F" />
        <Text style={styles.muted}>Loading users...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>User Management</Text>
      <Text style={styles.subtitle}>
        {users.length} registered users
      </Text>

      {editingId && (
        <View style={styles.editCard}>
          <Text style={styles.editHeading}>Edit My Account</Text>

          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Full name"
            placeholderTextColor="#777"
          />

          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="Email address"
            placeholderTextColor="#777"
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <View style={styles.actions}>
            <Pressable style={styles.saveButton} onPress={saveEdit}>
              <Text style={styles.saveText}>Save Changes</Text>
            </Pressable>

            <Pressable style={styles.cancelButton} onPress={cancelEdit}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      )}

      <FlatList
        data={users}
        keyExtractor={(item) => item._id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchUsers(true)}
            tintColor="#40205F"
          />
        }
        ListEmptyComponent={
          <Text style={styles.empty}>No users found.</Text>
        }
        contentContainerStyle={
          users.length === 0 ? styles.emptyContainer : undefined
        }
        renderItem={({ item, index }) => {
          const isCurrentUser = item._id === currentUserId;

          return (
            <View style={styles.userCard}>
              <View style={styles.userTop}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {item.name?.charAt(0)?.toUpperCase() || 'U'}
                  </Text>
                </View>

                <View style={styles.userInfo}>
                  <Text style={styles.userName}>
                    {item.name}
                    {isCurrentUser ? ' (You)' : ''}
                  </Text>
                  <Text style={styles.userEmail}>{item.email}</Text>
                  <Text style={styles.userNumber}>
                    User #{index + 1}
                  </Text>
                </View>
              </View>

              {isCurrentUser && (
                <View style={styles.actions}>
                  <Pressable
                    style={styles.editButton}
                    onPress={() => startEdit(item)}
                  >
                    <Text style={styles.editButtonText}>Edit</Text>
                  </Pressable>

                  <Pressable
                    style={styles.deleteButton}
                    onPress={() => deleteUser(item)}
                  >
                    <Text style={styles.deleteButtonText}>
                      Delete Account
                    </Text>
                  </Pressable>
                </View>
              )}
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F5FC',
    paddingHorizontal: 18,
    paddingTop: 24,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F5FC',
  },
  heading: {
    fontSize: 27,
    fontWeight: '800',
    color: '#40205F',
  },
  subtitle: {
    color: '#64748B',
    marginTop: 5,
    marginBottom: 18,
    fontSize: 14,
  },
  editCard: {
    backgroundColor: '#E9DDF7',
    borderRadius: 16,
    padding: 15,
    marginBottom: 16,
  },
  editHeading: {
    color: '#40205F',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 10,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBB8E5',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    color: '#241438',
    marginBottom: 10,
  },
  userCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5DDF0',
    borderRadius: 16,
    padding: 15,
    marginBottom: 13,
  },
  userTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#E9DDF7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#40205F',
    fontSize: 20,
    fontWeight: '800',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    color: '#241438',
    fontWeight: '700',
    fontSize: 16,
  },
  userEmail: {
    color: '#536176',
    fontSize: 13,
    marginTop: 3,
  },
  userNumber: {
    color: '#4773B8',
    fontSize: 12,
    marginTop: 5,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 13,
    flexWrap: 'wrap',
  },
  editButton: {
    backgroundColor: '#E9DDF7',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 9,
  },
  editButtonText: {
    color: '#40205F',
    fontWeight: '700',
  },
  deleteButton: {
    backgroundColor: '#E5EEFC',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 9,
  },
  deleteButtonText: {
    color: '#315D9B',
    fontWeight: '700',
  },
  saveButton: {
    backgroundColor: '#40205F',
    paddingVertical: 11,
    paddingHorizontal: 15,
    borderRadius: 9,
    flex: 1,
    alignItems: 'center',
  },
  saveText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  cancelButton: {
    backgroundColor: '#E5EEFC',
    paddingVertical: 11,
    paddingHorizontal: 15,
    borderRadius: 9,
  },
  cancelText: {
    color: '#315D9B',
    fontWeight: '700',
  },
  empty: {
    color: '#64748B',
    textAlign: 'center',
    marginTop: 30,
  },
  emptyContainer: {
    flexGrow: 1,
  },
  muted: {
    color: '#64748B',
    marginTop: 10,
  },
});
