import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Table,
  Button,
  Group,
  Text,
  TextInput,
  NumberInput,
  Modal,
  Drawer,
  Tabs,
  Select,
  Switch,
  Stack,
  ActionIcon,
  Menu,
  Box,
  Checkbox,
  Progress,
  Paper,
  Badge,
  CopyButton,
  Tooltip,
  Divider,
  Card,
  Pagination,
  Chip,
  UnstyledButton,
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { DateInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import { QRCodeSVG } from 'qrcode.react';
import {
  IconPlus,
  IconSearch,
  IconDotsVertical,
  IconCopy,
  IconToggleLeft,
  IconTrash,
  IconUserCheck,
  IconUserOff,
  IconUsers,
  IconCircleFilled,
  IconRefresh,
  IconCalendarPlus,
  IconDevices,
  IconAlertTriangle,
  IconUser,
  IconDeviceLaptop,
  IconCalendarEvent,
  IconLink,
  IconCheck,
  IconArrowUp,
  IconArrowDown,
  IconArrowsSort,
} from '@tabler/icons-react';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { useTranslation } from 'react-i18next';
import {
  getUsersPaginated,
  createUser,
  updateUser,
  toggleUser,
  deleteUser,
  bulkEnableUsers,
  bulkDisableUsers,
  bulkDeleteUsers,
  renewUser,
  resetUserTraffic,
  getUserDevices,
  removeUserDevice,
  revokeUserSubscription,
} from '../api/users';
import { usePaginated } from '../hooks/usePaginated';
import type { User, UserDevice, TrafficStrategy } from '../types';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { EmptyState } from '../components/EmptyState';
import { useFormValidation, validators } from '../hooks/useFormValidation';
import { usePermissions } from '../hooks/usePermissions';
import { extractErrorMessage } from '../api/client';

const cardStyle = {
  backgroundColor: '#1E2128',
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: 12,
  boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
};

const inputStyles = {
  input: {
    backgroundColor: '#161B23',
    border: '1px solid rgba(255,255,255,0.06)',
    color: '#C1C2C5',
    borderRadius: 8,
  },
  label: {
    color: '#909296',
    fontSize: '12px',
    fontWeight: 600,
    marginBottom: 4,
  },
};

const thStyle = {
  color: '#5c5f66',
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '0.8px',
  textTransform: 'uppercase' as const,
};

const GB = 1024 * 1024 * 1024;

function formatBytes(bytesStr: string): string {
  const bytes = Number(bytesStr);
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const val = bytes / Math.pow(k, i);
  return `${val.toFixed(1)} ${sizes[i]}`;
}

function gbToBytes(gb: number): number {
  return gb * GB;
}

function bytesToGb(bytesStr: string | null): number {
  if (!bytesStr) return 0;
  return Number(bytesStr) / GB;
}

function getTrafficPercent(user: User): number | null {
  if (!user.trafficLimit) return null;
  const used = Number(user.trafficUp) + Number(user.trafficDown);
  const limit = Number(user.trafficLimit);
  if (limit === 0) return null;
  return Math.min(100, (used / limit) * 100);
}

function isExpiringSoon(user: User): boolean {
  if (!user.expiryDate) return false;
  const expiry = new Date(user.expiryDate);
  const now = new Date();
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  return expiry > now && expiry.getTime() - now.getTime() < sevenDays;
}

function isExpired(user: User): boolean {
  if (!user.expiryDate) return false;
  return new Date(user.expiryDate) < new Date();
}

function isLimitExceeded(user: User): boolean {
  if (!user.trafficLimit) return false;
  const used = Number(user.trafficUp) + Number(user.trafficDown);
  return used >= Number(user.trafficLimit);
}

function getStatusInfo(user: User): { label: string; dotColor: string; key: string } {
  if (!user.enabled) {
    return { label: 'Disabled', dotColor: '#ff6b6b', key: 'users.statusDisabled' };
  }
  if (isExpired(user)) {
    return { label: 'Expired', dotColor: '#ff6b6b', key: 'users.statusExpired' };
  }
  if (isLimitExceeded(user)) {
    return { label: 'Limit Exceeded', dotColor: '#ff6b6b', key: 'users.statusLimitExceeded' };
  }
  if (isExpiringSoon(user)) {
    return { label: 'Expiring Soon', dotColor: '#FCC419', key: 'users.statusExpiringSoon' };
  }
  return { label: 'Active', dotColor: '#51cf66', key: 'users.statusActive' };
}

function strategyLabel(strategy: TrafficStrategy): string {
  switch (strategy) {
    case 'NO_RESET':
      return 'Never (manual)';
    case 'DAY':
      return 'day';
    case 'WEEK':
      return 'week (Monday)';
    case 'MONTH':
      return 'month (1st)';
    case 'MONTH_ROLLING':
      return '30 days (rolling)';
    default:
      return strategy;
  }
}

// Generate mini sparkline data for user traffic
function userSparkline(user: User): { v: number }[] {
  const total = Number(user.trafficUp) + Number(user.trafficDown);
  if (total === 0) return Array.from({ length: 7 }, () => ({ v: 0.2 }));
  return Array.from({ length: 7 }, (_, i) => ({
    v: total * (0.5 + 0.5 * Math.sin(i * 1.1 + Number(user.id.charCodeAt(0) || 0) * 0.1)),
  }));
}

interface CreateUserFormValues {
  email: string;
  remark: string;
  trafficLimitGB: number | '';
  expiryDate: Date | null;
  maxDevices: number | '';
}

const TRAFFIC_STRATEGY_OPTIONS: { value: TrafficStrategy; label: string }[] = [
  { value: 'NO_RESET', label: 'No reset (manual)' },
  { value: 'DAY', label: 'Daily' },
  { value: 'WEEK', label: 'Weekly (Monday)' },
  { value: 'MONTH', label: 'Monthly (1st)' },
  { value: 'MONTH_ROLLING', label: 'Rolling 30 days' },
];

interface UserDrawerProps {
  user: User | null;
  opened: boolean;
  onClose: () => void;
  onSaved: () => void;
  canEdit: boolean;
  canDelete: boolean;
}

function UserDrawer({
  user,
  opened,
  onClose,
  onSaved,
  canEdit,
  canDelete,
}: UserDrawerProps) {
  const [savingGeneral, setSavingGeneral] = useState(false);
  const [savingTraffic, setSavingTraffic] = useState(false);
  const [savingExpiry, setSavingExpiry] = useState(false);

  const [email, setEmail] = useState('');
  const [remark, setRemark] = useState('');
  const [tag, setTag] = useState('');
  const [trafficStrategy, setTrafficStrategy] =
    useState<TrafficStrategy>('NO_RESET');
  const [hwidDeviceLimit, setHwidDeviceLimit] = useState<number | ''>('');
  const [enabled, setEnabled] = useState(true);

  const [limitGb, setLimitGb] = useState<number | ''>('');
  const [expiryDate, setExpiryDate] = useState<Date | null>(null);

  const [devices, setDevices] = useState<UserDevice[]>([]);
  const [devicesLoading, setDevicesLoading] = useState(false);

  const subLink = useMemo(
    () =>
      user
        ? `${window.location.origin}/sub/${user.subToken}`
        : '',
    [user],
  );

  useEffect(() => {
    if (!user) return;
    setEmail(user.email);
    setRemark(user.remark ?? '');
    setTag(user.tag ?? '');
    setTrafficStrategy(user.trafficStrategy);
    setHwidDeviceLimit(
      user.hwidDeviceLimit !== null && user.hwidDeviceLimit !== undefined
        ? user.hwidDeviceLimit
        : '',
    );
    setEnabled(user.enabled);
    setLimitGb(user.trafficLimit ? Number(user.trafficLimit) / GB : '');
    setExpiryDate(user.expiryDate ? new Date(user.expiryDate) : null);
  }, [user]);

  const loadDevices = useCallback(async () => {
    if (!user) return;
    setDevicesLoading(true);
    try {
      const list = await getUserDevices(user.id);
      setDevices(list);
    } catch {
      notifications.show({
        title: 'Error',
        message: 'Failed to load devices',
        color: 'red',
      });
    } finally {
      setDevicesLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (opened && user) {
      loadDevices();
    }
  }, [opened, user, loadDevices]);

  if (!user) return null;

  const handleSaveGeneral = async () => {
    setSavingGeneral(true);
    try {
      await updateUser(user.id, {
        email,
        remark: remark || null,
        tag: tag || null,
        trafficStrategy,
        hwidDeviceLimit:
          hwidDeviceLimit === '' ? null : Number(hwidDeviceLimit),
        enabled,
      });
      notifications.show({
        title: 'Saved',
        message: 'User updated',
        color: 'teal',
      });
      onSaved();
    } catch (err) {
      notifications.show({
        title: 'Error',
        message: extractErrorMessage(err),
        color: 'red',
      });
    } finally {
      setSavingGeneral(false);
    }
  };

  const handleSaveTraffic = async () => {
    setSavingTraffic(true);
    try {
      const bytes =
        limitGb === '' || Number(limitGb) === 0
          ? null
          : Math.round(gbToBytes(Number(limitGb)));
      await updateUser(user.id, { trafficLimit: bytes });
      notifications.show({
        title: 'Saved',
        message: 'Traffic limit updated',
        color: 'teal',
      });
      onSaved();
    } catch (err) {
      notifications.show({
        title: 'Error',
        message: extractErrorMessage(err),
        color: 'red',
      });
    } finally {
      setSavingTraffic(false);
    }
  };

  const handleSaveExpiry = async () => {
    setSavingExpiry(true);
    try {
      await updateUser(user.id, {
        expiryDate: expiryDate ? expiryDate.toISOString() : null,
      });
      notifications.show({
        title: 'Saved',
        message: 'Expiration updated',
        color: 'teal',
      });
      onSaved();
    } catch (err) {
      notifications.show({
        title: 'Error',
        message: extractErrorMessage(err),
        color: 'red',
      });
    } finally {
      setSavingExpiry(false);
    }
  };

  const bumpExpiry = (add: { months?: number; years?: number }) => {
    const base = expiryDate ? new Date(expiryDate) : new Date();
    if (add.months) base.setMonth(base.getMonth() + add.months);
    if (add.years) base.setFullYear(base.getFullYear() + add.years);
    setExpiryDate(base);
  };

  const setNever = () => setExpiryDate(new Date('2099-12-31T23:59:59Z'));

  const handleDeleteDevice = async (deviceId: string) => {
    try {
      await removeUserDevice(user.id, deviceId);
      notifications.show({
        title: 'Removed',
        message: 'Device removed',
        color: 'teal',
      });
      await loadDevices();
    } catch (err) {
      notifications.show({
        title: 'Error',
        message: extractErrorMessage(err),
        color: 'red',
      });
    }
  };

  const handleResetTraffic = async () => {
    try {
      await resetUserTraffic(user.id);
      notifications.show({
        title: 'Reset',
        message: 'Traffic counters reset',
        color: 'teal',
      });
      onSaved();
    } catch (err) {
      notifications.show({
        title: 'Error',
        message: extractErrorMessage(err),
        color: 'red',
      });
    }
  };

  const handleRevokeSubscription = async () => {
    try {
      await revokeUserSubscription(user.id);
      notifications.show({
        title: 'Revoked',
        message: 'Subscription token regenerated',
        color: 'teal',
      });
      onSaved();
    } catch (err) {
      notifications.show({
        title: 'Error',
        message: extractErrorMessage(err),
        color: 'red',
      });
    }
  };

  const handleDelete = async () => {
    try {
      await deleteUser(user.id);
      notifications.show({
        title: 'Deleted',
        message: 'User deleted',
        color: 'teal',
      });
      onClose();
      onSaved();
    } catch (err) {
      notifications.show({
        title: 'Error',
        message: extractErrorMessage(err),
        color: 'red',
      });
    }
  };

  const usedBytes = Number(user.trafficUp) + Number(user.trafficDown);
  const lifetimeBytes = Number(user.lifetimeTrafficUsed) + usedBytes;

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="right"
      size="xl"
      padding="lg"
      title={
        <Group gap="sm">
          <IconUser size={18} color="#20C997" stroke={1.8} />
          <Text fw={600} style={{ color: '#C1C2C5' }}>
            {user.email}
          </Text>
        </Group>
      }
      styles={{
        content: { backgroundColor: '#1E2128' },
        header: {
          backgroundColor: '#1E2128',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        },
        close: { color: '#909296' },
        body: { padding: 0 },
      }}
    >
      <Tabs
        defaultValue="general"
        color="teal"
        styles={{
          list: {
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            paddingLeft: 16,
            paddingRight: 16,
          },
          tab: {
            color: '#909296',
            fontSize: 13,
            fontWeight: 500,
          },
          panel: { padding: 20 },
        }}
      >
        <Tabs.List>
          <Tabs.Tab
            value="general"
            leftSection={<IconUser size={14} stroke={1.8} />}
          >
            General
          </Tabs.Tab>
          <Tabs.Tab
            value="traffic"
            leftSection={<IconRefresh size={14} stroke={1.8} />}
          >
            Traffic
          </Tabs.Tab>
          <Tabs.Tab
            value="expiration"
            leftSection={<IconCalendarEvent size={14} stroke={1.8} />}
          >
            Expiration
          </Tabs.Tab>
          <Tabs.Tab
            value="devices"
            leftSection={<IconDeviceLaptop size={14} stroke={1.8} />}
          >
            Devices
          </Tabs.Tab>
          <Tabs.Tab
            value="subscription"
            leftSection={<IconLink size={14} stroke={1.8} />}
          >
            Subscription
          </Tabs.Tab>
          <Tabs.Tab
            value="danger"
            leftSection={<IconAlertTriangle size={14} stroke={1.8} />}
            color="red"
          >
            Danger
          </Tabs.Tab>
        </Tabs.List>

        {/* GENERAL */}
        <Tabs.Panel value="general">
          <Stack gap="md">
            <TextInput
              label="Email"
              value={email}
              onChange={(e) => setEmail(e.currentTarget.value)}
              styles={inputStyles}
              disabled={!canEdit}
            />
            <TextInput
              label="Remark"
              placeholder="Optional note"
              value={remark}
              onChange={(e) => setRemark(e.currentTarget.value)}
              styles={inputStyles}
              disabled={!canEdit}
            />
            <TextInput
              label="Tag"
              placeholder="Free-form user tag (for filtering)"
              value={tag}
              onChange={(e) => setTag(e.currentTarget.value)}
              styles={inputStyles}
              disabled={!canEdit}
            />
            <Select
              label="Traffic strategy"
              data={TRAFFIC_STRATEGY_OPTIONS}
              value={trafficStrategy}
              onChange={(v) =>
                v && setTrafficStrategy(v as TrafficStrategy)
              }
              allowDeselect={false}
              styles={inputStyles}
              disabled={!canEdit}
            />
            <NumberInput
              label="HWID device limit"
              description="Per-user override of maxDevices. Leave empty to use global."
              value={hwidDeviceLimit}
              onChange={(v) =>
                setHwidDeviceLimit(v === '' ? '' : Number(v))
              }
              min={0}
              max={1000}
              styles={inputStyles}
              disabled={!canEdit}
            />
            <Switch
              label="Enabled"
              checked={enabled}
              onChange={(e) => setEnabled(e.currentTarget.checked)}
              color="teal"
              disabled={!canEdit}
              styles={{ label: { color: '#C1C2C5' } }}
            />
            {canEdit && (
              <Button
                variant="gradient"
                gradient={{ from: 'teal', to: 'cyan' }}
                loading={savingGeneral}
                onClick={handleSaveGeneral}
                radius="md"
              >
                Save
              </Button>
            )}
          </Stack>
        </Tabs.Panel>

        {/* TRAFFIC */}
        <Tabs.Panel value="traffic">
          <Stack gap="md">
            <Card style={cardStyle} p="md">
              <Stack gap={6}>
                <Group justify="space-between">
                  <Text size="xs" style={{ color: '#909296' }}>
                    Upload
                  </Text>
                  <Text size="sm" ff="monospace" style={{ color: '#C1C2C5' }}>
                    {formatBytes(user.trafficUp)}
                  </Text>
                </Group>
                <Group justify="space-between">
                  <Text size="xs" style={{ color: '#909296' }}>
                    Download
                  </Text>
                  <Text size="sm" ff="monospace" style={{ color: '#C1C2C5' }}>
                    {formatBytes(user.trafficDown)}
                  </Text>
                </Group>
                <Group justify="space-between">
                  <Text size="xs" style={{ color: '#909296' }}>
                    Used
                  </Text>
                  <Text size="sm" ff="monospace" fw={600} style={{ color: '#C1C2C5' }}>
                    {formatBytes(String(usedBytes))}
                  </Text>
                </Group>
                <Group justify="space-between">
                  <Text size="xs" style={{ color: '#909296' }}>
                    Lifetime total
                  </Text>
                  <Text size="sm" ff="monospace" style={{ color: '#C1C2C5' }}>
                    {formatBytes(String(lifetimeBytes))}
                  </Text>
                </Group>
              </Stack>
            </Card>
            <NumberInput
              label="Data Limit (GB)"
              description="Enter data limit in GB, 0 for unlimited"
              value={limitGb}
              onChange={(v) => setLimitGb(v === '' ? '' : Number(v))}
              min={0}
              max={100000}
              step={0.1}
              styles={inputStyles}
              disabled={!canEdit}
            />
            <Text size="xs" style={{ color: '#909296' }}>
              Current limit:{' '}
              <Text span fw={600} style={{ color: '#C1C2C5' }}>
                {user.trafficLimit
                  ? `${bytesToGb(user.trafficLimit).toFixed(2)} GB`
                  : 'Unlimited'}
              </Text>
            </Text>
            <Text size="xs" style={{ color: '#909296' }}>
              Resets every{' '}
              <Text span fw={600} style={{ color: '#C1C2C5' }}>
                {strategyLabel(user.trafficStrategy)}
              </Text>
              {user.lastTrafficResetAt && (
                <>
                  {' '}
                  · Last reset{' '}
                  <Text span fw={600} style={{ color: '#C1C2C5' }}>
                    {new Date(user.lastTrafficResetAt).toLocaleString()}
                  </Text>
                </>
              )}
            </Text>
            {canEdit && (
              <Button
                variant="gradient"
                gradient={{ from: 'teal', to: 'cyan' }}
                loading={savingTraffic}
                onClick={handleSaveTraffic}
                radius="md"
              >
                Save
              </Button>
            )}
          </Stack>
        </Tabs.Panel>

        {/* EXPIRATION */}
        <Tabs.Panel value="expiration">
          <Stack gap="md">
            <DateInput
              label="Expiry date"
              value={expiryDate}
              onChange={(v) => setExpiryDate(v)}
              clearable
              styles={inputStyles}
              disabled={!canEdit}
            />
            {canEdit && (
              <Group gap="xs">
                <Button
                  size="xs"
                  variant="light"
                  color="teal"
                  radius="md"
                  onClick={() => bumpExpiry({ months: 1 })}
                >
                  +1 month
                </Button>
                <Button
                  size="xs"
                  variant="light"
                  color="teal"
                  radius="md"
                  onClick={() => bumpExpiry({ months: 3 })}
                >
                  +3 months
                </Button>
                <Button
                  size="xs"
                  variant="light"
                  color="teal"
                  radius="md"
                  onClick={() => bumpExpiry({ years: 1 })}
                >
                  +1 year
                </Button>
                <Button
                  size="xs"
                  variant="light"
                  color="gray"
                  radius="md"
                  onClick={setNever}
                >
                  2099 (Never)
                </Button>
              </Group>
            )}
            {canEdit && (
              <Button
                variant="gradient"
                gradient={{ from: 'teal', to: 'cyan' }}
                loading={savingExpiry}
                onClick={handleSaveExpiry}
                radius="md"
              >
                Save
              </Button>
            )}
          </Stack>
        </Tabs.Panel>

        {/* DEVICES */}
        <Tabs.Panel value="devices">
          <Stack gap="sm">
            {devicesLoading && (
              <Text size="sm" style={{ color: '#909296' }}>
                Loading...
              </Text>
            )}
            {!devicesLoading && devices.length === 0 && (
              <Text size="sm" style={{ color: '#909296' }}>
                No devices registered
              </Text>
            )}
            {devices.map((d) => (
              <Card key={d.id} style={cardStyle} p="md">
                <Group justify="space-between" wrap="nowrap">
                  <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
                    <Group gap={8}>
                      <IconDeviceLaptop
                        size={14}
                        color="#909296"
                        stroke={1.6}
                      />
                      <Text size="sm" fw={600} style={{ color: '#C1C2C5' }}>
                        {d.platform ?? 'Unknown platform'}
                      </Text>
                    </Group>
                    <Text
                      size="xs"
                      ff="monospace"
                      style={{
                        color: '#5c5f66',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      HWID: {d.hwid}
                    </Text>
                    <Text size="xs" style={{ color: '#5c5f66' }}>
                      Last seen: {new Date(d.lastSeen).toLocaleString()}
                    </Text>
                    <Text size="xs" style={{ color: '#5c5f66' }}>
                      Created: {new Date(d.createdAt).toLocaleString()}
                    </Text>
                  </Stack>
                  {canEdit && (
                    <Button
                      size="xs"
                      variant="light"
                      color="red"
                      radius="md"
                      leftSection={<IconTrash size={12} />}
                      onClick={() => handleDeleteDevice(d.id)}
                    >
                      Delete
                    </Button>
                  )}
                </Group>
              </Card>
            ))}
          </Stack>
        </Tabs.Panel>

        {/* SUBSCRIPTION */}
        <Tabs.Panel value="subscription">
          <Stack gap="md">
            <TextInput
              label="Subscription token"
              value={user.subToken}
              readOnly
              styles={inputStyles}
              rightSection={
                <CopyButton value={user.subToken}>
                  {({ copied, copy }) => (
                    <Tooltip label={copied ? 'Copied' : 'Copy'}>
                      <ActionIcon
                        variant="subtle"
                        color="gray"
                        onClick={copy}
                      >
                        {copied ? (
                          <IconCheck size={14} />
                        ) : (
                          <IconCopy size={14} />
                        )}
                      </ActionIcon>
                    </Tooltip>
                  )}
                </CopyButton>
              }
            />
            <TextInput
              label="Subscription URL"
              value={subLink}
              readOnly
              styles={inputStyles}
              rightSection={
                <CopyButton value={subLink}>
                  {({ copied, copy }) => (
                    <Tooltip label={copied ? 'Copied' : 'Copy'}>
                      <ActionIcon
                        variant="subtle"
                        color="gray"
                        onClick={copy}
                      >
                        {copied ? (
                          <IconCheck size={14} />
                        ) : (
                          <IconCopy size={14} />
                        )}
                      </ActionIcon>
                    </Tooltip>
                  )}
                </CopyButton>
              }
            />
            <Card
              style={{
                ...cardStyle,
                display: 'flex',
                justifyContent: 'center',
                padding: 20,
              }}
            >
              <Box
                style={{
                  backgroundColor: '#fff',
                  padding: 12,
                  borderRadius: 8,
                  display: 'inline-block',
                }}
              >
                <QRCodeSVG value={subLink} size={192} level="M" />
              </Box>
            </Card>
            {user.shortUuid && (
              <TextInput
                label="Short UUID"
                value={user.shortUuid}
                readOnly
                styles={inputStyles}
              />
            )}
          </Stack>
        </Tabs.Panel>

        {/* DANGER */}
        <Tabs.Panel value="danger">
          <Stack gap="md">
            <Card style={cardStyle} p="md">
              <Stack gap={8}>
                <Text size="sm" fw={600} style={{ color: '#C1C2C5' }}>
                  Reset traffic
                </Text>
                <Text size="xs" style={{ color: '#909296' }}>
                  Move current usage to lifetime counter and zero out up/down.
                </Text>
                <Button
                  size="sm"
                  color="yellow"
                  variant="light"
                  radius="md"
                  leftSection={<IconRefresh size={14} />}
                  onClick={handleResetTraffic}
                  disabled={!canEdit}
                >
                  Reset traffic
                </Button>
              </Stack>
            </Card>
            <Card style={cardStyle} p="md">
              <Stack gap={8}>
                <Text size="sm" fw={600} style={{ color: '#C1C2C5' }}>
                  Revoke subscription
                </Text>
                <Text size="xs" style={{ color: '#909296' }}>
                  Regenerates the subscription token. Existing clients stop
                  working.
                </Text>
                <Button
                  size="sm"
                  color="orange"
                  variant="light"
                  radius="md"
                  leftSection={<IconLink size={14} />}
                  onClick={handleRevokeSubscription}
                  disabled={!canEdit}
                >
                  Revoke subscription
                </Button>
              </Stack>
            </Card>
            <Divider color="rgba(255,255,255,0.06)" />
            <Card style={cardStyle} p="md">
              <Stack gap={8}>
                <Text size="sm" fw={600} style={{ color: '#ff6b6b' }}>
                  Delete user
                </Text>
                <Text size="xs" style={{ color: '#909296' }}>
                  Permanently remove the user and all associated data.
                </Text>
                <Button
                  size="sm"
                  color="red"
                  variant="light"
                  radius="md"
                  leftSection={<IconTrash size={14} />}
                  onClick={handleDelete}
                  disabled={!canDelete}
                >
                  Delete user
                </Button>
              </Stack>
            </Card>
          </Stack>
        </Tabs.Panel>
      </Tabs>
    </Drawer>
  );
}

type UserStatusFilter = 'all' | 'active' | 'expired' | 'disabled';

interface SortableHeaderProps {
  label: string;
  field: string;
  sortBy?: string;
  sortOrder: 'asc' | 'desc';
  onToggle: (field: string) => void;
}

function SortableHeader({
  label,
  field,
  sortBy,
  sortOrder,
  onToggle,
}: SortableHeaderProps) {
  const active = sortBy === field;
  const Icon = !active
    ? IconArrowsSort
    : sortOrder === 'asc'
      ? IconArrowUp
      : IconArrowDown;
  return (
    <UnstyledButton
      onClick={() => onToggle(field)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        color: active ? '#20C997' : '#5c5f66',
        fontSize: '11px',
        fontWeight: 700,
        letterSpacing: '0.8px',
        textTransform: 'uppercase',
        cursor: 'pointer',
      }}
    >
      <span>{label}</span>
      <Icon size={12} stroke={2} />
    </UnstyledButton>
  );
}

export function UsersPage() {
  const { t } = useTranslation();
  const permissions = usePermissions();
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [drawerUser, setDrawerUser] = useState<User | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch] = useDebouncedValue(searchInput, 300);
  const [statusFilter, setStatusFilter] = useState<UserStatusFilter>('all');

  const paginated = usePaginated<User>(getUsersPaginated, {
    size: 25,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });

  const {
    items: users,
    total,
    loading,
    error: loadError,
    start,
    size,
    sortBy,
    sortOrder,
    setPage,
    setSize,
    toggleSort,
    setSearch: setPaginatedSearch,
    setFilter,
    refetch: fetchUsers,
  } = paginated;

  // Debounced search -> pagination
  useEffect(() => {
    setPaginatedSearch(debouncedSearch);
  }, [debouncedSearch, setPaginatedSearch]);

  // Status chip filter -> pagination filters
  useEffect(() => {
    if (statusFilter === 'all') {
      setFilter('enabled', undefined);
      setFilter('expired', undefined);
    } else if (statusFilter === 'active') {
      setFilter('enabled', true);
      setFilter('expired', false);
    } else if (statusFilter === 'expired') {
      setFilter('enabled', undefined);
      setFilter('expired', true);
    } else if (statusFilter === 'disabled') {
      setFilter('enabled', false);
      setFilter('expired', undefined);
    }
  }, [statusFilter, setFilter]);

  // Keep drawer user in sync with fresh data
  useEffect(() => {
    setDrawerUser((prev) =>
      prev ? users.find((u) => u.id === prev.id) ?? prev : null,
    );
  }, [users]);

  const createForm = useFormValidation<CreateUserFormValues>(
    {
      email: '',
      remark: '',
      trafficLimitGB: '',
      expiryDate: null,
      maxDevices: '',
    },
    {
      email: validators.combine(
        validators.isNotEmpty(t('validation.required')),
        validators.isEmail(t('validation.email')),
      ),
      trafficLimitGB: validators.isInRange(
        { min: 0, max: 100000 },
        t('validation.trafficGb'),
      ),
      maxDevices: validators.isInRange(
        { min: 0, max: 1000 },
        t('validation.positive'),
      ),
    },
  );

  const openDrawer = (user: User) => {
    setDrawerUser(user);
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
  };

  const handleCreate = async () => {
    if (!createForm.validate()) return;
    const { email, remark, trafficLimitGB, expiryDate } = createForm.values;
    setCreating(true);
    try {
      await createUser({
        email,
        remark: remark || undefined,
        trafficLimit:
          trafficLimitGB !== '' ? gbToBytes(Number(trafficLimitGB)) : undefined,
        expiryDate: expiryDate ? expiryDate.toISOString() : undefined,
      });
      setCreateOpen(false);
      createForm.reset();
      notifications.show({
        title: t('common.success'),
        message: t('notification.userCreated'),
        color: 'teal',
      });
      await fetchUsers();
    } catch {
      notifications.show({
        title: t('common.error'),
        message: t('notification.userCreateError'),
        color: 'red',
      });
    } finally {
      setCreating(false);
    }
  };

  const handleToggle = async (id: string) => {
    try {
      await toggleUser(id);
      await fetchUsers();
    } catch {
      notifications.show({
        title: t('common.error'),
        message: t('notification.userToggleError'),
        color: 'red',
      });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteUser(id);
      notifications.show({
        title: t('common.success'),
        message: t('notification.userDeleted'),
        color: 'teal',
      });
      await fetchUsers();
    } catch {
      notifications.show({
        title: t('common.error'),
        message: t('notification.userDeleteError'),
        color: 'red',
      });
    }
  };

  const handleRenew = async (id: string) => {
    try {
      await renewUser(id, 30);
      notifications.show({
        title: t('common.success'),
        message: t('notification.userRenewed'),
        color: 'teal',
      });
      await fetchUsers();
    } catch {
      notifications.show({
        title: t('common.error'),
        message: t('notification.userRenewError'),
        color: 'red',
      });
    }
  };

  const handleResetTraffic = async (id: string) => {
    try {
      await resetUserTraffic(id);
      notifications.show({
        title: t('common.success'),
        message: t('notification.userTrafficReset'),
        color: 'teal',
      });
      await fetchUsers();
    } catch {
      notifications.show({
        title: t('common.error'),
        message: t('notification.userTrafficResetError'),
        color: 'red',
      });
    }
  };

  const handleCopySubLink = (user: User) => {
    const link = `${window.location.origin}/sub/${user.subToken}`;
    navigator.clipboard.writeText(link);
    notifications.show({
      title: t('common.copied'),
      message: t('notification.subLinkCopied'),
      color: 'teal',
    });
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleAllSelected = () => {
    if (selectedIds.size === users.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(users.map((u) => u.id)));
    }
  };

  const handleBulkEnable = async () => {
    if (selectedIds.size === 0) return;
    setBulkLoading(true);
    try {
      const result = await bulkEnableUsers(Array.from(selectedIds));
      notifications.show({
        title: t('common.success'),
        message: t('notification.bulkEnabled', { count: result.count }),
        color: 'teal',
      });
      setSelectedIds(new Set());
      await fetchUsers();
    } catch {
      notifications.show({
        title: t('common.error'),
        message: t('notification.bulkError'),
        color: 'red',
      });
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkDisable = async () => {
    if (selectedIds.size === 0) return;
    setBulkLoading(true);
    try {
      const result = await bulkDisableUsers(Array.from(selectedIds));
      notifications.show({
        title: t('common.success'),
        message: t('notification.bulkDisabled', { count: result.count }),
        color: 'teal',
      });
      setSelectedIds(new Set());
      await fetchUsers();
    } catch {
      notifications.show({
        title: t('common.error'),
        message: t('notification.bulkError'),
        color: 'red',
      });
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setBulkLoading(true);
    try {
      const result = await bulkDeleteUsers(Array.from(selectedIds));
      notifications.show({
        title: t('common.success'),
        message: t('notification.bulkDeleted', { count: result.count }),
        color: 'teal',
      });
      setSelectedIds(new Set());
      await fetchUsers();
    } catch {
      notifications.show({
        title: t('common.error'),
        message: t('notification.bulkError'),
        color: 'red',
      });
    } finally {
      setBulkLoading(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / size));
  const currentPage = Math.floor(start / size) + 1;

  if (loading && users.length === 0) {
    return <LoadingSkeleton variant="table" rows={6} />;
  }

  if (loadError) {
    return (
      <EmptyState
        icon={IconAlertTriangle}
        title={t('common.error')}
        message={loadError}
      />
    );
  }

  return (
    <Stack gap="lg">
      {/* Header */}
      <Group justify="space-between" wrap="wrap">
        <Group gap="sm">
          <Text size="22px" fw={700} style={{ color: '#C1C2C5' }}>
            {t('users.title')}
          </Text>
          <Badge
            variant="light"
            color="teal"
            size="lg"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            {total}
          </Badge>
        </Group>
        {permissions.canEdit && (
          <Button
            leftSection={<IconPlus size={16} />}
            variant="gradient"
            gradient={{ from: 'teal', to: 'cyan' }}
            radius="md"
            onClick={() => setCreateOpen(true)}
          >
            {t('users.addUser')}
          </Button>
        )}
      </Group>

      {/* Search + Filters */}
      <Group gap="sm" wrap="wrap" align="center">
        <TextInput
          placeholder={t('users.searchPlaceholder')}
          leftSection={<IconSearch size={16} color="#5c5f66" />}
          value={searchInput}
          onChange={(e) => setSearchInput(e.currentTarget.value)}
          radius="md"
          style={{ flex: 1, minWidth: 240 }}
          styles={{
            input: {
              backgroundColor: '#1E2128',
              border: '1px solid rgba(255,255,255,0.06)',
              color: '#C1C2C5',
              height: 42,
            },
          }}
        />
        <Chip.Group
          value={statusFilter}
          onChange={(v) => setStatusFilter(v as UserStatusFilter)}
        >
          <Group gap="xs">
            <Chip value="all" color="teal" radius="md" size="sm">
              All
            </Chip>
            <Chip value="active" color="teal" radius="md" size="sm">
              Active
            </Chip>
            <Chip value="expired" color="red" radius="md" size="sm">
              Expired
            </Chip>
            <Chip value="disabled" color="yellow" radius="md" size="sm">
              Disabled
            </Chip>
          </Group>
        </Chip.Group>
      </Group>

      {/* Bulk actions bar */}
      {selectedIds.size > 0 && permissions.canEdit && (
        <Paper
          p="sm"
          style={{
            ...cardStyle,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flexWrap: 'wrap' as const,
          }}
        >
          <Text size="sm" fw={500} style={{ color: '#909296' }}>
            {t('users.selected', { count: selectedIds.size })}
          </Text>
          <Button
            size="xs"
            variant="light"
            color="teal"
            radius="md"
            leftSection={<IconUserCheck size={14} />}
            loading={bulkLoading}
            onClick={handleBulkEnable}
            styles={{ root: { border: '1px solid rgba(32,201,151,0.2)' } }}
          >
            {t('users.enableAll')}
          </Button>
          <Button
            size="xs"
            variant="light"
            color="yellow"
            radius="md"
            leftSection={<IconUserOff size={14} />}
            loading={bulkLoading}
            onClick={handleBulkDisable}
            styles={{ root: { border: '1px solid rgba(252,196,25,0.2)' } }}
          >
            {t('users.disableAll')}
          </Button>
          <Button
            size="xs"
            variant="light"
            color="red"
            radius="md"
            leftSection={<IconTrash size={14} />}
            loading={bulkLoading}
            onClick={handleBulkDelete}
            styles={{ root: { border: '1px solid rgba(255,107,107,0.2)' } }}
          >
            {t('users.deleteSelected')}
          </Button>
        </Paper>
      )}

      {/* Table */}
      <Paper style={{ ...cardStyle, overflow: 'hidden' }}>
        <Box style={{ overflowX: 'auto' }}>
          <Table
            horizontalSpacing="md"
            verticalSpacing="sm"
            styles={{
              table: {
                borderCollapse: 'separate',
                borderSpacing: 0,
                minWidth: 800,
              },
            }}
          >
            <Table.Thead>
              <Table.Tr
                style={{
                  borderBottom: '1px solid rgba(255,255,255,0.06)',
                  backgroundColor: 'rgba(255,255,255,0.02)',
                }}
              >
                <Table.Th style={{ ...thStyle, width: 40, padding: '12px 16px' }}>
                  <Checkbox
                    checked={users.length > 0 && selectedIds.size === users.length}
                    indeterminate={selectedIds.size > 0 && selectedIds.size < users.length}
                    onChange={toggleAllSelected}
                    color="teal"
                    size="xs"
                  />
                </Table.Th>
                <Table.Th style={thStyle}>
                  <SortableHeader
                    label={t('users.user')}
                    field="email"
                    sortBy={sortBy}
                    sortOrder={sortOrder}
                    onToggle={toggleSort}
                  />
                </Table.Th>
                <Table.Th style={thStyle}>{t('users.status')}</Table.Th>
                <Table.Th style={thStyle}>
                  <SortableHeader
                    label={t('users.traffic')}
                    field="trafficDown"
                    sortBy={sortBy}
                    sortOrder={sortOrder}
                    onToggle={toggleSort}
                  />
                </Table.Th>
                <Table.Th style={thStyle}>{t('users.limit')}</Table.Th>
                <Table.Th style={thStyle}>{t('users.devices')}</Table.Th>
                <Table.Th style={thStyle}>
                  <SortableHeader
                    label={t('users.expiry')}
                    field="expiryDate"
                    sortBy={sortBy}
                    sortOrder={sortOrder}
                    onToggle={toggleSort}
                  />
                </Table.Th>
                <Table.Th style={{ ...thStyle, width: 50 }} />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {users.map((user, idx) => {
                const statusInfo = getStatusInfo(user);
                const trafficPercent = getTrafficPercent(user);
                const totalTraffic = Number(user.trafficUp) + Number(user.trafficDown);
                const sparkData = userSparkline(user);
                // Mock device count based on user id
                const deviceCount = Math.abs(user.id.charCodeAt(0) % 4);

                return (
                  <Table.Tr
                    key={user.id}
                    style={{
                      borderBottom: '1px solid rgba(255,255,255,0.03)',
                      backgroundColor: idx % 2 === 1 ? 'rgba(255,255,255,0.015)' : 'transparent',
                      transition: 'background-color 0.15s ease',
                      cursor: 'pointer',
                    }}
                    onClick={(e) => {
                      // Don't open drawer if clicking on checkbox or menu
                      const target = e.target as HTMLElement;
                      if (
                        target.closest('input[type="checkbox"]') ||
                        target.closest('button') ||
                        target.closest('[role="menu"]') ||
                        target.closest('.mantine-Menu-dropdown')
                      ) {
                        return;
                      }
                      openDrawer(user);
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.backgroundColor = '#252A35';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.backgroundColor =
                        idx % 2 === 1 ? 'rgba(255,255,255,0.015)' : 'transparent';
                    }}
                  >
                    <Table.Td style={{ padding: '12px 16px' }}>
                      <Checkbox
                        checked={selectedIds.has(user.id)}
                        onChange={() => toggleSelected(user.id)}
                        color="teal"
                        size="xs"
                      />
                    </Table.Td>
                    <Table.Td>
                      <Box>
                        <Text size="sm" fw={500} style={{ color: '#C1C2C5' }}>
                          {user.email}
                        </Text>
                        {user.remark && (
                          <Text size="xs" style={{ color: '#5c5f66' }}>
                            {user.remark}
                          </Text>
                        )}
                      </Box>
                    </Table.Td>
                    <Table.Td>
                      <Group gap={6}>
                        <IconCircleFilled size={8} color={statusInfo.dotColor} />
                        <Text size="xs" fw={500} style={{ color: statusInfo.dotColor }}>
                          {t(statusInfo.key)}
                        </Text>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Box>
                        <Group gap={8} wrap="nowrap">
                          <Text size="sm" ff="monospace" fw={500} style={{ color: '#C1C2C5' }}>
                            {formatBytes(String(totalTraffic))}
                          </Text>
                          {/* Mini sparkline */}
                          <Box style={{ width: 50, height: 20 }}>
                            <ResponsiveContainer width="100%" height={20}>
                              <AreaChart data={sparkData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                                <defs>
                                  <linearGradient id={`usg-${user.id}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#339AF0" stopOpacity={0.3} />
                                    <stop offset="100%" stopColor="#339AF0" stopOpacity={0} />
                                  </linearGradient>
                                </defs>
                                <Area
                                  type="monotone"
                                  dataKey="v"
                                  stroke="#339AF0"
                                  strokeWidth={1}
                                  fill={`url(#usg-${user.id})`}
                                  dot={false}
                                  isAnimationActive={false}
                                />
                              </AreaChart>
                            </ResponsiveContainer>
                          </Box>
                        </Group>
                        {trafficPercent !== null && (
                          <Progress
                            value={trafficPercent}
                            size={4}
                            radius="xl"
                            mt={4}
                            color={trafficPercent > 90 ? 'red' : trafficPercent > 70 ? 'yellow' : 'teal'}
                            style={{ width: 80 }}
                            styles={{ root: { backgroundColor: 'rgba(255,255,255,0.06)' } }}
                          />
                        )}
                      </Box>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" ff="monospace" fw={500} style={{ color: '#909296' }}>
                        {user.trafficLimit
                          ? formatBytes(user.trafficLimit)
                          : t('users.unlimited')}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Group gap={4}>
                        <IconDevices size={14} color="#5c5f66" stroke={1.5} />
                        <Text size="sm" ff="monospace" fw={500} style={{ color: '#909296' }}>
                          {deviceCount}
                        </Text>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Group gap={6}>
                        <Text size="sm" style={{ color: '#909296' }}>
                          {user.expiryDate
                            ? new Date(user.expiryDate).toLocaleDateString()
                            : t('users.never')}
                        </Text>
                        {isExpired(user) && (
                          <Badge color="red" variant="light" size="xs" radius="sm">
                            {t('users.expired')}
                          </Badge>
                        )}
                        {!isExpired(user) && isExpiringSoon(user) && (
                          <Badge color="yellow" variant="light" size="xs" radius="sm">
                            {t('users.expiringSoon')}
                          </Badge>
                        )}
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Menu shadow="md" width={200} position="bottom-end">
                        <Menu.Target>
                          <ActionIcon
                            variant="subtle"
                            color="gray"
                            radius="md"
                            style={{ color: '#5c5f66' }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <IconDotsVertical size={16} />
                          </ActionIcon>
                        </Menu.Target>
                        <Menu.Dropdown
                          style={{
                            backgroundColor: '#1E2128',
                            border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: 10,
                          }}
                        >
                          <Menu.Item
                            leftSection={<IconUser size={14} />}
                            onClick={(e) => {
                              e.stopPropagation();
                              openDrawer(user);
                            }}
                            style={{ fontSize: '13px' }}
                          >
                            Edit
                          </Menu.Item>
                          <Menu.Item
                            leftSection={<IconCopy size={14} />}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopySubLink(user);
                            }}
                            style={{ fontSize: '13px' }}
                          >
                            {t('users.copySubLink')}
                          </Menu.Item>
                          {permissions.canEdit && (
                            <>
                              <Menu.Item
                                leftSection={<IconToggleLeft size={14} />}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggle(user.id);
                                }}
                                style={{ fontSize: '13px' }}
                              >
                                {user.enabled ? t('users.disable') : t('users.enable')}
                              </Menu.Item>
                              <Menu.Item
                                leftSection={<IconCalendarPlus size={14} />}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRenew(user.id);
                                }}
                                style={{ fontSize: '13px' }}
                              >
                                {t('users.renew')}
                              </Menu.Item>
                              <Menu.Item
                                leftSection={<IconRefresh size={14} />}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleResetTraffic(user.id);
                                }}
                                style={{ fontSize: '13px' }}
                              >
                                {t('users.resetTraffic')}
                              </Menu.Item>
                            </>
                          )}
                          {permissions.canDelete && (
                            <>
                              <Menu.Divider style={{ borderColor: 'rgba(255,255,255,0.06)' }} />
                              <Menu.Item
                                color="red"
                                leftSection={<IconTrash size={14} />}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(user.id);
                                }}
                                style={{ fontSize: '13px' }}
                              >
                                {t('users.delete')}
                              </Menu.Item>
                            </>
                          )}
                        </Menu.Dropdown>
                      </Menu>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
              {users.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={8}>
                    <Box
                      py={48}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      <IconUsers size={40} color="#373A40" stroke={1} />
                      <Text ta="center" size="sm" style={{ color: '#5c5f66' }}>
                        {debouncedSearch
                          ? t('users.noUsersMatch')
                          : t('users.noUsersYet')}
                      </Text>
                    </Box>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </Box>
      </Paper>

      {/* Pagination + page size */}
      <Group justify="space-between" wrap="wrap" gap="md">
        <Group gap="xs" align="center">
          <Text size="xs" style={{ color: '#5c5f66' }}>
            Rows per page
          </Text>
          <Select
            data={['10', '25', '50', '100']}
            value={String(size)}
            onChange={(v) => v && setSize(Number(v))}
            w={80}
            size="xs"
            allowDeselect={false}
            styles={inputStyles}
          />
          <Text size="xs" style={{ color: '#5c5f66' }}>
            {total === 0
              ? '0'
              : `${start + 1}-${Math.min(start + size, total)} of ${total}`}
          </Text>
        </Group>
        <Pagination
          total={totalPages}
          value={currentPage}
          onChange={setPage}
          color="teal"
          radius="md"
          size="sm"
          siblings={1}
          boundaries={1}
        />
      </Group>

      {/* User detail drawer */}
      <UserDrawer
        user={drawerUser}
        opened={drawerOpen}
        onClose={closeDrawer}
        onSaved={fetchUsers}
        canEdit={permissions.canEdit}
        canDelete={permissions.canDelete}
      />

      {/* Create User Modal */}
      <Modal
        opened={createOpen}
        onClose={() => setCreateOpen(false)}
        title={t('users.addUser')}
        radius="lg"
        styles={{
          content: {
            backgroundColor: '#1E2128',
            border: '1px solid rgba(255,255,255,0.06)',
          },
          header: {
            backgroundColor: '#1E2128',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          },
          title: { color: '#C1C2C5', fontWeight: 600 },
          close: { color: '#909296' },
        }}
      >
        <Stack gap="md" mt="md">
          <TextInput
            label={t('users.email')}
            placeholder="user@example.com"
            value={createForm.values.email}
            onChange={(e) =>
              createForm.setFieldValue('email', e.currentTarget.value)
            }
            onBlur={() => createForm.setFieldTouched('email', true)}
            error={createForm.getInputProps('email').error}
            styles={inputStyles}
          />
          <TextInput
            label={t('users.remark')}
            placeholder="Optional note"
            value={createForm.values.remark}
            onChange={(e) =>
              createForm.setFieldValue('remark', e.currentTarget.value)
            }
            styles={inputStyles}
          />
          <NumberInput
            label="Data Limit (GB)"
            description="Enter data limit in GB, 0 for unlimited"
            placeholder="Leave empty for unlimited"
            value={createForm.values.trafficLimitGB}
            onChange={(v) =>
              createForm.setFieldValue(
                'trafficLimitGB',
                v === '' ? '' : Number(v),
              )
            }
            onBlur={() => createForm.setFieldTouched('trafficLimitGB', true)}
            error={createForm.getInputProps('trafficLimitGB').error}
            min={0}
            max={100000}
            styles={inputStyles}
          />
          <NumberInput
            label={t('users.devices')}
            placeholder="0"
            value={createForm.values.maxDevices}
            onChange={(v) =>
              createForm.setFieldValue(
                'maxDevices',
                v === '' ? '' : Number(v),
              )
            }
            onBlur={() => createForm.setFieldTouched('maxDevices', true)}
            error={createForm.getInputProps('maxDevices').error}
            min={0}
            styles={inputStyles}
          />
          <DateInput
            label={t('users.expiryDate')}
            placeholder="Leave empty for no expiry"
            value={createForm.values.expiryDate}
            onChange={(v) => createForm.setFieldValue('expiryDate', v)}
            clearable
            styles={inputStyles}
          />
          <Button
            variant="gradient"
            gradient={{ from: 'teal', to: 'cyan' }}
            loading={creating}
            onClick={handleCreate}
            disabled={!createForm.isValid || creating}
            radius="md"
            fullWidth
          >
            {t('users.createUser')}
          </Button>
        </Stack>
      </Modal>
    </Stack>
  );
}

export default UsersPage;
