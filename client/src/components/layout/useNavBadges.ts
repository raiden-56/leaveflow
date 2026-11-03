import { useAuth } from '@/hooks';
import { useHandoversQuery, useLeavesQuery, useNotificationsQuery } from '@/app/store/api';

/** Live counts for the navigation badges (polled with the notification interval). */
export function useNavBadges() {
  const { user, isManager, settings } = useAuth();
  const pollingInterval = (settings?.notificationPollSeconds ?? 30) * 1000;
  const { data: notifications } = useNotificationsQuery(undefined, { skip: !user, pollingInterval });
  const { data: approvals } = useLeavesQuery({ scope: 'approvals', status: 'PENDING' }, { skip: !isManager, pollingInterval: pollingInterval * 2 });
  const { data: handovers } = useHandoversQuery({ scope: 'assigned', status: 'PENDING_ACCEPTANCE' }, { skip: !user, pollingInterval: pollingInterval * 2 });
  return {
    notifications: notifications?.unread ?? 0,
    approvals: approvals?.length ?? 0,
    handovers: handovers?.length ?? 0,
  };
}
