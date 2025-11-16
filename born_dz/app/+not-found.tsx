import { View, StyleSheet } from 'react-native';
import { Link, Tabs } from 'expo-router';

export default function NotFoundScreen() {
  return (
    <>
      <Tabs.Screen options={{ title: 'Oops! Not Found' }} />
      <View style={styles.container}>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF6F6',
    justifyContent: 'center',
    alignItems: 'center',
  },

  button: {
    fontSize: 20,
    textDecorationLine: 'underline',
    color: '#fff',
  },
});