import { supabase } from './supabase';

export interface GroupNotificationPayload {
  eventType: string;
  groupId: string;
  actorMemberId: string;
  payeeMemberId?: string;
  metadata?: Record<string, unknown>;
}

export function sendGroupNotification(payload: GroupNotificationPayload): void {
  supabase.functions.invoke('send-push-notification', { body: payload }).catch(() => {});
}
