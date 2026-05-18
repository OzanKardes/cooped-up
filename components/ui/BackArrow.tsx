import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Colors, Borders, Shadows, Typography } from '../../constants/theme';

export default function BackArrow({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.btn} onPress={onPress} activeOpacity={0.75}>
      <Text style={styles.arrow}>←</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 40, height: 40,
    borderWidth: Borders.widthHeavy,
    borderColor: Colors.black,
    borderRadius: Borders.radius,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
    flexShrink: 0,
    ...Shadows.sm,
  },
  arrow: {
    fontSize: 18,
    fontWeight: Typography.weights.black as any,
    color: Colors.navy,
  },
});
