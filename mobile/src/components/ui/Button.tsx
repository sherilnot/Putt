import React from 'react';
import { ActivityIndicator, StyleSheet, TextStyle, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fonts, gradients, radius, shadow } from '../../theme';
import { PressableScale } from './PressableScale';
import { Icon, IconName } from './Icon';
import { Txt } from './Txt';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

const HEIGHT = { sm: 40, md: 50, lg: 56 };

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  loading = false,
  disabled = false,
  style,
  textStyle,
}) => {
  const inactive = disabled || loading;
  const fg =
    variant === 'primary' || variant === 'secondary'
      ? colors.textOnDark
      : variant === 'danger'
        ? colors.chili
        : colors.ink;

  const content = (
    <View style={styles.row}>
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon && <Icon name={icon} size={size === 'sm' ? 16 : 19} color={fg} />}
          <Txt
            variant="label"
            color={fg}
            style={[{ fontFamily: fonts.bold, fontSize: size === 'sm' ? 13 : 15 }, textStyle]}
          >
            {title}
          </Txt>
        </>
      )}
    </View>
  );

  const frame: ViewStyle = { height: HEIGHT[size], borderRadius: radius.pill };

  return (
    <PressableScale
      onPress={onPress}
      disabled={inactive}
      style={[{ opacity: disabled ? 0.45 : 1 }, variant === 'primary' && shadow.soft, style]}
    >
      {variant === 'primary' ? (
        <LinearGradient
          colors={gradients.brand}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.base, frame]}
        >
          {content}
        </LinearGradient>
      ) : (
        <View
          style={[
            styles.base,
            frame,
            variant === 'secondary' && { backgroundColor: colors.ink },
            variant === 'outline' && styles.outline,
            variant === 'danger' && { backgroundColor: colors.chiliSoft },
          ]}
        >
          {content}
        </View>
      )}
    </PressableScale>
  );
};

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  outline: { borderWidth: 1.4, borderColor: colors.line, backgroundColor: colors.surface },
});
