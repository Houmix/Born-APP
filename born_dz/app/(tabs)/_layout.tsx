import { Tabs, Stack } from 'expo-router';
import { LanguageProvider } from "@/contexts/LanguageContext";

export default function TabLayout() {
    return (
        <LanguageProvider>
        <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="choice" />
            <Stack.Screen name="menu" />
            <Stack.Screen name="cart" />
            <Stack.Screen name="identification" />
            <Stack.Screen name="order" />
        </Stack>
        </LanguageProvider>

    )
}