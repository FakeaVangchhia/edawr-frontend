import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { OfflineError, riderLogin } from '../api';
import { API_URL } from '../config';
import { RiderSession } from '../types';

interface LoginScreenProps {
  onLogin: (session: RiderSession) => void;
}

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = phone.trim().length > 0 && pin.length >= 4 && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) {
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      onLogin(await riderLogin(phone.trim(), pin));
    } catch (err) {
      // A wrong PIN and an unreachable server are different problems with
      // different fixes, so they get different messages. The transport case is
      // `OfflineError` — `api.ts` converts every fetch rejection into one, so
      // testing for `TypeError` here (as this once did) could never match, and
      // the most useful diagnostic on the whole screen was unreachable: naming
      // the host is what tells a rider the build is pointed at the wrong
      // backend. The generic offline copy is also wrong here, since the login
      // screen does no retrying.
      setError(
        err instanceof OfflineError
          ? `Could not reach the server at ${API_URL}. Check your connection, or the app's backend URL.`
          : err instanceof Error
            ? err.message
            : 'Sign-in failed. Please try again.',
      );
      setPin('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <View style={styles.iconWrapper}>
              <Ionicons name="bicycle" size={36} color="#fff" />
            </View>
            <Text style={styles.title}>eDawr Delivery</Text>
            <Text style={styles.subtitle}>Sign in to start your shift</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Phone number</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="+919000000002"
              placeholderTextColor="#94a3b8"
              keyboardType="phone-pad"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!submitting}
              returnKeyType="next"
            />

            <Text style={[styles.label, styles.labelSpaced]}>PIN</Text>
            <TextInput
              style={styles.input}
              value={pin}
              onChangeText={setPin}
              placeholder="••••"
              placeholderTextColor="#94a3b8"
              keyboardType="number-pad"
              // The PIN is a credential: keep it off the screen and out of the
              // keyboard's learned-words store.
              secureTextEntry
              autoComplete="off"
              autoCorrect={false}
              editable={!submitting}
              returnKeyType="go"
              onSubmitEditing={handleSubmit}
            />

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={!canSubmit}
              activeOpacity={0.8}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitText}>Sign in</Text>
              )}
            </TouchableOpacity>

            <Text style={styles.helpText}>
              No PIN yet? Ask your manager to set one for your account.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#4169E1',
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    backgroundColor: '#f1f5f9',
  },
  header: {
    backgroundColor: '#4169E1',
    paddingTop: 48,
    paddingBottom: 40,
    alignItems: 'center',
    gap: 8,
  },
  iconWrapper: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.75)',
    fontWeight: '500',
  },
  card: {
    flex: 1,
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -20,
    paddingHorizontal: 24,
    paddingTop: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 8,
  },
  labelSpaced: {
    marginTop: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1e293b',
  },
  submitButton: {
    marginTop: 28,
    backgroundColor: '#4169E1',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  submitButtonDisabled: {
    backgroundColor: '#a5b4fc',
  },
  submitText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  errorText: {
    color: '#ef4444',
    marginTop: 16,
    fontSize: 14,
    lineHeight: 20,
  },
  helpText: {
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 20,
    fontSize: 13,
  },
});
