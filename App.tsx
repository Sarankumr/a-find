import React, { Suspense, useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Linking,
  LogBox,
  Share,
  StatusBar,
  Text,
  PermissionsAndroid,
  Platform,
  View,
} from 'react-native';
import {
  NavigationContainer,
  useNavigationContainerRef,
} from '@react-navigation/native';
import RootStack from './src/navigation/RootStack';
import { ThemeProvider, useTheme } from './src/contexts/ThemeContext';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetProvider } from './src/contexts/BottomSheetContext';
import { ToastProvider, useToast } from './src/contexts/ToastContext';
import { Provider, useDispatch, useSelector } from 'react-redux';
import { AppDispatch, persistor, RootState, store } from './src/store/store'; // ✅ now MMKV version
import notifee from '@notifee/react-native';
import { EventEmitter } from 'fbemitter';
import 'react-native-gesture-handler';
import { PersistGate } from 'redux-persist/integration/react';
import './src/localization/i18n';
import { I18nextProvider } from 'react-i18next';
import i18next from 'i18next';
import { AppFooterProvider, useFooterContext } from './src/components/app-footer/app-footer-provider';
import { requestUserPermission, onMessageListener } from './src/widget/notifyee-widget-utils';
import { requestContactsPermission } from './src/screens/contact/contact-utils/contact-utils';
import { Modal as CustomAlert } from './src/screens/homeScreens/component/CustomAlert';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { registerToastHandler } from './src/api/apiSlice';
import { disclaimerData } from './src/data/agreementData';
import { loginState, setShowWelcomeOnce } from './src/store/authSlice';
import AsyncStorage from '@react-native-async-storage/async-storage';

LogBox.ignoreAllLogs();

export const deeplinkEmitter = new EventEmitter();

const AppContent = ({ navigationRef, setIsNavigationReady }) => {
   const dispatch = useDispatch();
  const { theme } = useTheme();
  const { setIsComponentHidden } = useFooterContext();
  const { showToast } = useToast();

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [alertModalDetails, setAlertModalDetails] = useState<any>(null);
  const { isLoggedIn,  showWelcomeOnce } = useSelector((state: RootState) => state.auth);

  const handleContactsPermission = async () => {
    try {
      const permissionGranted = await requestContactsPermission();
      if (!permissionGranted) {
        setAlertModalDetails({
          type: 'contacts',
          title: 'Contacts Permission Required',
          body: 'Please enable contacts access in settings to sync your contacts.',
          actions: [
            { label: 'Cancel', onPress: () => setIsModalVisible(false) },
            {
              label: 'Open Settings',
              onPress: () => {
                Linking.openSettings();
                setIsModalVisible(false);
              },
            },
          ],
        });
        setIsModalVisible(true);
        return false;
      }
      return true;
    } catch (error) {
      console.error('Error checking contacts permission:', error);
      return false;
    }
  };

  useEffect(() => {
    registerToastHandler(showToast);

    const initialize = async () => {
      console.log('Initializing app');

      await requestUserPermission();
      await onMessageListener();
      await handleContactsPermission();

      if (Platform.OS === 'android' && Platform.Version >= 33) {
        try {
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
          );
          if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
            setAlertModalDetails({
              type: 'notification',
              title: 'Notification Permission Required',
              body: 'Please enable notifications in settings to receive updates.',
              actions: [
                { label: 'Cancel', onPress: () => setIsModalVisible(false) },
                { label: 'Open Settings', onPress: () => Linking.openSettings() },
              ],
            });
            setIsModalVisible(true);
          }
        } catch (error) {
          console.error('Error requesting POST_NOTIFICATIONS permission:', error);
        }
      }
    };

    initialize();
  }, [showToast]);

   useEffect(() => {
      if (showWelcomeOnce&&!isLoggedIn) {
       onHandleLoginNavigation()
        // dispatch(setShowWelcomeOnce(true));
      }
    }, [showWelcomeOnce]);

    const onHandleLoginNavigation=async () => {
      await AsyncStorage.setItem('loggedIn', 'true');
    dispatch(loginState());
    };

  useEffect(() => {
    const unsubscribe = navigationRef.current?.addListener('state', () => {
      setIsComponentHidden(true);
    });
    return () => unsubscribe?.();
  }, [navigationRef, setIsComponentHidden]);

  const linking = {
    prefixes: ['finderecapp://'],
    config: { screens: { HomeScreen: 'HomeScreen', AddNewCustomList: 'AddNewCustomList' } },
  };

  const onStateChange = useCallback((state: any) => {
    console.log(state?.isFocused ? 'NavigationContainer: Focused' : 'NavigationContainer: Blur');
  }, []);

  return (
    <>
      <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
      <NavigationContainer
        theme={theme}
        ref={navigationRef}
        onStateChange={onStateChange}
        onReady={() => setIsNavigationReady(true)}
        linking={linking}
      >
        <RootStack />
        <CustomAlert
          visible={isModalVisible}
          onClose={() => setIsModalVisible(false)}
          title={alertModalDetails?.title}
          body={alertModalDetails?.body}
          actions={alertModalDetails?.actions}
          modalType="info"
          icone={{
            size: 40,
            name: alertModalDetails?.type === 'notification'
              ? 'bell-ring-outline'
              : alertModalDetails?.type === 'contacts'
                ? 'contacts'
                : 'app-settings-alt',
            type: alertModalDetails?.type === 'notification'
              ? 'material-community'
              : 'material',
          }}
        />
      </NavigationContainer>
    </>
  );
};

const App = () => {
  const navigationRef = useNavigationContainerRef();
  const [isNavigationReady, setIsNavigationReady] = useState(false);

  const handleOpenURL = useCallback(async ({ url }) => {
    if (!url?.startsWith('finderecapp://HomeScreen')) return;

    try {
      const queryParams = new URLSearchParams(url.split('?')[1] || '');
      const ccod1 = decodeURIComponent(queryParams.get('ccod1') || '');
      const ccod2 = queryParams.get('ccod2') || '';
      const ccod3 = queryParams.get('ccod3') || '';

      if (ccod1 && ccod2 && ccod3) {
        Share.share({
          message: `Member Name: ${ccod1}\neREC ID: ${ccod2}\nTo find individuals listed as my emergency contacts, click on My eREC ${ccod3} or findeREC.com or call toll-free 888-514-eREC (3732)`,
        });
      }
    } catch (e) {
      console.error('Deep link parsing error:', e);
    }
  }, []);

  useEffect(() => {
    const subscription = Linking.addEventListener('url', handleOpenURL);

    Linking.getInitialURL()
      .then((url) => url && handleOpenURL({ url }))
      .catch((err) => console.error('Error getting initial URL:', err));

    return () => subscription.remove?.();
  }, [handleOpenURL]);

  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <I18nextProvider i18n={i18next}>
            <Suspense
              fallback={
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                  <Text>Loading translations...</Text>
                </View>
              }
            >
              <SafeAreaProvider>
                <AppFooterProvider>
                  <BottomSheetProvider>
                    <ToastProvider>
                      <ThemeProvider>
                        <AppContent
                          navigationRef={navigationRef}
                          setIsNavigationReady={setIsNavigationReady}
                        />
                      </ThemeProvider>
                    </ToastProvider>
                  </BottomSheetProvider>
                </AppFooterProvider>
              </SafeAreaProvider>
            </Suspense>
          </I18nextProvider>
        </GestureHandlerRootView>
      </PersistGate>
    </Provider>
  );
};

export default App;
