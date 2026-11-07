
import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { useRouter } from 'expo-router';

const API_URL = 'https://findback-lostandfound.onrender.com';
const USER_STORAGE_KEY = 'findback_user';
const TOKEN_STORAGE_KEY = 'findback_token';

export default function ReportScreen() {
  const router = useRouter();

  const [type, setType] = useState<'Lost' | 'Found'>('Lost');
  const [itemName, setItemName] = useState('');
  const [category, setCategory] = useState('Other');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [date, setDate] = useState('');
  const [loading, setLoading] = useState(false);

  const categories = [
    'Electronics',
    'Documents',
    'Accessories',
    'Pets',
    'Other',
  ];

  const submitReport = async () => {
    if (
      !itemName.trim() ||
      !description.trim() ||
      !location.trim() ||
      !date.trim()
    ) {
      Alert.alert(
        'Missing Information',
        'Please fill in all the fields.'
      );
      return;
    }

    if (loading) return;

    setLoading(true);

    try {
      const [storedUser, token] = await Promise.all([
        AsyncStorage.getItem(USER_STORAGE_KEY),
        AsyncStorage.getItem(TOKEN_STORAGE_KEY),
      ]);

      if (!storedUser || !token) {
        Alert.alert(
          'Login Required',
          'Please log in before submitting a report.',
          [
            {
              text: 'OK',
              onPress: () => router.replace('/login'),
            },
          ]
        );
        return;
      }

      let user;

      try {
        user = JSON.parse(storedUser);
      } catch {
        Alert.alert(
          'Login Required',
          'Your saved login information is invalid. Please log in again.',
          [
            {
              text: 'OK',
              onPress: () => router.replace('/login'),
            },
          ]
        );
        return;
      }

      if (!user?.id && !user?._id) {
        Alert.alert(
          'Login Required',
          'User information is missing. Please log in again.',
          [
            {
              text: 'OK',
              onPress: () => router.replace('/login'),
            },
          ]
        );
        return;
      }

      const response = await axios.post(
        `${API_URL}/api/reports`,
        {
          type,
          itemName: itemName.trim(),
          category,
          description: description.trim(),
          location: location.trim(),
          date: date.trim(),
        },
        {
          timeout: 15000,
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.data?.success) {
        Alert.alert(
          'Report Submitted!',
          'Your report has been saved successfully.',
          [
            {
              text: 'OK',
              onPress: () => router.replace('/'),
            },
          ]
        );

        setItemName('');
        setCategory('Other');
        setDescription('');
        setLocation('');
        setDate('');
        setType('Lost');
      } else {
        Alert.alert(
          'Submission Failed',
          response.data?.message || 'Please try again.'
        );
      }
    } catch (error) {
      console.error(
        'Report submission error:',
        axios.isAxiosError(error)
          ? error.response?.data || error.message
          : error
      );

      if (axios.isAxiosError(error)) {
        const status = error.response?.status;

        if (status === 401) {
          Alert.alert(
            'Session Expired',
            'Please log in again to submit your report.',
            [
              {
                text: 'OK',
                onPress: () => router.replace('/login'),
              },
            ]
          );
        } else {
          Alert.alert(
            'Submission Failed',
            error.response?.data?.message ||
              'Could not submit the report. Check your internet connection and backend server.'
          );
        }
      } else {
        Alert.alert(
          'Error',
          'Something went wrong. Please try again.'
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Report an Item</Text>
        <Text style={styles.subtitle}>
          Help someone find what they lost.
        </Text>

        <Text style={styles.label}>Report Type</Text>

        <View style={styles.typeRow}>
          <TouchableOpacity
            style={[
              styles.typeButton,
              type === 'Lost' && styles.lostSelected,
            ]}
            onPress={() => setType('Lost')}
          >
            <Text
              style={[
                styles.typeText,
                type === 'Lost' && styles.selectedText,
              ]}
            >
              Lost Item
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.typeButton,
              type === 'Found' && styles.foundSelected,
            ]}
            onPress={() => setType('Found')}
          >
            <Text
              style={[
                styles.typeText,
                type === 'Found' && styles.selectedText,
              ]}
            >
              Found Item
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>Item Name *</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Samsung mobile phone"
          placeholderTextColor="#8A8A98"
          value={itemName}
          onChangeText={setItemName}
          maxLength={100}
        />

        <Text style={styles.label}>Category</Text>
        <View style={styles.categoryContainer}>
          {categories.map((item) => (
            <TouchableOpacity
              key={item}
              style={[
                styles.categoryChip,
                category === item && styles.categorySelected,
              ]}
              onPress={() => setCategory(item)}
            >
              <Text
                style={[
                  styles.categoryText,
                  category === item && styles.categorySelectedText,
                ]}
              >
                {item}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Description *</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          placeholder="Describe the item, colour, brand, or identifying details..."
          placeholderTextColor="#8A8A98"
          value={description}
          onChangeText={setDescription}
          multiline
          textAlignVertical="top"
          maxLength={1000}
        />

        <Text style={styles.label}>Location *</Text>
        <TextInput
          style={styles.input}
          placeholder="Where was it lost or found?"
          placeholderTextColor="#8A8A98"
          value={location}
          onChangeText={setLocation}
          maxLength={200}
        />

        <Text style={styles.label}>Date *</Text>
        <TextInput
          style={styles.input}
          placeholder="YYYY-MM-DD (e.g. 2026-10-28)"
          placeholderTextColor="#8A8A98"
          value={date}
          onChangeText={setDate}
          maxLength={10}
          keyboardType="numbers-and-punctuation"
        />

        <TouchableOpacity
          style={[
            styles.submitButton,
            loading && styles.disabledButton,
          ]}
          onPress={submitReport}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.submitText}>
              Submit {type} Report
            </Text>
          )}
        </TouchableOpacity>

        <Text style={styles.note}>
          * Required fields. Your report will be submitted to FindBack.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F7F6FC',
  },
  container: {
    padding: 22,
    paddingBottom: 40,
  },
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: 18,
    paddingVertical: 6,
  },
  backText: {
    color: '#6254A6',
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#25213D',
  },
  subtitle: {
    color: '#777487',
    fontSize: 14,
    marginTop: 7,
    marginBottom: 25,
  },
  label: {
    fontSize: 15,
    fontWeight: '700',
    color: '#302B48',
    marginBottom: 9,
    marginTop: 15,
  },
  typeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  typeButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4E0EF',
  },
  lostSelected: {
    backgroundColor: '#6254A6',
    borderColor: '#6254A6',
  },
  foundSelected: {
    backgroundColor: '#3979C3',
    borderColor: '#3979C3',
  },
  typeText: {
    color: '#5D5870',
    fontWeight: '700',
  },
  selectedText: {
    color: '#FFFFFF',
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E4E0EF',
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: '#28243D',
  },
  multiline: {
    minHeight: 115,
    paddingTop: 14,
  },
  categoryContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
  },
  categoryChip: {
    borderRadius: 20,
    paddingVertical: 9,
    paddingHorizontal: 13,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4E0EF',
  },
  categorySelected: {
    backgroundColor: '#E8E3FF',
    borderColor: '#6254A6',
  },
  categoryText: {
    color: '#5D5870',
    fontSize: 13,
    fontWeight: '600',
  },
  categorySelectedText: {
    color: '#51428F',
  },
  submitButton: {
    backgroundColor: '#6254A6',
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    marginTop: 28,
    minHeight: 54,
  },
  disabledButton: {
    opacity: 0.65,
  },
  submitText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  note: {
    textAlign: 'center',
    fontSize: 12,
    color: '#858195',
    marginTop: 15,
    lineHeight: 18,
  },
});
