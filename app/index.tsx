
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import NotificationBell from '@/components/NotificationBell';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  View,
} from 'react-native';

const API_URL = 'https://findback-lostandfound.onrender.com';

const USER_STORAGE_KEY = 'findback_user';
const TOKEN_STORAGE_KEY = 'findback_token';

const C = {
  background: '#E9DDF7',
  light: '#F5EFFB',
  purple: '#40205F',
  dark: '#29163D',
  yellow: '#F4C84A',
  white: '#FFFFFF',
  muted: '#796B86',
  border: '#D9C6ED',
  blue: '#DCEBFA',
  blueDark: '#24558A',
};

type Report = {
  id: string;
  type: 'Lost' | 'Found';
  itemName: string;
  category: string;
  description: string;
  location: string;
  date: string;
  createdAt?: string;
};

const categories = [
  { emoji: '🎒', name: 'Bags' },
  { emoji: '📱', name: 'Electronics' },
  { emoji: '🔑', name: 'Keys' },
  { emoji: '👛', name: 'Wallets' },
  { emoji: '📦', name: 'Other' },
];

const steps = [
  { number: '01', title: 'Report an item', desc: 'Share what you lost or found.' },
  { number: '02', title: 'Explore listings', desc: 'Browse reported belongings.' },
  { number: '03', title: 'Reconnect', desc: 'Help an item reach its owner.' },
];

const filters = ['All', 'Lost', 'Found'];

export default function HomeScreen() {
  const router = useRouter();

  const [reports, setReports] = useState<Report[]>([]);
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState('All');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  // Check whether the user is logged in
  const checkSession = useCallback(async () => {
    try {
      const [token, user] = await AsyncStorage.multiGet([
        TOKEN_STORAGE_KEY,
        USER_STORAGE_KEY,
      ]);

      const hasToken = Boolean(token[1]);
      const hasUser = Boolean(user[1]);

      setIsLoggedIn(hasToken && hasUser);
    } catch (err) {
      console.log('Session check error:', err);
      setIsLoggedIn(false);
    } finally {
      setCheckingSession(false);
    }
  }, []);

  // Logout function
  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Logout',
          onPress: async () => {
            try {
              await AsyncStorage.multiRemove([
                TOKEN_STORAGE_KEY,
                USER_STORAGE_KEY,
              ]);

              setIsLoggedIn(false);

              Alert.alert('Logged Out', 'You have successfully logged out.');
            } catch (err) {
              Alert.alert(
                'Error',
                'Could not logout. Please try again.'
              );
            }
          },
        },
      ]
    );
  };

  // Load reports from backend
  const loadReports = useCallback(async (manualRefresh = false) => {
    if (manualRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError('');

    try {
      const response = await fetch(`${API_URL}/api/reports`);
      const data = await response.json();

      if (!response.ok || data.success === false) {
        throw new Error(data.message || 'Could not load reports.');
      }

      const list = Array.isArray(data)
        ? data
        : Array.isArray(data.reports)
          ? data.reports
          : [];

      const normalized: Report[] = list.map((item: any) => ({
        id: String(item._id || item.id || ''),
        type: item.type === 'Found' ? 'Found' : 'Lost',
        itemName: String(item.itemName || 'Unnamed item'),
        category: String(item.category || 'Other'),
        description: String(item.description || ''),
        location: String(item.location || 'Location not provided'),
        date: item.date
          ? String(item.date).slice(0, 10)
          : item.createdAt
            ? new Date(item.createdAt).toLocaleDateString()
            : 'Date not provided',
        createdAt: item.createdAt,
      }));

      normalized.sort((a, b) => {
        const dateA = new Date(a.createdAt || 0).getTime();
        const dateB = new Date(b.createdAt || 0).getTime();
        return dateB - dateA;
      });

      setReports(normalized);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not connect to the server.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Refresh session and reports whenever Home screen is focused
  useFocusEffect(
    useCallback(() => {
      checkSession();
      loadReports();
    }, [checkSession, loadReports])
  );

  const filteredReports = reports.filter((report) => {
    const query = search.trim().toLowerCase();

    const matchesSearch =
      report.itemName.toLowerCase().includes(query) ||
      report.description.toLowerCase().includes(query) ||
      report.location.toLowerCase().includes(query);

    const matchesType =
      selectedType === 'All' || report.type === selectedType;

    const matchesCategory =
      selectedCategory === 'All' ||
      report.category.toLowerCase() === selectedCategory.toLowerCase();

    return matchesSearch && matchesType && matchesCategory;
  });

  return (
    <ScrollView
      className="flex-1"
      style={{ backgroundColor: C.background }}
      contentContainerStyle={{ padding: 22, paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* Header */}
      <View className="mb-8 mt-7">
        <View className="mb-4 flex-row items-center justify-between">
          <View className="flex-row items-center gap-3">
            <View
              className="h-12 w-12 items-center justify-center rounded-2xl"
              style={{ backgroundColor: C.purple }}
            >
              <Text className="text-2xl">🔎</Text>
            </View>

            <View>
              <Text
                className="text-xl font-extrabold"
                style={{ color: C.purple }}
              >
                FindBack
              </Text>
              <Text className="text-xs" style={{ color: C.muted }}>
                Find it. Return it. Reconnect.
              </Text>
            </View>
          </View>

          {/* Notification Bell + Report Button */}
          <View className="flex-row items-center gap-3">
            {!checkingSession && (
              <NotificationBell isLoggedIn={isLoggedIn} />
            )}

            <Button
              size="icon"
              variant="outline"
              className="rounded-xl border-0"
              onPress={() => router.push('/report')}
            >
              <Text className="text-xl" style={{ color: C.purple }}>
                +
              </Text>
            </Button>
          </View>
        </View>

        <View className="flex-row gap-3">
          <Button
            className="flex-1 rounded-xl border-0"
            style={{ backgroundColor: C.white }}
            onPress={() => router.push('/login')}
          >
            <Text className="font-extrabold" style={{ color: C.purple }}>
              Login
            </Text>
          </Button>

          <Button
            className="flex-1 rounded-xl border-0"
            style={{ backgroundColor: C.yellow }}
            onPress={() => router.push('/signup')}
          >
            <Text className="font-extrabold" style={{ color: C.purple }}>
              Sign Up
            </Text>
          </Button>
        </View>
      </View>

      {/* Intro */}
      <View className="mb-6">
        <Text
          className="mb-2 text-xs font-bold tracking-widest"
          style={{ color: C.muted }}
        >
          YOUR COMMUNITY HELPER
        </Text>

        <Text
          className="text-3xl font-extrabold"
          style={{ color: C.dark, lineHeight: 40 }}
        >
          Lost something?
        </Text>

        <Text className="text-3xl font-extrabold" style={{ color: C.purple }}>
          Find it with FindBack.
        </Text>

        <Text className="mt-3 text-sm leading-6" style={{ color: C.muted }}>
          Every lost item has a way home. Let's help it get there.
        </Text>
      </View>

      {/* Hero Card */}
      <View
        className="mb-5 overflow-hidden rounded-3xl p-6"
        style={{ backgroundColor: C.purple }}
      >
        <View
          className="absolute -right-7 -top-7 h-28 w-28 rounded-full"
          style={{ backgroundColor: '#563777' }}
        />

        <View
          className="absolute bottom-0 right-10 h-16 w-16 rounded-full"
          style={{ backgroundColor: '#4B2D69' }}
        />

        <Text
          className="text-xs font-extrabold tracking-widest"
          style={{ color: C.yellow }}
        >
          LOST OR FOUND?
        </Text>

        <Text className="mt-3 text-3xl font-extrabold" style={{ color: C.white }}>
          Let's find it
        </Text>
        <Text className="text-3xl font-extrabold" style={{ color: C.white }}>
          together.
        </Text>

        <Text
          className="mb-5 mt-3 text-sm leading-6"
          style={{ color: '#E9DDF7' }}
        >
          Report a lost or found item and help belongings return to their owners.
        </Text>

        <Button
          className="self-start rounded-xl border-0"
          style={{ backgroundColor: C.yellow }}
          onPress={() => router.push('/report')}
        >
          <Text className="font-extrabold" style={{ color: C.purple }}>
            + Report an Item
          </Text>
        </Button>
      </View>

      {/* My Reports */}
      <Button
        className="mb-3 rounded-2xl border-0"
        style={{ backgroundColor: C.purple }}
        onPress={() => router.push('/reports')}
      >
        <Text className="font-extrabold" style={{ color: C.white }}>
          📋 My Reports →
        </Text>
      </Button>

      {/* Manage Users */}
      <Button
        className="mb-8 rounded-2xl border-0"
        style={{ backgroundColor: C.blue }}
        onPress={() => router.push('/users')}
      >
        <Text className="font-extrabold" style={{ color: C.blueDark }}>
          👥 Manage Users →
        </Text>
      </Button>

      {/* Search and Filters */}
      <View
        className="mb-6 rounded-2xl border p-4"
        style={{ backgroundColor: C.light, borderColor: C.border }}
      >
        <Text className="mb-3 text-xl font-extrabold" style={{ color: C.purple }}>
          🔍 Find an Item
        </Text>

        <Input
          value={search}
          onChangeText={setSearch}
          placeholder="Search item, description or location..."
          className="mb-4"
        />

        <Text className="mb-2 text-sm font-bold" style={{ color: C.dark }}>
          Filter by type
        </Text>

        <View className="mb-4 flex-row flex-wrap gap-2">
          {filters.map((filter) => (
            <Button
              key={filter}
              size="sm"
              className="rounded-xl border-0"
              style={{
                backgroundColor: selectedType === filter ? C.purple : C.white,
              }}
              onPress={() => setSelectedType(filter)}
            >
              <Text
                className="font-bold"
                style={{ color: selectedType === filter ? C.white : C.purple }}
              >
                {filter}
              </Text>
            </Button>
          ))}
        </View>

        <Text className="mb-2 text-sm font-bold" style={{ color: C.dark }}>
          Filter by category
        </Text>

        <View className="flex-row flex-wrap gap-2">
          {['All', ...categories.map((item) => item.name)].map((category) => (
            <Button
              key={category}
              size="sm"
              className="rounded-xl border-0"
              style={{
                backgroundColor:
                  selectedCategory === category ? C.yellow : C.white,
              }}
              onPress={() => setSelectedCategory(category)}
            >
              <Text className="font-bold" style={{ color: C.purple }}>
                {category}
              </Text>
            </Button>
          ))}
        </View>
      </View>

      {/* Recent Listings */}
      <View className="mb-4 flex-row items-center justify-between">
        <Text className="text-xl font-extrabold" style={{ color: C.dark }}>
          Recent Listings
        </Text>

        <Text className="text-xs font-bold" style={{ color: C.purple }}>
          {filteredReports.length} ITEMS
        </Text>
      </View>

      <Button
        className="mb-4 rounded-xl border-0"
        style={{ backgroundColor: C.purple }}
        onPress={() => loadReports(true)}
        disabled={refreshing}
      >
        <Text className="font-bold" style={{ color: C.white }}>
          {refreshing ? 'Refreshing...' : '↻ Refresh Listings'}
        </Text>
      </Button>

      {loading ? (
        <View
          className="mb-6 items-center rounded-2xl p-8"
          style={{ backgroundColor: C.light }}
        >
          <ActivityIndicator size="large" color={C.purple} />
          <Text className="mt-3" style={{ color: C.muted }}>
            Loading reports...
          </Text>
        </View>
      ) : error ? (
        <View
          className="mb-6 rounded-2xl border p-5"
          style={{ backgroundColor: C.light, borderColor: C.border }}
        >
          <Text
            className="mb-2 text-base font-extrabold"
            style={{ color: C.purple }}
          >
            Could not load reports
          </Text>
          <Text className="mb-4 text-sm" style={{ color: C.muted }}>
            {error}
          </Text>
          <Button
            className="rounded-xl border-0"
            style={{ backgroundColor: C.purple }}
            onPress={() => loadReports(true)}
          >
            <Text className="font-bold" style={{ color: C.white }}>
              Try Again
            </Text>
          </Button>
        </View>
      ) : filteredReports.length === 0 ? (
        <View
          className="mb-6 items-center rounded-2xl border p-6"
          style={{ backgroundColor: C.light, borderColor: C.border }}
        >
          <Text className="mb-2 text-3xl">📦</Text>
          <Text className="text-base font-extrabold" style={{ color: C.purple }}>
            No items found
          </Text>
          <Text className="mt-2 text-center text-sm" style={{ color: C.muted }}>
            Try another search or filter, or submit a new report.
          </Text>

          {(search || selectedType !== 'All' || selectedCategory !== 'All') && (
            <Button
              className="mt-4 rounded-xl border-0"
              style={{ backgroundColor: C.purple }}
              onPress={() => {
                setSearch('');
                setSelectedType('All');
                setSelectedCategory('All');
              }}
            >
              <Text className="font-bold" style={{ color: C.white }}>
                Clear Filters
              </Text>
            </Button>
          )}
        </View>
      ) : (
        filteredReports.map((report) => (
          <View
            key={report.id}
            className="mb-3 rounded-2xl border p-4"
            style={{ backgroundColor: C.white, borderColor: C.border }}
          >
            <View className="mb-2 flex-row items-center justify-between">
              <Text
                className="rounded-lg px-3 py-1 text-xs font-extrabold"
                style={{
                  color: report.type === 'Lost' ? C.purple : C.blueDark,
                  backgroundColor: report.type === 'Lost' ? C.background : C.blue,
                }}
              >
                {report.type}
              </Text>

              <Text className="text-xs" style={{ color: C.muted }}>
                {report.date}
              </Text>
            </View>

            <Text className="mb-1 text-lg font-extrabold" style={{ color: C.dark }}>
              {report.itemName}
            </Text>
            <Text className="mb-1 text-sm" style={{ color: C.purple }}>
              {report.category}
            </Text>
            <Text className="mb-2 text-sm" style={{ color: C.muted }}>
              📍 {report.location}
            </Text>
            <Text className="text-sm leading-5" style={{ color: C.dark }}>
              {report.description}
            </Text>
          </View>
        ))
      )}

      {/* Browse Categories */}
      <View className="mb-4 mt-5 flex-row items-center justify-between">
        <Text className="text-xl font-extrabold" style={{ color: C.dark }}>
          Browse Categories
        </Text>
        <Text className="text-xs font-bold" style={{ color: C.purple }}>
          EXPLORE
        </Text>
      </View>

      <View className="flex-row flex-wrap justify-between gap-y-3">
        {categories.map((item) => (
          <Button
            key={item.name}
            variant="outline"
            className="w-[48%] rounded-2xl border p-3"
            style={{ backgroundColor: C.light, borderColor: C.border }}
            onPress={() => {
              setSelectedCategory(item.name);
              setSearch('');
              setSelectedType('All');
            }}
          >
            <View className="flex-row items-center gap-2">
              <Text className="text-xl">{item.emoji}</Text>
              <Text className="text-xs font-bold" style={{ color: C.dark }}>
                {item.name}
              </Text>
            </View>
          </Button>
        ))}
      </View>

      {/* How It Works */}
      <View
        className="mt-8 rounded-3xl border p-5"
        style={{ backgroundColor: C.light, borderColor: C.border }}
      >
        <Text className="mb-5 text-xl font-extrabold" style={{ color: C.purple }}>
          How it works
        </Text>

        {steps.map((step) => (
          <View key={step.number} className="mb-5 flex-row items-center gap-3">
            <View
              className="h-11 w-11 items-center justify-center rounded-xl"
              style={{ backgroundColor: C.background }}
            >
              <Text className="font-extrabold" style={{ color: C.purple }}>
                {step.number}
              </Text>
            </View>

            <View className="flex-1">
              <Text className="font-bold" style={{ color: C.dark }}>
                {step.title}
              </Text>
              <Text className="mt-1 text-xs" style={{ color: C.muted }}>
                {step.desc}
              </Text>
            </View>
          </View>
        ))}
      </View>

      {/* Footer */}
      <Text className="mt-7 text-center text-xs" style={{ color: C.muted }}>
        FindBack — A little help brings things home. 💜
      </Text>

      {/* Logout - Only visible when logged in */}
      {!checkingSession && isLoggedIn && (
        <View className="mt-6 border-t pt-5" style={{ borderColor: C.border }}>
          <Button
            className="rounded-2xl border-0"
            style={{ backgroundColor: C.blue }}
            onPress={handleLogout}
          >
            <Text className="font-extrabold" style={{ color: C.blueDark }}>
              Logout →
            </Text>
          </Button>
        </View>
      )}
    </ScrollView>
  );
}

