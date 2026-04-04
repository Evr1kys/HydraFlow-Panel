import { useEffect, useState, useCallback } from 'react';
import {
  Table,
  Button,
  Group,
  Text,
  Badge,
  TextInput,
  NumberInput,
  Modal,
  Stack,
  ActionIcon,
  Menu,
  Box,
  Title,
  Loader,
  Checkbox,
  Progress,
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

function getStatusBadge(user: User) {
  if (!user.enabled) {
    return (
      <Badge color="red" variant="light">
        Disabled
      </Badge>
    );
  }
  if (isExpired(user)) {
    return (
      <Badge color="red" variant="light">
        Expired
      </Badge>
    );
  }
  if (isLimitExceeded(user)) {
    return (
      <Badge color="red" variant="light">
        Limit Exceeded
      </Badge>
    );
  }
  if (isExpiringSoon(user)) {
    return (
      <Badge color="yellow" variant="light">
        Expiring Soon
      </Badge>
    );
  }
  return (
    <Badge color="teal" variant="light">
      Active
    </Badge>
  );
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

  const inputStyles = {
    input: {
      backgroundColor: '#060a12',
      borderColor: '#1a2940',
      color: '#d0d7e3',
    },
    label: { color: '#97a8c2' },
  };

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
      <Group justify="space-between">
        <Title order={2} style={{ color: '#d0d7e3' }}>
          Users
        </Title>
        <Button
          leftSection={<IconPlus size={16} />}
          variant="gradient"
          gradient={{ from: 'teal', to: 'cyan' }}
          onClick={() => setCreateOpen(true)}
        >
          Add User
        </Button>
      </Group>

      <TextInput
        placeholder="Search by email or remark..."
        leftSection={<IconSearch size={16} />}
        value={search}
        onChange={(e) => setSearch(e.currentTarget.value)}
        styles={{
          input: {
            backgroundColor: '#0b1121',
            borderColor: '#1a2940',
            color: '#d0d7e3',
          },
        }}
      />

      {selectedIds.size > 0 && (
        <Group
          gap="sm"
          p="sm"
          style={{
            backgroundColor: '#0b1121',
            border: '1px solid #1a2940',
            borderRadius: 8,
          }}
        >
          <Text size="sm" style={{ color: '#97a8c2' }}>
            {selectedIds.size} selected
          </Text>
          <Button
            size="xs"
            variant="light"
            color="teal"
            leftSection={<IconUserCheck size={14} />}
            loading={bulkLoading}
            onClick={handleBulkEnable}
          >
            Enable All
          </Button>
          <Button
            size="xs"
            variant="light"
            color="yellow"
            leftSection={<IconUserOff size={14} />}
            loading={bulkLoading}
            onClick={handleBulkDisable}
          >
            Disable All
          </Button>
          <Button
            size="xs"
            variant="light"
            color="red"
            leftSection={<IconTrash size={14} />}
            loading={bulkLoading}
            onClick={handleBulkDelete}
          >
            Delete Selected
          </Button>
        </Group>
      )}

      <Box
        style={{
          backgroundColor: '#0b1121',
          border: '1px solid #1a2940',
          borderRadius: 8,
          overflow: 'auto',
        }}
      >
        <Table horizontalSpacing="md" verticalSpacing="sm">
          <Table.Thead>
            <Table.Tr style={{ borderBottom: '1px solid #1a2940' }}>
              <Table.Th style={{ width: 40 }}>
                <Checkbox
                  checked={
                    filteredUsers.length > 0 &&
                    selectedIds.size === filteredUsers.length
                  }
                  indeterminate={
                    selectedIds.size > 0 &&
                    selectedIds.size < filteredUsers.length
                  }
                  onChange={toggleAllSelected}
                  color="teal"
                />
              </Table.Th>
              <Table.Th style={{ color: '#97a8c2' }}>Email</Table.Th>
              <Table.Th style={{ color: '#97a8c2' }}>Status</Table.Th>
              <Table.Th style={{ color: '#97a8c2' }}>Traffic</Table.Th>
              <Table.Th style={{ color: '#97a8c2' }}>Limit</Table.Th>
              <Table.Th style={{ color: '#97a8c2' }}>Expiry</Table.Th>
              <Table.Th style={{ color: '#97a8c2' }}>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {filteredUsers.map((user) => {
              const trafficPercent = getTrafficPercent(user);
              const totalTraffic =
                Number(user.trafficUp) + Number(user.trafficDown);

              return (
                <Table.Tr
                  key={user.id}
                  style={{ borderBottom: '1px solid #111b30' }}
                >
                  <Table.Td>
                    <Checkbox
                      checked={selectedIds.has(user.id)}
                      onChange={() => toggleSelected(user.id)}
                      color="teal"
                    />
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" style={{ color: '#d0d7e3' }}>
                      {user.email}
                    </Text>
                    {user.remark && (
                      <Text size="xs" c="dimmed">
                        {user.remark}
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td>{getStatusBadge(user)}</Table.Td>
                  <Table.Td>
                    <Stack gap={4}>
                      <Text size="sm" ff="monospace" style={{ color: '#d0d7e3' }}>
                        {formatBytes(String(totalTraffic))}
                      </Text>
                      {trafficPercent !== null && (
                        <Progress
                          value={trafficPercent}
                          size="sm"
                          color={
                            trafficPercent >= 90
                              ? 'red'
                              : trafficPercent >= 70
                                ? 'yellow'
                                : 'teal'
                          }
                          style={{ width: 80 }}
                        />
                      )}
                    </Stack>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" ff="monospace" style={{ color: '#d0d7e3' }}>
                      {user.trafficLimit
                        ? formatBytes(user.trafficLimit)
                        : 'Unlimited'}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap={6}>
                      <Text size="sm" style={{ color: '#d0d7e3' }}>
                        {user.expiryDate
                          ? new Date(user.expiryDate).toLocaleDateString()
                          : 'Never'}
                      </Text>
                      {isExpired(user) && (
                        <Badge color="red" variant="light" size="xs">
                          Expired
                        </Badge>
                      )}
                      {!isExpired(user) && isExpiringSoon(user) && (
                        <Badge color="yellow" variant="light" size="xs">
                          Soon
                        </Badge>
                      )}
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Menu shadow="md" width={180}>
                      <Menu.Target>
                        <ActionIcon variant="subtle" color="gray">
                          <IconDotsVertical size={16} />
                        </ActionIcon>
                      </Menu.Target>
                      <Menu.Dropdown
                        style={{
                          backgroundColor: '#111b30',
                          borderColor: '#1a2940',
                        }}
                      >
                        <Menu.Item
                          leftSection={<IconCopy size={14} />}
                          onClick={() => handleCopySubLink(user)}
                        >
                          Copy Sub Link
                        </Menu.Item>
                        <Menu.Item
                          leftSection={<IconToggleLeft size={14} />}
                          onClick={() => handleToggle(user.id)}
                        >
                          {user.enabled ? 'Disable' : 'Enable'}
                        </Menu.Item>
                        <Menu.Divider />
                        <Menu.Item
                          color="red"
                          leftSection={<IconTrash size={14} />}
                          onClick={() => handleDelete(user.id)}
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
                  <Text ta="center" c="dimmed" py="xl">
                    {search ? 'No users match your search' : 'No users yet'}
                  </Text>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Box>

      <Modal
        opened={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Add User"
        styles={{
          content: { backgroundColor: '#0b1121', borderColor: '#1a2940' },
          header: { backgroundColor: '#0b1121' },
          title: { color: '#d0d7e3' },
        }}
      >
        <Stack gap="md">
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
          >
            Create User
          </Button>
        </Stack>
      </Modal>
    </Stack>
  );
}
