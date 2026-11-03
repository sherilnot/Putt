import React, { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, TextInput, TextInputProps, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radius } from '../../theme';
import { Icon, IconName } from './Icon';
import { PressableScale } from './PressableScale';
import { Txt } from './Txt';
import { Appear } from './Motion';

/** Page shell: safe-area aware, rice-paper background, optional pull-to-refresh. */
export const Screen: React.FC<{
  children: React.ReactNode;
  onRefresh?: () => Promise<void> | void;
  scroll?: boolean;
  contentStyle?: ViewStyle;
}> = ({ children, onRefresh, scroll = true, contentStyle }) => {
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);

  if (!scroll) {
    return <View style={[styles.root, { paddingTop: insets.top + 8 }, contentStyle]}>{children}</View>;
  }
  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 8 }, contentStyle]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            tintColor={colors.brand}
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await onRefresh();
              setRefreshing(false);
            }}
          />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  );
};

/** Large editorial page title with an optional overline and right-hand accessory. */
export const ScreenHeader: React.FC<{ overline?: string; title: string; subtitle?: string; right?: React.ReactNode }> = ({
  overline,
  title,
  subtitle,
  right,
}) => (
  <Appear style={styles.header}>
    <View style={{ flex: 1 }}>
      {overline && (
        <Txt variant="overline" color={colors.brand} style={{ marginBottom: 6 }}>
          {overline}
        </Txt>
      )}
      <Txt variant="title">{title}</Txt>
      {subtitle && (
        <Txt variant="body" color={colors.textSoft} style={{ marginTop: 4 }}>
          {subtitle}
        </Txt>
      )}
    </View>
    {right}
  </Appear>
);

export const SectionTitle: React.FC<{ title: string; action?: string; onAction?: () => void }> = ({ title, action, onAction }) => (
  <View style={styles.section}>
    <Txt variant="heading">{title}</Txt>
    {action && (
      <PressableScale onPress={onAction} style={styles.sectionAction}>
        <Txt variant="label" color={colors.brand}>
          {action}
        </Txt>
        <Icon name="arrowRight" size={15} color={colors.brand} />
      </PressableScale>
    )}
  </View>
);

/** Round icon button (header actions). */
export const IconButton: React.FC<{ icon: IconName; onPress: () => void; tone?: 'light' | 'dark' }> = ({ icon, onPress, tone = 'light' }) => (
  <PressableScale onPress={onPress} style={[styles.iconBtn, tone === 'dark' && { backgroundColor: colors.ink }]}>
    <Icon name={icon} size={20} color={tone === 'dark' ? colors.textOnDark : colors.ink} />
  </PressableScale>
);

/** Text field with a leading icon; the border warms to the brand colour on focus. */
export const Field: React.FC<TextInputProps & { label: string; icon: IconName; secureToggle?: boolean }> = ({
  label,
  icon,
  secureToggle,
  secureTextEntry,
  style,
  ...rest
}) => {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(Boolean(secureTextEntry));
  return (
    <View style={{ marginBottom: 14 }}>
      <Txt variant="label" color={colors.textSoft} style={{ marginBottom: 7 }}>
        {label}
      </Txt>
      <View style={[styles.field, focused && styles.fieldFocused]}>
        <Icon name={icon} size={19} color={focused ? colors.brand : colors.textMuted} />
        <TextInput
          {...rest}
          secureTextEntry={hidden}
          placeholderTextColor={colors.textMuted}
          onFocus={(e) => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
          style={[styles.input, style]}
        />
        {secureToggle && (
          <PressableScale haptic={false} onPress={() => setHidden((h) => !h)} hitSlop={10}>
            <Icon name={hidden ? 'eye' : 'eyeOff'} size={19} color={colors.textMuted} />
          </PressableScale>
        )}
      </View>
    </View>
  );
};

/** Friendly empty state with an icon medallion. */
export const EmptyState: React.FC<{ icon: IconName; title: string; text: string; action?: React.ReactNode }> = ({
  icon,
  title,
  text,
  action,
}) => (
  <Appear style={styles.empty}>
    <View style={styles.medallion}>
      <Icon name={icon} size={30} color={colors.brand} />
    </View>
    <Txt variant="heading" align="center">
      {title}
    </Txt>
    <Txt variant="body" color={colors.textSoft} align="center" style={{ marginTop: 6, marginBottom: 18 }}>
      {text}
    </Txt>
    {action}
  </Appear>
);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 22, marginTop: 8, gap: 12 },
  section: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 26, marginBottom: 12 },
  sectionAction: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.lineSoft,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1.4,
    borderColor: colors.line,
    paddingHorizontal: 14,
    height: 54,
  },
  fieldFocused: { borderColor: colors.brand, backgroundColor: '#FFFBF6' },
  input: { flex: 1, fontFamily: fonts.medium, fontSize: 15, color: colors.text, height: '100%' },
  empty: { alignItems: 'center', paddingVertical: 36, paddingHorizontal: 20 },
  medallion: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
});
