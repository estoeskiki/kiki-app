import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from '@/navigation/types';
import { WelcomeScreen } from '@/screens/WelcomeScreen';
import { OrderTypeScreen } from '@/screens/OrderTypeScreen';
import { MenuScreen } from '@/screens/MenuScreen';
import { ItemDetailModal } from '@/screens/ItemDetailModal';
import { CartScreen } from '@/screens/CartScreen';
import { CheckoutScreen } from '@/screens/CheckoutScreen';
import { PaymentScreen } from '@/screens/PaymentScreen';
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
      <Stack.Screen name="OrderType" component={OrderTypeScreen} />
      <Stack.Screen name="Menu" component={MenuScreen} />
      <Stack.Screen
        name="ItemDetail"
        component={ItemDetailModal}
        options={{
          presentation: 'modal',
          animation: 'slide_from_bottom',
        }}
      />
      <Stack.Screen name="Cart" component={CartScreen} />
      <Stack.Screen name="Checkout" component={CheckoutScreen} />
      <Stack.Screen
        name="Payment"
        component={PaymentScreen}
        options={{ gestureEnabled: false }}
      />
      <Stack.Screen
        name="ThankYou"
        component={ThankYouScreen}
        options={{ gestureEnabled: false }}
      />
    </Stack.Navigator>
  );
}
