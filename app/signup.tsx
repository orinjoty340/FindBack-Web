
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import axios from 'axios';
import { Text } from '@/components/ui/text';
import { useRouter } from 'expo-router';

const API_URL = 'https://findback-lostandfound.onrender.com';

export default function SignupScreen() {
  const router = useRouter();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignup = async () => {
    if (
      !name.trim() ||
      !email.trim() ||
      !password ||
      !confirmPassword
    ) {
      Alert.alert('Missing information', 'Please fill in all fields.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      Alert.alert('Invalid email', 'Please enter a valid email address.');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Weak password', 'Password must be at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Password mismatch', 'Both passwords must match.');
      return;
    }

    if (loading) return;

    try {
      setLoading(true);

      const response = await axios.post(
        `${API_URL}/api/auth/signup`,
        {
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password,
        },
        { timeout: 15000 }
      );

      if (!response.data?.success) {
        Alert.alert(
          'Signup Failed',
          response.data?.message || 'Unable to create account.'
        );
        return;
      }

      Alert.alert(
        'Signup Successful!',
        `Welcome to FindBack, ${response.data.user?.name || name}! Please log in to continue.`,
        [
          {
            text: 'Go to Login',
            onPress: () => router.replace('/login'),
          },
        ]
      );
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response) {
          Alert.alert(
            'Signup Failed',
            error.response.data?.message || 'Unable to create account.'
          );
        } else {
          Alert.alert(
            'Connection Error',
            'Cannot reach the server. Check your network, IP address and backend server.'
          );
        }
      } else {
        Alert.alert('Error', 'Something went wrong.');
      }
    } finally {
      setLoading(false);
    }
  };

  const fieldStyle = {
    borderWidth: 1 as const,
    borderColor: '#D9C6ED',
    borderRadius: 12,
    padding: 14,
    color: '#29163D',
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#E9DDF7' }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          padding: 24,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ alignItems: 'center', marginBottom: 26 }}>
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 22,
              backgroundColor: '#40205F',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
            }}
          >
            <Text
              style={{
                color: '#F4C84A',
                fontSize: 36,
                fontWeight: '900',
              }}
            >
              F
            </Text>
          </View>

          <Text
            style={{
              color: '#40205F',
              fontSize: 29,
              fontWeight: '900',
            }}
          >
            Create Account
          </Text>

          <Text
            style={{
              color: '#796B86',
              fontSize: 14,
              marginTop: 8,
              textAlign: 'center',
            }}
          >
            Join FindBack and help items find their way home.
          </Text>
        </View>

        <View
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 24,
            padding: 22,
          }}
        >
          <Text style={{ color: '#29163D', fontWeight: '700', marginBottom: 8 }}>
            Full Name
          </Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Enter your full name"
            placeholderTextColor="#998BA6"
            autoCapitalize="words"
            style={fieldStyle}
          />

          <Text style={{ color: '#29163D', fontWeight: '700', marginBottom: 8 }}>
            Email Address
          </Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="Enter your email"
            placeholderTextColor="#998BA6"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            style={fieldStyle}
          />

          <Text style={{ color: '#29163D', fontWeight: '700', marginBottom: 8 }}>
            Password
          </Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="At least 6 characters"
            placeholderTextColor="#998BA6"
            secureTextEntry
            style={fieldStyle}
          />

          <Text style={{ color: '#29163D', fontWeight: '700', marginBottom: 8 }}>
            Confirm Password
          </Text>
          <TextInput
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Enter password again"
            placeholderTextColor="#998BA6"
            secureTextEntry
            style={fieldStyle}
          />

          <TouchableOpacity
            onPress={handleSignup}
            disabled={loading}
            style={{
              backgroundColor: loading ? '#796B86' : '#40205F',
              padding: 16,
              borderRadius: 14,
              alignItems: 'center',
              marginTop: 6,
            }}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text
                style={{
                  color: '#FFFFFF',
                  fontSize: 16,
                  fontWeight: '800',
                }}
              >
                Create Account
              </Text>
            )}
          </TouchableOpacity>

          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'center',
              marginTop: 22,
              flexWrap: 'wrap',
            }}
          >
            <Text style={{ color: '#796B86' }}>
              Already have an account?{' '}
            </Text>

            <TouchableOpacity onPress={() => router.replace('/login')}>
              <Text style={{ color: '#40205F', fontWeight: '800' }}>
                Login
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          onPress={() => router.replace('/')}
          style={{
            alignItems: 'center',
            marginTop: 20,
            padding: 10,
          }}
        >
          <Text style={{ color: '#40205F', fontWeight: '700' }}>
            Continue as Guest
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
