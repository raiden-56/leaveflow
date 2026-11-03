import { Avatar, Badge, Box, Stack, Typography, type AvatarProps } from '@mui/material';
import type { EmployeeSummary } from '@leaveflow/shared';
import { colorFor, initials } from '@/utils/format';

interface Props extends AvatarProps {
  name?: string;
  image?: string;
  size?: number;
  status?: 'AVAILABLE' | 'ON_LEAVE' | 'REMOTE';
}

const STATUS_COLOR = { AVAILABLE: '#16A34A', ON_LEAVE: '#DC2626', REMOTE: '#2563EB' } as const;

export function EmployeeAvatar({ name, image, size = 36, status, sx, ...rest }: Props) {
  const avatar = (
    <Avatar
      src={image || undefined}
      alt={name}
      sx={{ width: size, height: size, fontSize: size * 0.38, fontWeight: 700, bgcolor: colorFor(name), ...sx }}
      {...rest}
    >
      {initials(name)}
    </Avatar>
  );
  if (!status) return avatar;
  return (
    <Badge
      overlap="circular"
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      variant="dot"
      sx={{ '& .MuiBadge-badge': { bgcolor: STATUS_COLOR[status], width: 10, height: 10, borderRadius: '50%', border: '2px solid', borderColor: 'background.paper' } }}
    >
      {avatar}
    </Badge>
  );
}

/** Avatar + name + secondary line, used in tables and lists. */
export function EmployeeCell({ employee, secondary, size = 34 }: { employee?: Partial<EmployeeSummary>; secondary?: React.ReactNode; size?: number }) {
  return (
    <Stack direction="row" spacing={1.25} alignItems="center" sx={{ minWidth: 0 }}>
      <EmployeeAvatar name={employee?.employeeName} image={employee?.profileImage} size={size} />
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2" fontWeight={600} noWrap>
          {employee?.employeeName ?? '—'}
        </Typography>
        <Typography variant="caption" color="text.secondary" noWrap component="div">
          {secondary ?? employee?.designation}
        </Typography>
      </Box>
    </Stack>
  );
}
