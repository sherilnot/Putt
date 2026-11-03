import React from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '../../src/store/authStore';
import { colors, fonts, gradients, radius } from '../../src/theme';
import { BrandMark, Wordmark } from '../../src/components/brand/BrandMark';
import { Appear } from '../../src/components/ui/Motion';
import { Screen, SectionTitle } from '../../src/components/ui/Screen';
import { Button } from '../../src/components/ui/Button';
import { Card } from '../../src/components/ui/Card';
import { Icon, IconName } from '../../src/components/ui/Icon';
import { Txt } from '../../src/components/ui/Txt';

const HOW: { icon: IconName; title: string; text: string }[] = [
  { icon: 'wallet', title: 'Pick a plan', text: '1, 2 or 3 meals a day. Pay the mess and the manager confirms.' },
  { icon: 'bowl', title: 'Choose by Thursday', text: "Pick next week's dishes and a pickup time for each day." },
  { icon: 'bag', title: 'Collect fresh', text: "We'll notify you when your meals are ready at the mess." },
];

export default function Profile() {
  const router = useRouter();
  const { user, logout } = useAuthStore();

  const signOut = () =>
    Alert.alert('Sign out?', '', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/(auth)/login');
        },
      },
    ]);

  const initials = (user?.name || 'PK')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <Screen>
      <Appear style={styles.header}>
        <LinearGradient colors={gradients.gold} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.ring}>
          <View style={styles.avatar}>
            <Txt variant="title" color={colors.textOnDark}>
              {initials}
            </Txt>
          </View>
        </LinearGradient>
        <Txt variant="title" style={{ marginTop: 14 }}>
          {user?.name}
        </Txt>
        <Txt variant="body" color={colors.textSoft}>
          {user?.email}
        </Txt>
      </Appear>

      <Appear index={1}>
        <Card>
          <View style={styles.infoRow}>
            <Icon name="mail" size={19} color={colors.textSoft} />
            <Txt variant="body" style={{ flex: 1 }}>
              {user?.email}
            </Txt>
          </View>
          <View style={styles.sep} />
          <View style={styles.infoRow}>
            <Icon name="phone" size={19} color={colors.textSoft} />
            <Txt variant="body" style={{ flex: 1 }} color={user?.phone ? colors.text : colors.textMuted}>
              {user?.phone || 'No phone number added'}
            </Txt>
          </View>
        </Card>
      </Appear>

      <SectionTitle title="How it works" />
      {HOW.map((h, i) => (
        <Appear key={h.title} index={i + 2}>
          <View style={styles.how}>
            <View style={styles.howIcon}>
              <Icon name={h.icon} size={20} color={colors.brand} />
            </View>
            <View style={{ flex: 1 }}>
              <Txt variant="bodyStrong">{h.title}</Txt>
              <Txt variant="caption" color={colors.textSoft}>
                {h.text}
              </Txt>
            </View>
          </View>
        </Appear>
      ))}

      <Appear index={6}>
        <Button title="Sign out" icon="logout" variant="outline" onPress={signOut} style={{ marginTop: 22 }} />
        <View style={styles.footer}>
          <BrandMark size={28} />
          <Wordmark size={15} />
        </View>
        <Txt variant="caption" color={colors.textMuted} align="center" style={{ fontFamily: fonts.medium }}>
          Version 1.0
        </Txt>
      </Appear>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', marginTop: 16, marginBottom: 22 },
  ring: { width: 100, height: 100, borderRadius: 50, padding: 3 },
  avatar: { flex: 1, borderRadius: 48, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: colors.bg },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  sep: { height: 1, backgroundColor: colors.lineSoft, marginVertical: 10 },
  how: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 14 },
  howIcon: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 26, marginBottom: 4 },
});
