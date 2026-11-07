
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { Text } from '@/components/ui/text';
import { useRouter } from 'expo-router';

const API_URL = 'https://findback-lostandfound.onrender.com';
const USER_STORAGE_KEY = 'findback_user';
const TOKEN_STORAGE_KEY = 'findback_token';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert(
        'Missing information',
        'Please enter your email and password.'
      );
      return;
    }

    if (loading) return;

    try {
      setLoading(true);

      const response = await axios.post(
        `${API_URL}/api/auth/login`,
        {
          email: email.trim().toLowerCase(),
          password,
        },
        { timeout: 15000 }
      );

      const user = response.data?.user;
      const token = response.data?.token;

      if (!response.data?.success || !user?.id || !token) {
        Alert.alert(
          'Login Failed',
          'The server did not return valid user information or authentication token.'
        );
        return;
      }

      // Save user information and JWT token securely in app storage.
      await AsyncStorage.multiSet([
        [USER_STORAGE_KEY, JSON.stringify(user)],
        [TOKEN_STORAGE_KEY, token],
      ]);

      Alert.alert(
        'Login Successful',
        `Welcome back, ${user.name}!`,
        [
          {
            text: 'Continue',
            onPress: () => router.replace('/'),
          },
        ]
      );
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response) {
          Alert.alert(
            'Login Failed',
            error.response.data?.message || 'Unable to log in.'
          );
        } else {
          Alert.alert(
            'Connection Error',
            'Cannot reach the server. Check your network, IP address and backend server.'
          );
        }
      } else {
        Alert.alert(
          'Error',
          'Could not save login information. Please try again.'
        );
      }
    } finally {
      setLoading(false);
    }
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
        <View style={{ alignItems: 'center', marginBottom: 32 }}>
          <View
            style={{
              width: 78,
              height: 78,
              borderRadius: 24,
              backgroundColor: '#40205F',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 18,
            }}
          >
            <Text
              style={{
                color: '#F4C84A',
                fontSize: 38,
                fontWeight: '900',
              }}
            >
              F
            </Text>
          </View>

          <Text
            style={{
              color: '#40205F',
              fontSize: 30,
              fontWeight: '900',
            }}
          >
            Welcome Back!
          </Text>

          <Text
            style={{
              color: '#796B86',
              fontSize: 15,
              marginTop: 8,
            }}
          >
            Sign in to continue to FindBack
          </Text>
        </View>

        <View
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 24,
            padding: 22,
          }}
        >
          <Text
            style={{
              color: '#29163D',
              fontSize: 15,
              fontWeight: '700',
              marginBottom: 8,
            }}
          >
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
            style={{
              borderWidth: 1,
              borderColor: '#D9C6ED',
              borderRadius: 12,
              padding: 14,
              color: '#29163D',
              marginBottom: 18,
            }}
          />

          <Text
            style={{
              color: '#29163D',
              fontSize: 15,
              fontWeight: '700',
              marginBottom: 8,
            }}
          >
            Password
          </Text>

          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Enter your password"
            placeholderTextColor="#998BA6"
            secureTextEntry
            style={{
              borderWidth: 1,
              borderColor: '#D9C6ED',
              borderRadius: 12,
              padding: 14,
              color: '#29163D',
              marginBottom: 22,
            }}
          />

          <TouchableOpacity
            onPress={handleLogin}
            disabled={loading}
            style={{
              backgroundColor: loading ? '#796B86' : '#40205F',
              padding: 16,
              borderRadius: 14,
              alignItems: 'center',
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
                Login
              </Text>
            )}
          </TouchableOpacity>

          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'center',
              marginTop: 22,
            }}
          >
            <Text style={{ color: '#796B86' }}>
              Don't have an account?{' '}
            </Text>

            <TouchableOpacity
              onPress={() => router.push('/signup')}
            >
              <Text
                style={{ color: '#40205F', fontWeight: '800' }}
              >
                Sign Up
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          onPress={() => router.replace('/')}
          style={{
            alignItems: 'center',
            marginTop: 22,
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
