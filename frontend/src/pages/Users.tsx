import { useEffect, useState, useCallback } from 'react';
import { ActionIcon, Badge, Box, Button, Card, Group, Loader, Modal, Stack, Table, Text, TextInput, Title, Tooltip } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconPlayerPlay, IconPlayerStop, IconPlus, IconTrash, IconLink } from '@tabler/icons-react';
import { getUsers, createUser, deleteUser, toggleUser, getUserSubscription, User } from '../api/users';

function formatBytes(s: string): string {
  const b = Number(s); if (b === 0) return '0 B';
  const k = 1024, sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(b) / Math.log(k));
  return parseFloat((b / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function statusBadge(u: User) {
  if (!u.enabled) return <Badge color="red" variant="light">Disabled</Badge>;
  if (u.expiryDate) {
    const days = Math.ceil((new Date(u.expiryDate).getTime() - Date.now()) / 86400000);
    if (days <= 0) return <Badge color="red" variant="light">Expired</Badge>;
    if (days <= 7) return <Badge color="yellow" variant="light">Expiring ({days}d)</Badge>;
  }
  return <Badge color="teal" variant="light">Active</Badge>;
}

const glass = { backgroundColor: 'rgba(11, 17, 33, 0.6)', backdropFilter: 'blur(12px)', border: '1px solid rgba(85, 104, 128, 0.2)' };

export function Users() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchUsers = useCallback(async () => {
    try { setUsers(await getUsers()); } catch { notifications.show({ title: 'Error', message: 'Failed to load users', color: 'red' }); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleCreate = async () => {
    if (!newEmail.trim()) return; setCreating(true);
    try { await createUser(newEmail.trim()); notifications.show({ title: 'Success', message: 'User created', color: 'teal' }); setNewEmail(''); setModalOpen(false); await fetchUsers(); }
    catch { notifications.show({ title: 'Error', message: 'Failed to create user', color: 'red' }); }
    finally { setCreating(false); }
  };

  const handleToggle = async (id: string) => { try { await toggleUser(id); await fetchUsers(); } catch { notifications.show({ title: 'Error', message: 'Failed to toggle user', color: 'red' }); } };
  const handleDelete = async (id: string) => { try { await deleteUser(id); notifications.show({ title: 'Success', message: 'User deleted', color: 'teal' }); await fetchUsers(); } catch { notifications.show({ title: 'Error', message: 'Failed to delete user', color: 'red' }); } };

  const handleCopySubLink = async (id: string) => {
    try {
      const sub = await getUserSubscription(id);
      await navigator.clipboard.writeText(`${window.location.origin}${sub.subscriptionUrl}`);
      notifications.show({ title: 'Copied', message: 'Subscription link copied', color: 'teal' });
    } catch { notifications.show({ title: 'Error', message: 'Failed to copy link', color: 'red' }); }
  };

  if (loading) return <Stack align="center" justify="center" h="60vh"><Loader color="teal" size="lg" /></Stack>;

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Title order={2} c="white">Users</Title>
        <Button leftSection={<IconPlus size={16} stroke={1.5} />} variant="gradient" gradient={{ from: 'teal', to: 'cyan', deg: 135 }} onClick={() => setModalOpen(true)}>Add User</Button>
      </Group>
      <Card radius="md" p={0} style={glass}>
        <Box style={{ overflowX: 'auto' }}>
          <Table striped={false} highlightOnHover verticalSpacing="sm" horizontalSpacing="md">
            <Table.Thead>
              <Table.Tr>
                <Table.Th c="dimmed">Email</Table.Th><Table.Th c="dimmed">Status</Table.Th>
                <Table.Th c="dimmed">Traffic</Table.Th><Table.Th c="dimmed">Expiry</Table.Th>
                <Table.Th c="dimmed" ta="right">Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {users.length === 0 && <Table.Tr><Table.Td colSpan={5}><Text ta="center" c="dimmed" py="xl">No users yet. Click &quot;Add User&quot; to create one.</Text></Table.Td></Table.Tr>}
              {users.map((u) => (
                <Table.Tr key={u.id}>
                  <Table.Td><Text size="sm" c="white" ff="monospace">{u.email}</Text></Table.Td>
                  <Table.Td>{statusBadge(u)}</Table.Td>
                  <Table.Td><Text size="sm" c="dimmed">{formatBytes(u.trafficUp)} / {formatBytes(u.trafficDown)}</Text></Table.Td>
                  <Table.Td><Text size="sm" c="dimmed">{u.expiryDate ? new Date(u.expiryDate).toLocaleDateString() : 'Never'}</Text></Table.Td>
                  <Table.Td>
                    <Group gap={4} justify="flex-end">
                      <Tooltip label="Copy subscription link"><ActionIcon variant="subtle" color="teal" onClick={() => handleCopySubLink(u.id)}><IconLink size={16} stroke={1.5} /></ActionIcon></Tooltip>
                      <Tooltip label={u.enabled ? 'Disable' : 'Enable'}><ActionIcon variant="subtle" color={u.enabled ? 'yellow' : 'teal'} onClick={() => handleToggle(u.id)}>{u.enabled ? <IconPlayerStop size={16} stroke={1.5} /> : <IconPlayerPlay size={16} stroke={1.5} />}</ActionIcon></Tooltip>
                      <Tooltip label="Delete"><ActionIcon variant="subtle" color="red" onClick={() => handleDelete(u.id)}><IconTrash size={16} stroke={1.5} /></ActionIcon></Tooltip>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Box>
      </Card>
      <Modal opened={modalOpen} onClose={() => setModalOpen(false)} title="Add New User" centered
        styles={{ content: { backgroundColor: 'var(--mantine-color-dark-7)', border: '1px solid rgba(85, 104, 128, 0.2)' }, header: { backgroundColor: 'var(--mantine-color-dark-7)' } }}>
        <Stack gap="md">
          <TextInput label="Email" placeholder="user@example.com" value={newEmail} onChange={(e) => setNewEmail(e.currentTarget.value)} required
            styles={{ input: { backgroundColor: 'rgba(26, 41, 64, 0.5)', borderColor: 'rgba(85, 104, 128, 0.3)' } }} />
          <Button fullWidth loading={creating} onClick={handleCreate} variant="gradient" gradient={{ from: 'teal', to: 'cyan', deg: 135 }}>Create User</Button>
        </Stack>
      </Modal>
    </Stack>
  );
}
