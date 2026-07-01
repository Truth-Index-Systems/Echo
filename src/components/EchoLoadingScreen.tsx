import { useEffect, useRef } from "react";
import {
  Animated,
  Dimensions,
  Image,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle } from "react-native-svg";

import { colors } from "../theme/colors";

const { width, height } = Dimensions.get("window");

const stars = Array.from({ length: 46 }).map((_, index) => ({
  id: `star-${index}`,
  x: ((index * 73) % 100) / 100,
  y: ((index * 131) % 100) / 100,
  r: 0.7 + ((index * 17) % 18) / 10,
  opacity: 0.12 + ((index * 29) % 55) / 100,
}));

type Props = {
  ready?: boolean;
};

export function EchoLoadingScreen({ ready = false }: Props) {
  const pulse = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1550,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1550,
          useNativeDriver: true,
        }),
      ])
    );

    const riseLoop = Animated.loop(
      Animated.timing(rise, {
        toValue: 1,
        duration: 5200,
        useNativeDriver: true,
      })
    );

    pulseLoop.start();
    riseLoop.start();

    return () => {
      pulseLoop.stop();
      riseLoop.stop();
    };
  }, [pulse, rise]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1.06] });
  const glowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.34, 0.78] });
  const translateY = rise.interpolate({ inputRange: [0, 1], outputRange: [10, -10] });

  return (
    <View style={styles.screen}>
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Circle cx={width * 0.5} cy={height * 0.42} r={width * 0.92} fill="#0A2FFF" opacity={0.06} />
        <Circle cx={width * 0.52} cy={height * 0.34} r={width * 0.56} fill="#8A5CFF" opacity={0.045} />
        <Circle cx={width * 0.47} cy={height * 0.62} r={width * 0.48} fill="#FF52C8" opacity={0.025} />
        {stars.map((star) => (
          <Circle
            key={star.id}
            cx={star.x * width}
            cy={star.y * height}
            r={star.r}
            fill="#FFFFFF"
            opacity={star.opacity}
          />
        ))}
      </Svg>

      <Animated.View style={[styles.logoStage, { transform: [{ translateY }, { scale }] }]}> 
        <Animated.View style={[styles.logoGlow, { opacity: glowOpacity }]} />
        <Image source={require("../../assets/images/echo-logo.png")} style={styles.logo} resizeMode="contain" />
      </Animated.View>

      <Text style={styles.wordmark}>E C H O</Text>
      <Text style={styles.status}>{ready ? "Memory restored" : "Restoring your memory..."}</Text>

      <View style={styles.loadingTrack}>
        <LinearGradient
          colors={[colors.electricBlue, colors.neuralPurple, colors.memoryPink]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.loadingFill, ready && styles.loadingFillReady]}
        />
      </View>

      <Text style={styles.loadingText}>{ready ? "Ready" : "Loading..."}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#000000",
  },
  logoStage: {
    width: 220,
    height: 220,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 26,
  },
  logoGlow: {
    position: "absolute",
    width: 245,
    height: 245,
    borderRadius: 130,
    backgroundColor: "rgba(91,86,255,0.26)",
    shadowColor: "#8A5CFF",
    shadowOpacity: 1,
    shadowRadius: 42,
    shadowOffset: { width: 0, height: 0 },
    elevation: 24,
  },
  logo: {
    width: 210,
    height: 210,
  },
  wordmark: {
    color: colors.white,
    fontSize: 38,
    fontWeight: "300",
    letterSpacing: 17,
    marginRight: -17,
  },
  status: {
    color: colors.neuralPurple,
    fontSize: 20,
    fontWeight: "900",
    marginTop: 30,
  },
  loadingTrack: {
    width: Math.min(340, width * 0.72),
    height: 7,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: "rgba(185,199,255,0.11)",
    marginTop: 72,
  },
  loadingFill: {
    width: "74%",
    height: "100%",
    borderRadius: 999,
  },
  loadingFillReady: {
    width: "100%",
  },
  loadingText: {
    color: "rgba(185,199,255,0.72)",
    fontSize: 16,
    fontWeight: "800",
    marginTop: 24,
    letterSpacing: 0.4,
  },
});
