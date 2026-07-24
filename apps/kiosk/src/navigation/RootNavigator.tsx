import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from '@/navigation/types';
import { WelcomeScreen } from '@/screens/WelcomeScreen';
import { DirectoryScreen } from '@/screens/DirectoryScreen';
import { MenuScreen } from '@/screens/MenuScreen';
import { ItemDetailModal } from '@/screens/ItemDetailModal';
import { CheckoutScreen } from '@/screens/CheckoutScreen';
import { ThankYouScreen } from '@/screens/ThankYouScreen';
import { colors } from '@/theme/colors';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Welcome"
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: 'slide_from_right',
        gestureEnabled: false,
      }}
    >
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="Directory" component={DirectoryScreen} />
      <Stack.Screen name="Menu" component={MenuScreen} />
      <Stack.Screen
        name="ItemDetail"
        component={ItemDetailModal}
        options={{
          presentation: 'transparentModal',
          animation: 'fade',
          contentStyle: { backgroundColor: 'transparent' },
        }}
      />
      <Stack.Screen name="Checkout" component={CheckoutScreen} />
      <Stack.Screen
        name="ThankYou"
        component={ThankYouScreen}
        options={{ gestureEnabled: false }}
      />
    </Stack.Navigator>
  );
}
