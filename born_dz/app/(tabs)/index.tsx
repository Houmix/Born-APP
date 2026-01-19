import { View, StyleSheet, TouchableOpacity, Dimensions, Text, Image } from "react-native";
import { useRouter } from "expo-router";

export default function WelcomeScreen() {
  const router = useRouter();

  const handleScreenTouch = () => {
    // Rediriger vers la page de choix (identifier/commander)
    router.push("/choice");
  };

  return (
    <TouchableOpacity 
      style={styles.container} 
      onPress={handleScreenTouch}
      activeOpacity={1}
    >
      <Image
        style={styles.backgroundImage}
        source={require('@/assets/images/welcome.png')}
        resizeMode="cover"
      />
      
      {/* Texte indicatif (optionnel) */}
      <View style={styles.overlay}>
        <Text style={styles.touchText}>Touchez l'écran pour commencer</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  backgroundImage: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
  },
  overlay: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  touchText: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 10,
    opacity: 0.8,
  },
});