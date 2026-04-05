import { useEffect, useState, useCallback } from 'react';
import {
  Table,
  Button,
  Group,
  Text,
  TextInput,
  NumberInput,
  Modal,
  Stack,
  ActionIcon,
  Menu,
  Box,
  Checkbox,
  Progress,
  Paper,
  Badge,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
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
} from '@tabler/icons-react';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { useTranslation } from 'react-i18next';
import {
  getUsers,
  createUser,
  toggleUser,
  deleteUser,
  bulkEnableUsers,
  bulkDisableUsers,
  bulkDeleteUsers,
  renewUser,
  resetUserTraffic,
} from '../api/users';
import type { User } from '../types';
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
  return gb * 1024 * 1024 * 1024;
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

export function UsersPage() {
  const { t } = useTranslation();
  const permissions = usePermissions();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

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

  const fetchUsers = useCallback(async () => {
    setLoadError(null);
    try {
      const data = await getUsers();
      setUsers(data);
    } catch (err) {
      const message = extractErrorMessage(err);
      setLoadError(message);
      notifications.show({
        title: t('common.error'),
        message: t('notification.usersError'),
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

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
    if (selectedIds.size === filteredUsers.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredUsers.map((u) => u.id)));
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

  const filteredUsers = users.filter(
    (u) =>
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      (u.remark?.toLowerCase().includes(search.toLowerCase()) ?? false),
  );

  if (loading) {
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
            {users.length}
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

      {/* Search */}
      <TextInput
        placeholder={t('users.searchPlaceholder')}
        leftSection={<IconSearch size={16} color="#5c5f66" />}
        value={search}
        onChange={(e) => setSearch(e.currentTarget.value)}
        radius="md"
        styles={{
          input: {
            backgroundColor: '#1E2128',
            border: '1px solid rgba(255,255,255,0.06)',
            color: '#C1C2C5',
            height: 42,
          },
        }}
      />

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
                    checked={filteredUsers.length > 0 && selectedIds.size === filteredUsers.length}
                    indeterminate={selectedIds.size > 0 && selectedIds.size < filteredUsers.length}
                    onChange={toggleAllSelected}
                    color="teal"
                    size="xs"
                  />
                </Table.Th>
                <Table.Th style={thStyle}>{t('users.user')}</Table.Th>
                <Table.Th style={thStyle}>{t('users.status')}</Table.Th>
                <Table.Th style={thStyle}>{t('users.traffic')}</Table.Th>
                <Table.Th style={thStyle}>{t('users.limit')}</Table.Th>
                <Table.Th style={thStyle}>{t('users.devices')}</Table.Th>
                <Table.Th style={thStyle}>{t('users.expiry')}</Table.Th>
                <Table.Th style={{ ...thStyle, width: 50 }} />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filteredUsers.map((user, idx) => {
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
                          <ActionIcon variant="subtle" color="gray" radius="md" style={{ color: '#5c5f66' }}>
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
                            leftSection={<IconCopy size={14} />}
                            onClick={() => handleCopySubLink(user)}
                            style={{ fontSize: '13px' }}
                          >
                            {t('users.copySubLink')}
                          </Menu.Item>
                          {permissions.canEdit && (
                            <>
                              <Menu.Item
                                leftSection={<IconToggleLeft size={14} />}
                                onClick={() => handleToggle(user.id)}
                                style={{ fontSize: '13px' }}
                              >
                                {user.enabled ? t('users.disable') : t('users.enable')}
                              </Menu.Item>
                              <Menu.Item
                                leftSection={<IconCalendarPlus size={14} />}
                                onClick={() => handleRenew(user.id)}
                                style={{ fontSize: '13px' }}
                              >
                                {t('users.renew')}
                              </Menu.Item>
                              <Menu.Item
                                leftSection={<IconRefresh size={14} />}
                                onClick={() => handleResetTraffic(user.id)}
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
                                onClick={() => handleDelete(user.id)}
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
              {filteredUsers.length === 0 && (
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
                        {search ? t('users.noUsersMatch') : t('users.noUsersYet')}
                      </Text>
                    </Box>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </Box>
      </Paper>

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
            label={t('users.trafficLimitGB')}
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
