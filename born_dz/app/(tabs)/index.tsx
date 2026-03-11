import { View, StyleSheet, TouchableOpacity, Dimensions, Text, Image } from "react-native";
import { useRouter } from "expo-router";
import { useKioskTheme } from "@/contexts/KioskThemeContext";
import { Video, ResizeMode } from "expo-av";
import { useRef } from "react";

export default function WelcomeScreen() {
  const router = useRouter();
  const theme = useKioskTheme();
  const videoRef = useRef(null);

  const handleScreenTouch = () => {
    router.push("/choice");
  };

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={handleScreenTouch}
      activeOpacity={1}
    >
      {/* Vidéo > Image/GIF > image par défaut */}
      {theme.screensaverVideoUrl ? (
        <Video
          ref={videoRef}
          source={{ uri: theme.screensaverVideoUrl }}
          style={styles.background}
          resizeMode={ResizeMode.COVER}
          isLooping
          shouldPlay
          isMuted
        />
      ) : theme.screensaverImageUrl ? (
        <Image
          style={styles.background}
          source={{ uri: theme.screensaverImageUrl }}
          resizeMode="cover"
        />
      ) : (
        <Image
          style={styles.background}
          source={require('@/assets/images/welcome.png')}
          resizeMode="cover"
        />
      )}

      {/* Indicateur "Toucher pour commencer" */}
      <View style={styles.overlay}>
        <View style={[styles.touchPill, { borderColor: theme.secondaryColor }]}>
          <Text style={[styles.touchText, { color: theme.secondaryColor }]}>
            Touchez l'écran pour commencer
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  background: {
    width,
    height,
    position: 'absolute',
  },
  overlay: {
    position: 'absolute',
    bottom: 60,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  touchPill: {
    borderWidth: 2,
    borderRadius: 50,
    paddingHorizontal: 40,
    paddingVertical: 18,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  touchText: {
    fontSize: 26,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 10,
  },
});
