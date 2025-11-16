import { Tabs, Stack } from 'expo-router';
export default function TabLayout() {
    return (
        <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="menu" />
            <Stack.Screen name="cart" />
            <Stack.Screen name="identification" />
            <Stack.Screen name="order" />
        </Stack>

    )
}