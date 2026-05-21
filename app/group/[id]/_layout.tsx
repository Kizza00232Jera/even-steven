import { Stack } from 'expo-router';

export default function GroupDetailLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="add-expense" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
