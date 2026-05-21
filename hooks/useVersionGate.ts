import { useEffect, useState } from 'react';
import Constants from 'expo-constants';
import { supabase } from '../lib/supabase';
import { isVersionBelowMinimum } from '../lib/updates';

export type VersionGateState = 'loading' | 'ok' | 'blocked';

export function useVersionGate(): VersionGateState {
  const [state, setState] = useState<VersionGateState>('loading');

  useEffect(() => {
    async function checkVersion() {
      try {
        const { data, error } = await supabase
          .from('app_config')
          .select('value')
          .eq('key', 'minimum_version')
          .single();

        if (error || !data) {
          // If we can't reach Supabase, fail open — don't block the user.
          setState('ok');
          return;
        }

        const runningVersion = Constants.expoConfig?.version ?? null;
        const minimumVersion = data.value;

        setState(
          isVersionBelowMinimum(runningVersion, minimumVersion) ? 'blocked' : 'ok'
        );
      } catch {
        setState('ok');
      }
    }

    checkVersion();
  }, []);

  return state;
}
