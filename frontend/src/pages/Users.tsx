import { useEffect, useState, useCallback } from 'react';
import {
  Table,
  Button,
  Group,
  Text,
  Badge,
  TextInput,
  Modal,
  Stack,
  ActionIcon,
  Menu,
  Box,
  Title,
  Loader,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconPlus,
  IconSearch,
  IconDotsVertical,
  IconCopy,
  IconToggleLeft,
  IconTrash,
} from '@tabler/icons-react';
import { getUsers, createUser, toggleUser, deleteUser } from '../api/users';
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

function getStatusBadge(user: User) {
  if (!user.enabled) {
    return (
      <Badge color="red" variant="light">
        Disabled
      </Badge>
    );
  }
  if (
    user.expiryDate &&
    new Date(user.expiryDate) <
      new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
  ) {
    if (new Date(user.expiryDate) < new Date()) {
      return (
        <Badge color="red" variant="light">
          Expired
        </Badge>
      );
    }
    return (
      <Badge color="yellow" variant="light">
        Expiring
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
  const [creating, setCreating] = useState(false);

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
      await createUser({ email: newEmail });
      setCreateOpen(false);
      setNewEmail('');
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
              <Table.Th style={{ color: '#97a8c2' }}>Email</Table.Th>
              <Table.Th style={{ color: '#97a8c2' }}>Status</Table.Th>
              <Table.Th style={{ color: '#97a8c2' }}>Traffic Up</Table.Th>
              <Table.Th style={{ color: '#97a8c2' }}>Traffic Down</Table.Th>
              <Table.Th style={{ color: '#97a8c2' }}>Limit</Table.Th>
              <Table.Th style={{ color: '#97a8c2' }}>Expiry</Table.Th>
              <Table.Th style={{ color: '#97a8c2' }}>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {filteredUsers.map((user) => (
              <Table.Tr
                key={user.id}
                style={{ borderBottom: '1px solid #111b30' }}
              >
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
                  <Text size="sm" ff="monospace" style={{ color: '#d0d7e3' }}>
                    {formatBytes(user.trafficUp)}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" ff="monospace" style={{ color: '#d0d7e3' }}>
                    {formatBytes(user.trafficDown)}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" ff="monospace" style={{ color: '#d0d7e3' }}>
                    {user.trafficLimit
                      ? formatBytes(user.trafficLimit)
                      : 'Unlimited'}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" style={{ color: '#d0d7e3' }}>
                    {user.expiryDate
                      ? new Date(user.expiryDate).toLocaleDateString()
                      : 'Never'}
                  </Text>
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
            ))}
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
            styles={{
              input: {
                backgroundColor: '#060a12',
                borderColor: '#1a2940',
                color: '#d0d7e3',
              },
              label: { color: '#97a8c2' },
            }}
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
