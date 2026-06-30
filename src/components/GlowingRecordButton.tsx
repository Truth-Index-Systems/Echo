import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialIcons } from "@expo/vector-icons";
import { colors } from "../theme/colors";

type Props = {
  active?: boolean;
  disabled?: boolean;
  processing?: boolean;
  onPress?: () => void;
};

export default function GlowingRecordButton({
  active = false,
  disabled = false,
  processing = false,
  onPress,
}: Props) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.container,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      {/* Outer Aura */}
      <View
        style={[
          styles.aura,
          active && styles.auraActive,
        ]}
      />

      {/* Gradient Ring */}
      <LinearGradient
        colors={[
          colors.electricBlue,
          colors.neuralPurple,
          colors.memoryPink,
          colors.energyGold,
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.outerRing,
          active && styles.outerRingActive,
        ]}
      >
        {/* Inner Core */}
        <View
          style={[
            styles.inner,
            active && styles.innerActive,
          ]}
        >
          {processing ? (
            <ActivityIndicator size="large" color={colors.white} />
          ) : (
            <MaterialIcons
              name={active ? "stop" : "keyboard-voice"}
              size={56}
              color={active ? colors.energyGold : colors.white}
            />
          )}
        </View>
      </LinearGradient>
    </Pressable>
  );
}

const SIZE = 180;

const styles = StyleSheet.create({
  container: {
    width: SIZE,
    height: SIZE,
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center",
  },

  pressed: {
    transform: [{ scale: 0.97 }],
  },

  disabled: {
    opacity: 0.58,
  },

  aura: {
    position: "absolute",
    width: SIZE + 35,
    height: SIZE + 35,
    borderRadius: 999,
    backgroundColor: "rgba(38,216,255,0.10)",
  },

  auraActive: {
    backgroundColor: "rgba(255,82,200,0.18)",
  },

  outerRing: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    padding: 6,
    shadowColor: colors.neuralPurple,
    shadowOpacity: 0.8,
    shadowRadius: 30,
    elevation: 25,
  },

  outerRingActive: {
    shadowRadius: 42,
    elevation: 40,
  },

  inner: {
    flex: 1,
    borderRadius: 999,
    backgroundColor: colors.space900,
    justifyContent: "center",
    alignItems: "center",
  },

  innerActive: {
    backgroundColor: "#0D1033",
  },
});