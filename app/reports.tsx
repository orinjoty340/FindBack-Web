
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  TextInput,
  View,
} from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';

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
  blue: '#3979C3',
  blueLight: '#E5EEFC',
  blueDeep: '#285DAB',
};

type Report = {
  id: string;
  _id?: string;
  type: 'Lost' | 'Found';
  itemName: string;
  category: string;
  description: string;
  location: string;
  date: string;
  createdAt?: string;
  status: 'Active' | 'Resolved';
};

type EditFields = {
  type: 'Lost' | 'Found';
  itemName: string;
  category: string;
  description: string;
  location: string;
  date: string;
};

const inputStyle = {
  borderWidth: 1,
  borderColor: C.border,
  backgroundColor: C.white,
  borderRadius: 10,
  paddingHorizontal: 12,
  paddingVertical: 10,
  color: C.dark,
  marginBottom: 12,
} as const;

export default function ReportsScreen() {
  const router = useRouter();

  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState('All');
  const [editingId, setEditingId] = useState<string | null>(null);

  const [editFields, setEditFields] = useState<EditFields>({
    type: 'Lost',
    itemName: '',
    category: '',
    description: '',
    location: '',
    date: '',
  });

  // Get the logged-in user's ID.
  const getUserId = async () => {
    const savedUser = await AsyncStorage.getItem(USER_STORAGE_KEY);

    if (!savedUser) {
      throw new Error('Please log in again to manage your reports.');
    }

    const user = JSON.parse(savedUser);
    const userId = String(user.id || user._id || '');

    if (!userId) {
      throw new Error('User information is missing. Please log in again.');
    }

    return userId;
  };

  // Get JWT token for protected API requests.
  const getAuthConfig = async () => {
    const token = await AsyncStorage.getItem(TOKEN_STORAGE_KEY);

    if (!token) {
      throw new Error('Authentication token missing. Please log in again.');
    }

    return {
      timeout: 15000,
      headers: {
        Authorization: `Bearer ${token}`,
      },
    };
  };

  // Load reports belonging to the logged-in user.
  const loadReports = useCallback(async () => {
    setLoading(true);

    try {
      const userId = await getUserId();
      const authConfig = await getAuthConfig();

      const response = await axios.get(
        `${API_URL}/api/reports/user/${userId}`,
        authConfig
      );

      if (!response.data?.success) {
        throw new Error(
          response.data?.message || 'Could not fetch reports.'
        );
      }

      const fetchedReports: Report[] = (
        response.data.reports || []
      ).map((report: any) => ({
        ...report,
        id: String(report._id || report.id),
        status: report.status || 'Active',
      }));

      setReports(fetchedReports);
    } catch (error) {
      Alert.alert(
        'Could not load reports',
        axios.isAxiosError(error)
          ? error.response?.data?.message ||
              'Check that the backend is running and your phone can reach it.'
          : error instanceof Error
            ? error.message
            : 'Could not load your reports.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadReports();
    }, [loadReports])
  );

  // Update report status.
  const updateStatus = async (report: Report) => {
    const nextStatus =
      report.status === 'Resolved' ? 'Active' : 'Resolved';

    setSaving(true);

    try {
      const authConfig = await getAuthConfig();

      const response = await axios.put(
        `${API_URL}/api/reports/${report.id}`,
        { status: nextStatus },
        authConfig
      );

      if (!response.data?.success) {
        throw new Error(
          response.data?.message || 'Could not update status.'
        );
      }

      setReports((current) =>
        current.map((item) =>
          item.id === report.id
            ? { ...item, status: nextStatus }
            : item
        )
      );

      Alert.alert(
        'Status Updated',
        nextStatus === 'Resolved'
          ? 'Your report is now marked as Resolved.'
          : 'Your report is active again.'
      );
    } catch (error) {
      Alert.alert(
        'Update Failed',
        axios.isAxiosError(error)
          ? error.response?.data?.message ||
              'Could not connect to the server.'
          : error instanceof Error
            ? error.message
            : 'Could not update status.'
      );
    } finally {
      setSaving(false);
    }
  };

  // Start editing a report.
  const startEditing = (report: Report) => {
    setEditFields({
      type: report.type,
      itemName: report.itemName,
      category: report.category,
      description: report.description,
      location: report.location,
      date: report.date,
    });

    setEditingId(report.id);
  };

  // Save edited report.
  const saveEdit = async (report: Report) => {
    const fields = {
      type: editFields.type,
      itemName: editFields.itemName.trim(),
      category: editFields.category.trim(),
      description: editFields.description.trim(),
      location: editFields.location.trim(),
      date: editFields.date.trim(),
    };

    if (
      !fields.itemName ||
      !fields.category ||
      !fields.description ||
      !fields.location ||
      !fields.date
    ) {
      Alert.alert(
        'Missing Information',
        'Please fill in every field.'
      );
      return;
    }

    setSaving(true);

    try {
      const authConfig = await getAuthConfig();

      const response = await axios.put(
        `${API_URL}/api/reports/${report.id}`,
        fields,
        authConfig
      );

      if (!response.data?.success) {
        throw new Error(
          response.data?.message || 'Could not save your changes.'
        );
      }

      const updated = response.data.report;

      setReports((current) =>
        current.map((item) =>
          item.id === report.id
            ? {
                ...item,
                ...fields,
                status: updated?.status || item.status || 'Active',
              }
            : item
        )
      );

      setEditingId(null);

      Alert.alert('Saved', 'Your report has been updated.');
    } catch (error) {
      Alert.alert(
        'Edit Failed',
        axios.isAxiosError(error)
          ? error.response?.data?.message ||
              'Could not connect to the server.'
          : error instanceof Error
            ? error.message
            : 'Could not save your report.'
      );
    } finally {
      setSaving(false);
    }
  };

  // Delete report.
  const deleteReport = (report: Report) => {
    Alert.alert(
      'Delete Report',
      `Delete "${report.itemName}" permanently?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'default',
          onPress: async () => {
            setSaving(true);

            try {
              const authConfig = await getAuthConfig();

              const response = await axios.delete(
                `${API_URL}/api/reports/${report.id}`,
                authConfig
              );

              if (!response.data?.success) {
                throw new Error(
                  response.data?.message || 'Could not delete report.'
                );
              }

              setReports((current) =>
                current.filter((item) => item.id !== report.id)
              );

              if (editingId === report.id) {
                setEditingId(null);
              }

              Alert.alert(
                'Deleted',
                'Your report has been deleted.'
              );
            } catch (error) {
              Alert.alert(
                'Delete Failed',
                axios.isAxiosError(error)
                  ? error.response?.data?.message ||
                      'Could not connect to the server.'
                  : error instanceof Error
                    ? error.message
                    : 'Could not delete the report.'
              );
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  };

  const visibleReports = reports.filter((report) => {
    if (statusFilter === 'All') return true;

    if (statusFilter === 'Resolved') {
      return report.status === 'Resolved';
    }

    return report.status !== 'Resolved';
  });

  const statusOptions = ['All', 'Active', 'Resolved'];

  const changeField = <K extends keyof EditFields>(
    field: K,
    value: EditFields[K]
  ) => {
    setEditFields((current) => ({
      ...current,
      [field]: value,
    }));
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.background }}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          padding: 20,
          paddingBottom: 40,
        }}
      >
        <Text
          className="text-3xl font-extrabold"
          style={{ color: C.purple, marginBottom: 6 }}
        >
          My Reports
        </Text>

        <Text style={{ color: C.muted, marginBottom: 20 }}>
          Manage your lost and found item reports.
        </Text>

        <Button
          className="mb-4 rounded-xl border-0"
          style={{ backgroundColor: C.yellow }}
          onPress={() => router.push('/report')}
        >
          <Text className="font-bold" style={{ color: C.purple }}>
            + Report an Item
          </Text>
        </Button>

        <Button
          className="mb-5 rounded-xl border-0"
          style={{ backgroundColor: C.purple }}
          onPress={loadReports}
          disabled={loading || saving}
        >
          <Text className="font-bold" style={{ color: C.white }}>
            ↻ Refresh Reports
          </Text>
        </Button>

        {loading ? (
          <View style={{ padding: 35, alignItems: 'center' }}>
            <ActivityIndicator size="large" color={C.purple} />

            <Text style={{ color: C.muted, marginTop: 12 }}>
              Loading your reports...
            </Text>
          </View>
        ) : reports.length === 0 ? (
          <View
            className="items-center rounded-2xl p-6"
            style={{ backgroundColor: C.white }}
          >
            <Text className="mb-2 text-2xl">📋</Text>

            <Text
              className="text-lg font-bold"
              style={{ color: C.purple }}
            >
              No Reports Yet
            </Text>

            <Text
              className="mt-2 text-center"
              style={{ color: C.muted }}
            >
              Your reports from the server will appear here.
            </Text>
          </View>
        ) : (
          <>
            <View
              className="mb-5 rounded-2xl border p-4"
              style={{
                backgroundColor: C.light,
                borderColor: C.border,
              }}
            >
              <Text
                className="mb-3 font-extrabold"
                style={{ color: C.purple }}
              >
                Filter Reports
              </Text>

              <View className="flex-row flex-wrap gap-2">
                {statusOptions.map((option) => (
                  <Button
                    key={option}
                    size="sm"
                    className="rounded-xl border-0"
                    style={{
                      backgroundColor:
                        statusFilter === option
                          ? C.purple
                          : C.white,
                    }}
                    onPress={() => setStatusFilter(option)}
                  >
                    <Text
                      className="font-bold"
                      style={{
                        color:
                          statusFilter === option
                            ? C.white
                            : C.purple,
                      }}
                    >
                      {option}
                    </Text>
                  </Button>
                ))}
              </View>
            </View>

            <Text
              className="mb-3 font-bold"
              style={{ color: C.purple }}
            >
              Total reports: {reports.length}
            </Text>

            {visibleReports.length === 0 ? (
              <View
                className="items-center rounded-2xl p-5"
                style={{ backgroundColor: C.white }}
              >
                <Text style={{ color: C.muted }}>
                  No {statusFilter.toLowerCase()} reports.
                </Text>
              </View>
            ) : (
              visibleReports.map((report) => {
                const isResolved = report.status === 'Resolved';
                const isEditing = editingId === report.id;

                return (
                  <View
                    key={report.id}
                    className="mb-4 rounded-2xl p-4"
                    style={{
                      backgroundColor: C.white,
                      borderWidth: 1,
                      borderColor: isResolved ? C.blue : C.border,
                    }}
                  >
                    <View className="mb-3 flex-row items-center justify-between">
                      <Text
                        className="text-xs font-extrabold"
                        style={{
                          color: C.purple,
                          backgroundColor: C.light,
                          paddingHorizontal: 10,
                          paddingVertical: 5,
                          borderRadius: 8,
                        }}
                      >
                        {report.type}
                      </Text>

                      <Text
                        className="text-xs font-extrabold"
                        style={{
                          color: isResolved ? C.blue : C.purple,
                          backgroundColor: isResolved
                            ? C.blueLight
                            : C.light,
                          paddingHorizontal: 10,
                          paddingVertical: 5,
                          borderRadius: 8,
                        }}
                      >
                        {isResolved ? '✓ Resolved' : '● Active'}
                      </Text>
                    </View>

                    {isEditing ? (
                      <>
                        <Text
                          className="mb-2 font-bold"
                          style={{ color: C.purple }}
                        >
                          Report Type
                        </Text>

                        <View className="mb-3 flex-row gap-2">
                          {(['Lost', 'Found'] as const).map((type) => (
                            <Button
                              key={type}
                              className="flex-1 rounded-xl border-0"
                              style={{
                                backgroundColor:
                                  editFields.type === type
                                    ? C.purple
                                    : C.light,
                              }}
                              onPress={() =>
                                changeField('type', type)
                              }
                            >
                              <Text
                                className="font-bold"
                                style={{
                                  color:
                                    editFields.type === type
                                      ? C.white
                                      : C.purple,
                                }}
                              >
                                {type}
                              </Text>
                            </Button>
                          ))}
                        </View>

                        <TextInput
                          value={editFields.itemName}
                          onChangeText={(v) =>
                            changeField('itemName', v)
                          }
                          placeholder="Item name"
                          placeholderTextColor={C.muted}
                          style={inputStyle}
                        />

                        <TextInput
                          value={editFields.category}
                          onChangeText={(v) =>
                            changeField('category', v)
                          }
                          placeholder="Category"
                          placeholderTextColor={C.muted}
                          style={inputStyle}
                        />

                        <TextInput
                          value={editFields.location}
                          onChangeText={(v) =>
                            changeField('location', v)
                          }
                          placeholder="Location"
                          placeholderTextColor={C.muted}
                          style={inputStyle}
                        />

                        <TextInput
                          value={editFields.date}
                          onChangeText={(v) =>
                            changeField('date', v)
                          }
                          placeholder="Date"
                          placeholderTextColor={C.muted}
                          style={inputStyle}
                        />

                        <TextInput
                          value={editFields.description}
                          onChangeText={(v) =>
                            changeField('description', v)
                          }
                          placeholder="Description"
                          placeholderTextColor={C.muted}
                          multiline
                          textAlignVertical="top"
                          style={[
                            inputStyle,
                            { minHeight: 100 },
                          ]}
                        />

                        <Button
                          className="mb-2 rounded-xl border-0"
                          style={{ backgroundColor: C.blue }}
                          disabled={saving}
                          onPress={() => saveEdit(report)}
                        >
                          <Text
                            className="font-bold"
                            style={{ color: C.white }}
                          >
                            {saving ? 'Saving...' : '✓ Save Changes'}
                          </Text>
                        </Button>

                        <Button
                          className="rounded-xl border-0"
                          style={{ backgroundColor: C.light }}
                          disabled={saving}
                          onPress={() => setEditingId(null)}
                        >
                          <Text
                            className="font-bold"
                            style={{ color: C.purple }}
                          >
                            Cancel Editing
                          </Text>
                        </Button>
                      </>
                    ) : (
                      <>
                        <Text
                          className="mb-1 text-xl font-extrabold"
                          style={{ color: C.dark }}
                        >
                          {report.itemName}
                        </Text>

                        <Text
                          className="mb-1"
                          style={{ color: C.muted }}
                        >
                          Category: {report.category}
                        </Text>

                        <Text
                          className="mb-2"
                          style={{ color: C.muted }}
                        >
                          📍 {report.location}
                        </Text>

                        <Text
                          className="mb-2"
                          style={{ color: C.muted }}
                        >
                          Date: {report.date}
                        </Text>

                        <Text
                          className="mb-4"
                          style={{ color: C.muted }}
                        >
                          {report.description}
                        </Text>

                        <Button
                          className="mb-2 rounded-xl border-0"
                          style={{
                            backgroundColor: isResolved
                              ? C.purple
                              : C.blue,
                          }}
                          disabled={saving}
                          onPress={() => updateStatus(report)}
                        >
                          <Text
                            className="font-bold"
                            style={{ color: C.white }}
                          >
                            {saving
                              ? 'Please wait...'
                              : isResolved
                                ? '↻ Reopen Report'
                                : '✓ Mark as Resolved'}
                          </Text>
                        </Button>

                        <Button
                          className="mb-2 rounded-xl border-0"
                          style={{ backgroundColor: C.yellow }}
                          disabled={saving}
                          onPress={() => startEditing(report)}
                        >
                          <Text
                            className="font-bold"
                            style={{ color: C.purple }}
                          >
                            ✎ Edit Report
                          </Text>
                        </Button>

                        <Button
                          className="rounded-xl border-0"
                          style={{ backgroundColor: C.blueLight }}
                          disabled={saving}
                          onPress={() => deleteReport(report)}
                        >
                          <Text
                            className="font-bold"
                            style={{ color: C.blueDeep }}
                          >
                            🗑️ Delete Report
                          </Text>
                        </Button>
                      </>
                    )}
                  </View>
                );
              })
            )}
          </>
        )}

        <Button
          className="mt-2 rounded-xl border-0"
          style={{ backgroundColor: C.purple }}
          onPress={() => router.back()}
        >
          <Text className="font-bold" style={{ color: C.white }}>
            ← Back to Home
          </Text>
        </Button>
      </ScrollView>
    </View>
  );
}
