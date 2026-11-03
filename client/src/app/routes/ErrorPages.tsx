import { Link as RouterLink } from 'react-router-dom';
import { Button } from '@mui/material';
import { Compass, ShieldAlert } from 'lucide-react';
import { EmptyState } from '@/components/common';

export function NotFoundPage() {
  return (
    <EmptyState
      icon={<Compass size={24} />}
      title="Page not found"
      description="The page you are looking for doesn't exist or has moved."
      action={<Button component={RouterLink} to="/dashboard" variant="contained">Back to dashboard</Button>}
    />
  );
}

export function ForbiddenPage() {
  return (
    <EmptyState
      icon={<ShieldAlert size={24} />}
      title="You don't have access to this page"
      description="This area is restricted to a different role. Contact HR if you believe this is a mistake."
      action={<Button component={RouterLink} to="/dashboard" variant="contained">Back to dashboard</Button>}
    />
  );
}
