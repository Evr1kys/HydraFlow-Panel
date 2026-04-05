import { useCallback, useEffect, useState } from 'react';
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Group,
  Loader,
  Menu,
  Modal,
  Paper,
  PasswordInput,
  Select,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconDotsVertical,
  IconKey,
  IconPlus,
  IconTrash,
  IconUserCog,
  IconUserShield,
} from '@tabler/icons-react';
import {
  createAdmin,
  deleteAdmin,
  listAdmins,
  resetAdminPassword,
  updateAdmin,
  type AdminEntry,
  type AdminRole,
} from '../api/admins';

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

const ROLE_OPTIONS: { value: AdminRole; label: string }[] = [
  { value: 'superadmin', label: 'superadmin' },
  { value: 'admin', label: 'admin' },
  { value: 'operator', label: 'operator' },
  { value: 'readonly', label: 'readonly' },
];

function roleColor(role: string): string {
  switch (role) {
    case 'superadmin':
      return 'red';
    case 'admin':
      return 'teal';
    case 'operator':
      return 'blue';
    default:
      return 'gray';
  }
}

export function AdminsPage() {
  const [admins, setAdmins] = useState<AdminEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<AdminRole>('admin');
  const [creating, setCreating] = useState(false);

  const [resetTarget, setResetTarget] = useState<AdminEntry | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resetting, setResetting] = useState(false);

  const fetchAdmins = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listAdmins();
      setAdmins(data);
    } catch {
      notifications.show({
        title: 'Error',
        message: 'Failed to load admins',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAdmins();
  }, [fetchAdmins]);

  const handleCreate = async () => {
    if (!newEmail || !newPassword) return;
    setCreating(true);
    try {
      await createAdmin({ email: newEmail, password: newPassword, role: newRole });
      notifications.show({ title: 'Success', message: 'Admin created', color: 'teal' });
      setCreateOpen(false);
      setNewEmail('');
      setNewPassword('');
      setNewRole('admin');
      await fetchAdmins();
    } catch {
      notifications.show({
        title: 'Error',
        message: 'Failed to create admin',
        color: 'red',
      });
    } finally {
      setCreating(false);
    }
  };

  const handleChangeRole = async (id: string, role: AdminRole) => {
    try {
      await updateAdmin(id, { role });
      await fetchAdmins();
    } catch {
      notifications.show({
        title: 'Error',
        message: 'Failed to change role',
        color: 'red',
      });
    }
  };

  const handleToggleEnabled = async (a: AdminEntry) => {
    try {
      await updateAdmin(a.id, { enabled: !a.enabled });
      await fetchAdmins();
    } catch {
      notifications.show({
        title: 'Error',
        message: 'Failed to update',
        color: 'red',
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this admin?')) return;
    try {
      await deleteAdmin(id);
      notifications.show({ title: 'Success', message: 'Admin deleted', color: 'teal' });
      await fetchAdmins();
    } catch {
      notifications.show({
        title: 'Error',
        message: 'Failed to delete admin',
        color: 'red',
      });
    }
  };

  const handleResetPassword = async () => {
    if (!resetTarget || !resetPassword) return;
    setResetting(true);
    try {
      await resetAdminPassword(resetTarget.id, resetPassword);
      notifications.show({ title: 'Success', message: 'Password reset', color: 'teal' });
      setResetTarget(null);
      setResetPassword('');
    } catch {
      notifications.show({
        title: 'Error',
        message: 'Failed to reset password',
        color: 'red',
      });
    } finally {
      setResetting(false);
    }
  };

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Group gap="sm">
          <Box
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              backgroundColor: 'rgba(32,201,151,0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <IconUserShield size={20} color="#20C997" stroke={1.5} />
          </Box>
          <Text size="22px" fw={700} style={{ color: '#C1C2C5' }}>
            Admins
          </Text>
          <Badge
            variant="light"
            color="teal"
            size="lg"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            {admins.length}
          </Badge>
        </Group>
        <Button
          leftSection={<IconPlus size={16} />}
          variant="gradient"
          gradient={{ from: 'teal', to: 'cyan' }}
          radius="md"
          onClick={() => setCreateOpen(true)}
        >
          Create admin
        </Button>
      </Group>

      <Paper style={{ ...cardStyle, overflow: 'hidden' }}>
        {loading ? (
          <Box style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
            <Loader color="teal" />
          </Box>
        ) : (
          <Box style={{ overflowX: 'auto' }}>
            <Table horizontalSpacing="md" verticalSpacing="sm">
              <Table.Thead>
                <Table.Tr
                  style={{
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                    backgroundColor: 'rgba(255,255,255,0.02)',
                  }}
                >
                  <Table.Th style={thStyle}>Email</Table.Th>
                  <Table.Th style={thStyle}>Role</Table.Th>
                  <Table.Th style={thStyle}>Enabled</Table.Th>
                  <Table.Th style={thStyle}>Last login</Table.Th>
                  <Table.Th style={thStyle}>Created</Table.Th>
                  <Table.Th style={{ ...thStyle, width: 60 }}>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {admins.map((a, idx) => (
                  <Table.Tr
                    key={a.id}
                    style={{
                      borderBottom: '1px solid rgba(255,255,255,0.03)',
                      backgroundColor:
                        idx % 2 === 1 ? 'rgba(255,255,255,0.015)' : 'transparent',
                    }}
                  >
                    <Table.Td>
                      <Text size="sm" fw={500} style={{ color: '#C1C2C5' }}>
                        {a.email}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Select
                        value={a.role}
                        onChange={(v) => v && handleChangeRole(a.id, v as AdminRole)}
                        data={ROLE_OPTIONS}
                        size="xs"
                        styles={{
                          input: {
                            backgroundColor: '#161B23',
                            border: '1px solid rgba(255,255,255,0.06)',
                            color: '#C1C2C5',
                            minWidth: 120,
                          },
                        }}
                        leftSection={
                          <Badge variant="dot" color={roleColor(a.role)} size="xs" />
                        }
                      />
                    </Table.Td>
                    <Table.Td>
                      <Switch
                        checked={a.enabled}
                        onChange={() => handleToggleEnabled(a)}
                        color="teal"
                        size="sm"
                      />
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" ff="monospace" style={{ color: '#909296' }}>
                        {a.lastLoginAt ? new Date(a.lastLoginAt).toLocaleString() : '-'}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" ff="monospace" style={{ color: '#909296' }}>
                        {new Date(a.createdAt).toLocaleDateString()}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Menu shadow="md" width={180} position="bottom-end">
                        <Menu.Target>
                          <ActionIcon variant="subtle" color="gray">
                            <IconDotsVertical size={16} stroke={1.5} />
                          </ActionIcon>
                        </Menu.Target>
                        <Menu.Dropdown>
                          <Menu.Item
                            leftSection={<IconKey size={14} />}
                            onClick={() => setResetTarget(a)}
                          >
                            Reset password
                          </Menu.Item>
                          <Menu.Item
                            leftSection={<IconUserCog size={14} />}
                            onClick={() => handleToggleEnabled(a)}
                          >
                            {a.enabled ? 'Disable' : 'Enable'}
                          </Menu.Item>
                          <Menu.Divider />
                          <Menu.Item
                            color="red"
                            leftSection={<IconTrash size={14} />}
                            onClick={() => handleDelete(a.id)}
                          >
                            Delete
                          </Menu.Item>
                        </Menu.Dropdown>
                      </Menu>
                    </Table.Td>
                  </Table.Tr>
                ))}
                {admins.length === 0 && (
                  <Table.Tr>
                    <Table.Td colSpan={6}>
                      <Text ta="center" c="dimmed" py="xl" size="sm">
                        No admins
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                )}
              </Table.Tbody>
            </Table>
          </Box>
        )}
      </Paper>

      <Modal
        opened={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create admin"
        centered
        styles={{
          content: { backgroundColor: '#1E2128' },
          header: { backgroundColor: '#1E2128' },
          title: { color: '#C1C2C5', fontWeight: 600 },
        }}
      >
        <Stack>
          <TextInput
            label="Email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.currentTarget.value)}
            styles={inputStyles}
            required
          />
          <PasswordInput
            label="Password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.currentTarget.value)}
            styles={inputStyles}
            required
          />
          <Select
            label="Role"
            value={newRole}
            onChange={(v) => v && setNewRole(v as AdminRole)}
            data={ROLE_OPTIONS}
            styles={inputStyles}
          />
          <Button
            onClick={handleCreate}
            loading={creating}
            variant="gradient"
            gradient={{ from: 'teal', to: 'cyan' }}
          >
            Create
          </Button>
        </Stack>
      </Modal>

      <Modal
        opened={!!resetTarget}
        onClose={() => {
          setResetTarget(null);
          setResetPassword('');
        }}
        title={`Reset password: ${resetTarget?.email ?? ''}`}
        centered
        styles={{
          content: { backgroundColor: '#1E2128' },
          header: { backgroundColor: '#1E2128' },
          title: { color: '#C1C2C5', fontWeight: 600 },
        }}
      >
        <Stack>
          <PasswordInput
            label="New password"
            value={resetPassword}
            onChange={(e) => setResetPassword(e.currentTarget.value)}
            styles={inputStyles}
            required
          />
          <Button
            onClick={handleResetPassword}
            loading={resetting}
            variant="gradient"
            gradient={{ from: 'teal', to: 'cyan' }}
          >
            Reset
          </Button>
        </Stack>
      </Modal>
    </Stack>
  );
}
