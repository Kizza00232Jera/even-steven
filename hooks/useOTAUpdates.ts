import { useEffect, useState } from 'react';
import * as Updates from 'expo-updates';
import { Alert } from 'react-native';

export type OTAUpdateState = 'idle' | 'checking' | 'downloading' | 'ready';

export function useOTAUpdates() {
  const [state, setState] = useState<OTAUpdateState>('idle');

  useEffect(() => {
    // OTA checks only make sense in production builds where expo-updates is active.
    if (__DEV__ || !Updates.isEnabled) return;

    async function checkAndDownload() {
      try {
        setState('checking');
        const result = await Updates.checkForUpdateAsync();
        if (!result.isAvailable) {
          setState('idle');
          return;
        }

        setState('downloading');
        await Updates.fetchUpdateAsync();
        setState('ready');

        Alert.alert(
          'Update ready',
          'A new version of Even Steven has been downloaded. Restart now to apply it.',
          [
            { text: 'Later', style: 'cancel', onPress: () => setState('idle') },
            { text: 'Restart', onPress: () => Updates.reloadAsync() },
          ]
        );
      } catch {
        setState('idle');
      }
    }

    checkAndDownload();
  }, []);

  return state;
}
