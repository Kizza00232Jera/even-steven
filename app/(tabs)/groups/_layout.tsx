import { Stack } from 'expo-router';

export default function GroupsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[id]/index" />
      <Stack.Screen name="[id]/settings" />
      <Stack.Screen name="[id]/expense-detail" />
      <Stack.Screen name="[id]/members" />
      <Stack.Screen name="[id]/add-expense" options={{ presentation: 'modal' }} />
      <Stack.Screen name="[id]/edit-expense" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
