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
  Loader,
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
} from '@tabler/icons-react';
import {
  getUsers,
  createUser,
  toggleUser,
  deleteUser,
  bulkEnableUsers,
  bulkDisableUsers,
  bulkDeleteUsers,
} from '../api/users';
import type { User } from '../types';

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

function getStatusInfo(user: User): { label: string; dotColor: string } {
  if (!user.enabled) {
    return { label: 'Disabled', dotColor: '#ff6b6b' };
  }
  if (isExpired(user)) {
    return { label: 'Expired', dotColor: '#ff6b6b' };
  }
  if (isLimitExceeded(user)) {
    return { label: 'Limit Exceeded', dotColor: '#ff6b6b' };
  }
  if (isExpiringSoon(user)) {
    return { label: 'Expiring Soon', dotColor: '#FCC419' };
  }
  return { label: 'Active', dotColor: '#51cf66' };
}

export function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newRemark, setNewRemark] = useState('');
  const [newTrafficLimitGB, setNewTrafficLimitGB] = useState<number | ''>('');
  const [newExpiryDate, setNewExpiryDate] = useState<Date | null>(null);
  const [creating, setCreating] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      const data = await getUsers();
      setUsers(data);
    } catch {
      notifications.show({
        title: 'Error',
        message: 'Failed to load users',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleCreate = async () => {
    if (!newEmail) return;
    setCreating(true);
    try {
      await createUser({
        email: newEmail,
        remark: newRemark || undefined,
        trafficLimit:
          newTrafficLimitGB !== '' ? gbToBytes(newTrafficLimitGB) : undefined,
        expiryDate: newExpiryDate
          ? newExpiryDate.toISOString()
          : undefined,
      });
      setCreateOpen(false);
      setNewEmail('');
      setNewRemark('');
      setNewTrafficLimitGB('');
      setNewExpiryDate(null);
      notifications.show({
        title: 'Success',
        message: 'User created',
        color: 'teal',
      });
      await fetchUsers();
    } catch {
      notifications.show({
        title: 'Error',
        message: 'Failed to create user',
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
        title: 'Error',
        message: 'Failed to toggle user',
        color: 'red',
      });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteUser(id);
      notifications.show({
        title: 'Success',
        message: 'User deleted',
        color: 'teal',
      });
      await fetchUsers();
    } catch {
      notifications.show({
        title: 'Error',
        message: 'Failed to delete user',
        color: 'red',
      });
    }
  };

  const handleCopySubLink = (user: User) => {
    const link = `${window.location.origin}/sub/${user.subToken}`;
    navigator.clipboard.writeText(link);
    notifications.show({
      title: 'Copied',
      message: 'Subscription link copied to clipboard',
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
        title: 'Success',
        message: `${result.count} users enabled`,
        color: 'teal',
      });
      setSelectedIds(new Set());
      await fetchUsers();
    } catch {
      notifications.show({
        title: 'Error',
        message: 'Failed to enable users',
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
        title: 'Success',
        message: `${result.count} users disabled`,
        color: 'teal',
      });
      setSelectedIds(new Set());
      await fetchUsers();
    } catch {
      notifications.show({
        title: 'Error',
        message: 'Failed to disable users',
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
        title: 'Success',
        message: `${result.count} users deleted`,
        color: 'teal',
      });
      setSelectedIds(new Set());
      await fetchUsers();
    } catch {
      notifications.show({
        title: 'Error',
        message: 'Failed to delete users',
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
    return (
      <Box
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: 400,
        }}
      >
        <Loader color="teal" />
      </Box>
    );
  }

  return (
    <Stack gap="lg">
      {/* Header */}
      <Group justify="space-between">
        <Group gap="sm">
          <Text size="22px" fw={700} style={{ color: '#C1C2C5' }}>
            Users
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
        <Button
          leftSection={<IconPlus size={16} />}
          variant="gradient"
          gradient={{ from: 'teal', to: 'cyan' }}
          radius="md"
          onClick={() => setCreateOpen(true)}
        >
          Add User
        </Button>
      </Group>

      {/* Search */}
      <TextInput
        placeholder="Search by email or remark..."
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
      {selectedIds.size > 0 && (
        <Paper
          p="sm"
          style={{
            ...cardStyle,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <Text size="sm" fw={500} style={{ color: '#909296' }}>
            {selectedIds.size} selected
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
            Enable All
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
            Disable All
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
            Delete Selected
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
              table: { borderCollapse: 'separate', borderSpacing: 0 },
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
                <Table.Th style={thStyle}>User</Table.Th>
                <Table.Th style={thStyle}>Status</Table.Th>
                <Table.Th style={thStyle}>Traffic</Table.Th>
                <Table.Th style={thStyle}>Limit</Table.Th>
                <Table.Th style={thStyle}>Expiry</Table.Th>
                <Table.Th style={{ ...thStyle, width: 50 }} />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filteredUsers.map((user, idx) => {
                const statusInfo = getStatusInfo(user);
                const trafficPercent = getTrafficPercent(user);
                const totalTraffic = Number(user.trafficUp) + Number(user.trafficDown);

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
                          {statusInfo.label}
                        </Text>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Box>
                        <Text size="sm" ff="monospace" fw={500} style={{ color: '#C1C2C5' }}>
                          {formatBytes(String(totalTraffic))}
                        </Text>
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
                          : 'Unlimited'}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Group gap={6}>
                        <Text size="sm" style={{ color: '#909296' }}>
                          {user.expiryDate
                            ? new Date(user.expiryDate).toLocaleDateString()
                            : 'Never'}
                        </Text>
                        {isExpired(user) && (
                          <Badge color="red" variant="light" size="xs" radius="sm">
                            Expired
                          </Badge>
                        )}
                        {!isExpired(user) && isExpiringSoon(user) && (
                          <Badge color="yellow" variant="light" size="xs" radius="sm">
                            Soon
                          </Badge>
                        )}
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Menu shadow="md" width={180} position="bottom-end">
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
                            Copy Sub Link
                          </Menu.Item>
                          <Menu.Item
                            leftSection={<IconToggleLeft size={14} />}
                            onClick={() => handleToggle(user.id)}
                            style={{ fontSize: '13px' }}
                          >
                            {user.enabled ? 'Disable' : 'Enable'}
                          </Menu.Item>
                          <Menu.Divider style={{ borderColor: 'rgba(255,255,255,0.06)' }} />
                          <Menu.Item
                            color="red"
                            leftSection={<IconTrash size={14} />}
                            onClick={() => handleDelete(user.id)}
                            style={{ fontSize: '13px' }}
                          >
                            Delete
                          </Menu.Item>
                        </Menu.Dropdown>
                      </Menu>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
              {filteredUsers.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={7}>
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
                        {search ? 'No users match your search' : 'No users yet'}
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
        title="Add User"
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
            label="Email"
            placeholder="user@example.com"
            value={newEmail}
            onChange={(e) => setNewEmail(e.currentTarget.value)}
            styles={inputStyles}
          />
          <TextInput
            label="Remark"
            placeholder="Optional note"
            value={newRemark}
            onChange={(e) => setNewRemark(e.currentTarget.value)}
            styles={inputStyles}
          />
          <NumberInput
            label="Traffic Limit (GB)"
            placeholder="Leave empty for unlimited"
            value={newTrafficLimitGB}
            onChange={(v) =>
              setNewTrafficLimitGB(v === '' ? '' : Number(v))
            }
            min={0}
            styles={inputStyles}
          />
          <DateInput
            label="Expiry Date"
            placeholder="Leave empty for no expiry"
            value={newExpiryDate}
            onChange={setNewExpiryDate}
            clearable
            styles={inputStyles}
          />
          <Button
            variant="gradient"
            gradient={{ from: 'teal', to: 'cyan' }}
            loading={creating}
            onClick={handleCreate}
            radius="md"
            fullWidth
          >
            Create User
          </Button>
        </Stack>
      </Modal>
    </Stack>
  );
}
