import { useEffect, useState, useCallback } from 'react';
import {
  Table,
  Button,
  Group,
  Text,
  TextInput,
  NumberInput,
  Textarea,
  Modal,
  Stack,
  ActionIcon,
  Box,
  Paper,
  Badge,
  Tabs,
  Switch,
  MultiSelect,
} from '@mantine/core';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { EmptyState } from '../components/EmptyState';
import { usePermissions } from '../hooks/usePermissions';
import { notifications } from '@mantine/notifications';
import {
  IconPlus,
  IconTrash,
  IconEdit,
  IconUsersGroup,
  IconKey,
  IconCopy,
  IconUserPlus,
  IconUserMinus,
  IconRefresh,
} from '@tabler/icons-react';
import {
  getInternalSquads,
  createInternalSquad,
  updateInternalSquad,
  deleteInternalSquad,
  assignUsersToSquad,
  removeUsersFromSquad,
  getExternalSquads,
  createExternalSquad,
  updateExternalSquad,
  deleteExternalSquad,
  regenerateExternalApiKey,
} from '../api/squads';
import { getUsers } from '../api/users';
import { getNodes } from '../api/nodes';
import type { InternalSquad, ExternalSquad, User, Node } from '../types';

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

const modalStyles = {
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
};

// ============= INTERNAL SQUADS TAB =============

function InternalSquadsTab() {
  const permissions = usePermissions();
  const [squads, setSquads] = useState<InternalSquad[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [allNodes, setAllNodes] = useState<Node[]>([]);
  const [loading, setLoading] = useState(true);

  // Create modal
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newNodeIds, setNewNodeIds] = useState<string[]>([]);

  // Edit modal
  const [editSquad, setEditSquad] = useState<InternalSquad | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editNodeIds, setEditNodeIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Assign users modal
  const [assignSquad, setAssignSquad] = useState<InternalSquad | null>(null);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  const fetchData = useCallback(async () => {
    try {
      const [s, u, n] = await Promise.all([
        getInternalSquads(),
        getUsers(),
        getNodes(),
      ]);
      setSquads(s);
      setAllUsers(u);
      setAllNodes(n);
    } catch {
      notifications.show({ title: 'Error', message: 'Failed to load data', color: 'red' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreate = async () => {
    if (!newName) return;
    setCreating(true);
    try {
      await createInternalSquad({
        name: newName,
        description: newDesc || undefined,
        nodeIds: newNodeIds.length > 0 ? newNodeIds : undefined,
      });
      setCreateOpen(false);
      setNewName('');
      setNewDesc('');
      setNewNodeIds([]);
      notifications.show({ title: 'Success', message: 'Squad created', color: 'teal' });
      await fetchData();
    } catch {
      notifications.show({ title: 'Error', message: 'Failed to create squad', color: 'red' });
    } finally {
      setCreating(false);
    }
  };

  const handleEdit = (squad: InternalSquad) => {
    setEditSquad(squad);
    setEditName(squad.name);
    setEditDesc(squad.description ?? '');
    setEditNodeIds(squad.nodeIds);
  };

  const handleSaveEdit = async () => {
    if (!editSquad) return;
    setSaving(true);
    try {
      await updateInternalSquad(editSquad.id, {
        name: editName,
        description: editDesc || undefined,
        nodeIds: editNodeIds,
      });
      setEditSquad(null);
      notifications.show({ title: 'Success', message: 'Squad updated', color: 'teal' });
      await fetchData();
    } catch {
      notifications.show({ title: 'Error', message: 'Failed to update squad', color: 'red' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteInternalSquad(id);
      notifications.show({ title: 'Success', message: 'Squad deleted', color: 'teal' });
      await fetchData();
    } catch {
      notifications.show({ title: 'Error', message: 'Failed to delete squad', color: 'red' });
    }
  };

  const openAssign = (squad: InternalSquad) => {
    setAssignSquad(squad);
    setSelectedUserIds([]);
  };

  const handleAssign = async () => {
    if (!assignSquad || selectedUserIds.length === 0) return;
    try {
      await assignUsersToSquad(assignSquad.id, selectedUserIds);
      setAssignSquad(null);
      notifications.show({ title: 'Success', message: 'Users assigned', color: 'teal' });
      await fetchData();
    } catch {
      notifications.show({ title: 'Error', message: 'Failed to assign users', color: 'red' });
    }
  };

  const handleRemoveUser = async (squadId: string, userId: string) => {
    try {
      await removeUsersFromSquad(squadId, [userId]);
      notifications.show({ title: 'Success', message: 'User removed from squad', color: 'teal' });
      await fetchData();
    } catch {
      notifications.show({ title: 'Error', message: 'Failed to remove user', color: 'red' });
    }
  };

  const nodeOptions = allNodes.map((n) => ({ value: n.id, label: n.name }));

  // Users not in any squad (available for assignment)
  const assignedUserIds = new Set(squads.flatMap((s) => s.users.map((u) => u.id)));
  const availableUsers = allUsers.filter((u) => !assignedUserIds.has(u.id));
  const userOptions = availableUsers.map((u) => ({
    value: u.id,
    label: `${u.email}${u.remark ? ` (${u.remark})` : ''}`,
  }));

  if (loading) {
    return <LoadingSkeleton variant="table" rows={4} />;
  }

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Text size="lg" fw={600} style={{ color: '#C1C2C5' }}>
          Internal Squads
        </Text>
        {permissions.canEdit && (
          <Button
            leftSection={<IconPlus size={16} />}
            variant="gradient"
            gradient={{ from: 'teal', to: 'cyan' }}
            radius="md"
            onClick={() => setCreateOpen(true)}
          >
            Create Squad
          </Button>
        )}
      </Group>

      <Paper style={{ ...cardStyle, overflow: 'hidden' }}>
        <Box style={{ overflowX: 'auto' }}>
          <Table horizontalSpacing="md" verticalSpacing="sm"
            styles={{ table: { borderCollapse: 'separate', borderSpacing: 0 } }}>
            <Table.Thead>
              <Table.Tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
                <Table.Th style={thStyle}>Name</Table.Th>
                <Table.Th style={thStyle}>Description</Table.Th>
                <Table.Th style={thStyle}>Users</Table.Th>
                <Table.Th style={thStyle}>Nodes</Table.Th>
                <Table.Th style={{ ...thStyle, width: 140 }}>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {squads.map((squad, idx) => (
                <Table.Tr
                  key={squad.id}
                  style={{
                    borderBottom: '1px solid rgba(255,255,255,0.03)',
                    backgroundColor: idx % 2 === 1 ? 'rgba(255,255,255,0.015)' : 'transparent',
                    transition: 'background-color 0.15s ease',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#252A35'; }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.backgroundColor =
                      idx % 2 === 1 ? 'rgba(255,255,255,0.015)' : 'transparent';
                  }}
                >
                  <Table.Td>
                    <Text size="sm" fw={500} style={{ color: '#C1C2C5' }}>{squad.name}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" style={{ color: '#909296' }}>{squad.description ?? '-'}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap={4}>
                      <Badge variant="light" color="teal" size="sm" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                        {squad.users.length}
                      </Badge>
                      {squad.users.slice(0, 3).map((u) => (
                        <Badge key={u.id} variant="outline" color="gray" size="xs" radius="sm"
                          rightSection={
                            <ActionIcon size={12} variant="transparent" color="red"
                              onClick={() => handleRemoveUser(squad.id, u.id)} style={{ marginLeft: 2 }}>
                              <IconUserMinus size={10} />
                            </ActionIcon>
                          }
                        >
                          {u.email.split('@')[0]}
                        </Badge>
                      ))}
                      {squad.users.length > 3 && (
                        <Text size="xs" style={{ color: '#5c5f66' }}>+{squad.users.length - 3} more</Text>
                      )}
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Badge variant="light" color="blue" size="sm" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                      {squad.nodeIds.length}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      {permissions.canEdit && (
                        <>
                          <ActionIcon variant="subtle" color="teal" radius="md"
                            onClick={() => openAssign(squad)}
                            style={{ border: '1px solid rgba(32,201,151,0.15)' }}>
                            <IconUserPlus size={14} />
                          </ActionIcon>
                          <ActionIcon variant="subtle" color="blue" radius="md"
                            onClick={() => handleEdit(squad)}
                            style={{ border: '1px solid rgba(51,154,240,0.15)' }}>
                            <IconEdit size={14} />
                          </ActionIcon>
                        </>
                      )}
                      {permissions.canDelete && (
                        <ActionIcon variant="subtle" color="red" radius="md"
                          onClick={() => handleDelete(squad.id)}
                          style={{ border: '1px solid rgba(255,107,107,0.15)' }}>
                          <IconTrash size={14} />
                        </ActionIcon>
                      )}
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
              {squads.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={5} style={{ padding: 0 }}>
                    <EmptyState
                      icon={IconUsersGroup}
                      message="No internal squads yet"
                      minHeight={200}
                      action={
                        permissions.canEdit ? (
                          <Button
                            leftSection={<IconPlus size={14} />}
                            variant="light"
                            color="teal"
                            radius="md"
                            size="sm"
                            onClick={() => setCreateOpen(true)}
                          >
                            Create Squad
                          </Button>
                        ) : undefined
                      }
                    />
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </Box>
      </Paper>

      {/* Create Internal Squad Modal */}
      <Modal opened={createOpen} onClose={() => setCreateOpen(false)} title="Create Internal Squad" radius="lg" styles={modalStyles}>
        <Stack gap="md" mt="md">
          <TextInput label="Name" placeholder="Squad name" value={newName}
            onChange={(e) => setNewName(e.currentTarget.value)}
            error={newName.trim() === '' ? 'This field is required' : null}
            styles={inputStyles} />
          <Textarea label="Description" placeholder="Optional description" value={newDesc}
            onChange={(e) => setNewDesc(e.currentTarget.value)}
            styles={{ input: inputStyles.input, label: inputStyles.label }} />
          <MultiSelect label="Assigned Nodes" placeholder="Select nodes"
            data={nodeOptions} value={newNodeIds} onChange={setNewNodeIds}
            styles={{ input: inputStyles.input, label: inputStyles.label, pill: { backgroundColor: '#339AF0', color: '#fff' } }} />
          <Button variant="gradient" gradient={{ from: 'teal', to: 'cyan' }}
            loading={creating} onClick={handleCreate} radius="md" fullWidth
            disabled={!newName.trim() || creating}>
            Create Squad
          </Button>
        </Stack>
      </Modal>

      {/* Edit Internal Squad Modal */}
      <Modal opened={!!editSquad} onClose={() => setEditSquad(null)} title="Edit Internal Squad" radius="lg" styles={modalStyles}>
        <Stack gap="md" mt="md">
          <TextInput label="Name" value={editName}
            onChange={(e) => setEditName(e.currentTarget.value)} styles={inputStyles} />
          <Textarea label="Description" value={editDesc}
            onChange={(e) => setEditDesc(e.currentTarget.value)}
            styles={{ input: inputStyles.input, label: inputStyles.label }} />
          <MultiSelect label="Assigned Nodes" placeholder="Select nodes"
            data={nodeOptions} value={editNodeIds} onChange={setEditNodeIds}
            styles={{ input: inputStyles.input, label: inputStyles.label, pill: { backgroundColor: '#339AF0', color: '#fff' } }} />
          <Button variant="gradient" gradient={{ from: 'teal', to: 'cyan' }}
            loading={saving} onClick={handleSaveEdit} radius="md" fullWidth>
            Save Changes
          </Button>
        </Stack>
      </Modal>

      {/* Assign Users Modal */}
      <Modal opened={!!assignSquad} onClose={() => setAssignSquad(null)}
        title={`Assign Users to ${assignSquad?.name ?? ''}`} radius="lg" styles={modalStyles}>
        <Stack gap="md" mt="md">
          <MultiSelect label="Select Users" placeholder="Pick users to add"
            data={userOptions} value={selectedUserIds} onChange={setSelectedUserIds}
            searchable
            styles={{ input: inputStyles.input, label: inputStyles.label, pill: { backgroundColor: '#20C997', color: '#fff' } }} />
          <Button variant="gradient" gradient={{ from: 'teal', to: 'cyan' }}
            onClick={handleAssign} radius="md" fullWidth
            disabled={selectedUserIds.length === 0}>
            Assign {selectedUserIds.length} User{selectedUserIds.length !== 1 ? 's' : ''}
          </Button>
        </Stack>
      </Modal>
    </Stack>
  );
}

// ============= EXTERNAL SQUADS TAB =============

function ExternalSquadsTab() {
  const permissions = usePermissions();
  const [squads, setSquads] = useState<ExternalSquad[]>([]);
  const [loading, setLoading] = useState(true);

  // Create modal
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newMaxUsers, setNewMaxUsers] = useState<number | ''>(100);
  const [newEnabled, setNewEnabled] = useState(true);
  const [newSubTitle, setNewSubTitle] = useState('');
  const [newSubBrand, setNewSubBrand] = useState('');
  const [newHostOverrides, setNewHostOverrides] = useState('');

  // Edit modal
  const [editSquad, setEditSquad] = useState<ExternalSquad | null>(null);
  const [editName, setEditName] = useState('');
  const [editMaxUsers, setEditMaxUsers] = useState<number | ''>(100);
  const [editEnabled, setEditEnabled] = useState(true);
  const [editSubTitle, setEditSubTitle] = useState('');
  const [editSubBrand, setEditSubBrand] = useState('');
  const [editHostOverrides, setEditHostOverrides] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const data = await getExternalSquads();
      setSquads(data);
    } catch {
      notifications.show({ title: 'Error', message: 'Failed to load external squads', color: 'red' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const parseHostOverrides = (text: string): Record<string, string> | undefined => {
    if (!text.trim()) return undefined;
    try {
      return JSON.parse(text);
    } catch {
      notifications.show({ title: 'Error', message: 'Host overrides must be valid JSON', color: 'red' });
      return undefined;
    }
  };

  const handleCreate = async () => {
    if (!newName) return;
    setCreating(true);
    try {
      const hostOverrides = parseHostOverrides(newHostOverrides);
      await createExternalSquad({
        name: newName,
        maxUsers: newMaxUsers !== '' ? newMaxUsers : undefined,
        enabled: newEnabled,
        subPageTitle: newSubTitle || undefined,
        subPageBrand: newSubBrand || undefined,
        hostOverrides,
      });
      setCreateOpen(false);
      setNewName('');
      setNewMaxUsers(100);
      setNewEnabled(true);
      setNewSubTitle('');
      setNewSubBrand('');
      setNewHostOverrides('');
      notifications.show({ title: 'Success', message: 'External squad created', color: 'teal' });
      await fetchData();
    } catch {
      notifications.show({ title: 'Error', message: 'Failed to create squad', color: 'red' });
    } finally {
      setCreating(false);
    }
  };

  const handleEdit = (squad: ExternalSquad) => {
    setEditSquad(squad);
    setEditName(squad.name);
    setEditMaxUsers(squad.maxUsers);
    setEditEnabled(squad.enabled);
    setEditSubTitle(squad.subPageTitle ?? '');
    setEditSubBrand(squad.subPageBrand ?? '');
    setEditHostOverrides(squad.hostOverrides ? JSON.stringify(squad.hostOverrides, null, 2) : '');
  };

  const handleSaveEdit = async () => {
    if (!editSquad) return;
    setSaving(true);
    try {
      const hostOverrides = parseHostOverrides(editHostOverrides);
      await updateExternalSquad(editSquad.id, {
        name: editName,
        maxUsers: editMaxUsers !== '' ? editMaxUsers : undefined,
        enabled: editEnabled,
        subPageTitle: editSubTitle || undefined,
        subPageBrand: editSubBrand || undefined,
        hostOverrides,
      });
      setEditSquad(null);
      notifications.show({ title: 'Success', message: 'Squad updated', color: 'teal' });
      await fetchData();
    } catch {
      notifications.show({ title: 'Error', message: 'Failed to update squad', color: 'red' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteExternalSquad(id);
      notifications.show({ title: 'Success', message: 'Squad deleted', color: 'teal' });
      await fetchData();
    } catch {
      notifications.show({ title: 'Error', message: 'Failed to delete squad', color: 'red' });
    }
  };

  const handleRegenKey = async (id: string) => {
    try {
      await regenerateExternalApiKey(id);
      notifications.show({ title: 'Success', message: 'API key regenerated', color: 'teal' });
      await fetchData();
    } catch {
      notifications.show({ title: 'Error', message: 'Failed to regenerate key', color: 'red' });
    }
  };

  const copyApiKey = (key: string) => {
    navigator.clipboard.writeText(key);
    notifications.show({ title: 'Copied', message: 'API key copied to clipboard', color: 'teal' });
  };

  if (loading) {
    return <LoadingSkeleton variant="table" rows={4} />;
  }

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Text size="lg" fw={600} style={{ color: '#C1C2C5' }}>
          External Squads (Resellers)
        </Text>
        {permissions.canEdit && (
          <Button leftSection={<IconPlus size={16} />} variant="gradient"
            gradient={{ from: 'teal', to: 'cyan' }} radius="md"
            onClick={() => setCreateOpen(true)}>
            Create External Squad
          </Button>
        )}
      </Group>

      <Paper style={{ ...cardStyle, overflow: 'hidden' }}>
        <Box style={{ overflowX: 'auto' }}>
          <Table horizontalSpacing="md" verticalSpacing="sm"
            styles={{ table: { borderCollapse: 'separate', borderSpacing: 0 } }}>
            <Table.Thead>
              <Table.Tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
                <Table.Th style={thStyle}>Name</Table.Th>
                <Table.Th style={thStyle}>API Key</Table.Th>
                <Table.Th style={thStyle}>Users</Table.Th>
                <Table.Th style={thStyle}>Status</Table.Th>
                <Table.Th style={thStyle}>Branding</Table.Th>
                <Table.Th style={{ ...thStyle, width: 140 }}>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {squads.map((squad, idx) => (
                <Table.Tr key={squad.id}
                  style={{
                    borderBottom: '1px solid rgba(255,255,255,0.03)',
                    backgroundColor: idx % 2 === 1 ? 'rgba(255,255,255,0.015)' : 'transparent',
                    transition: 'background-color 0.15s ease',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#252A35'; }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.backgroundColor =
                      idx % 2 === 1 ? 'rgba(255,255,255,0.015)' : 'transparent';
                  }}
                >
                  <Table.Td>
                    <Text size="sm" fw={500} style={{ color: '#C1C2C5' }}>{squad.name}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap={4}>
                      <Text size="xs" ff="monospace" style={{ color: '#909296', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {squad.apiKey.slice(0, 12)}...
                      </Text>
                      <ActionIcon size="xs" variant="subtle" color="gray"
                        onClick={() => copyApiKey(squad.apiKey)}>
                        <IconCopy size={12} />
                      </ActionIcon>
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" ff="monospace" style={{ color: '#C1C2C5' }}>
                      {squad.users.length} / {squad.maxUsers}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge variant="light" color={squad.enabled ? 'teal' : 'red'} size="sm">
                      {squad.enabled ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs" style={{ color: '#909296' }}>
                      {squad.subPageBrand ?? 'Default'}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      {permissions.canEdit && (
                        <>
                          <ActionIcon variant="subtle" color="yellow" radius="md"
                            onClick={() => handleRegenKey(squad.id)}
                            style={{ border: '1px solid rgba(252,196,25,0.15)' }}>
                            <IconRefresh size={14} />
                          </ActionIcon>
                          <ActionIcon variant="subtle" color="blue" radius="md"
                            onClick={() => handleEdit(squad)}
                            style={{ border: '1px solid rgba(51,154,240,0.15)' }}>
                            <IconEdit size={14} />
                          </ActionIcon>
                        </>
                      )}
                      {permissions.canDelete && (
                        <ActionIcon variant="subtle" color="red" radius="md"
                          onClick={() => handleDelete(squad.id)}
                          style={{ border: '1px solid rgba(255,107,107,0.15)' }}>
                          <IconTrash size={14} />
                        </ActionIcon>
                      )}
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
              {squads.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={6} style={{ padding: 0 }}>
                    <EmptyState
                      icon={IconKey}
                      message="No external squads yet"
                      minHeight={200}
                      action={
                        permissions.canEdit ? (
                          <Button
                            leftSection={<IconPlus size={14} />}
                            variant="light"
                            color="teal"
                            radius="md"
                            size="sm"
                            onClick={() => setCreateOpen(true)}
                          >
                            Create External Squad
                          </Button>
                        ) : undefined
                      }
                    />
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </Box>
      </Paper>

      {/* Create External Squad Modal */}
      <Modal opened={createOpen} onClose={() => setCreateOpen(false)}
        title="Create External Squad" radius="lg" size="lg" styles={modalStyles}>
        <Stack gap="md" mt="md">
          <TextInput label="Name" placeholder="Partner name" value={newName}
            onChange={(e) => setNewName(e.currentTarget.value)}
            error={newName.trim() === '' ? 'This field is required' : null}
            styles={inputStyles} />
          <NumberInput label="Max Users" value={newMaxUsers}
            onChange={(v) => setNewMaxUsers(v === '' ? '' : Number(v))}
            error={
              newMaxUsers !== '' && (newMaxUsers < 1 || newMaxUsers > 1000000)
                ? 'Must be a positive integer'
                : null
            }
            min={1} max={1000000} styles={inputStyles} />
          <Switch label="Enabled" checked={newEnabled} onChange={(e) => setNewEnabled(e.currentTarget.checked)}
            color="teal" styles={{ label: { color: '#909296' } }} />
          <TextInput label="Subscription Page Title" placeholder="Custom brand title"
            value={newSubTitle} onChange={(e) => setNewSubTitle(e.currentTarget.value)} styles={inputStyles} />
          <TextInput label="Subscription Page Brand" placeholder="Custom brand name"
            value={newSubBrand} onChange={(e) => setNewSubBrand(e.currentTarget.value)} styles={inputStyles} />
          <Textarea label="Host Overrides (JSON)" placeholder='{"serverIp": "1.2.3.4", "reality": "5.6.7.8"}'
            value={newHostOverrides} onChange={(e) => setNewHostOverrides(e.currentTarget.value)}
            error={
              newHostOverrides.trim() && (() => {
                try {
                  JSON.parse(newHostOverrides);
                  return null;
                } catch {
                  return 'Must be valid JSON';
                }
              })()
            }
            minRows={3}
            styles={{ input: { ...inputStyles.input, fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }, label: inputStyles.label }} />
          <Button variant="gradient" gradient={{ from: 'teal', to: 'cyan' }}
            loading={creating} onClick={handleCreate} radius="md" fullWidth
            disabled={!newName.trim() || creating}>
            Create External Squad
          </Button>
        </Stack>
      </Modal>

      {/* Edit External Squad Modal */}
      <Modal opened={!!editSquad} onClose={() => setEditSquad(null)}
        title="Edit External Squad" radius="lg" size="lg" styles={modalStyles}>
        <Stack gap="md" mt="md">
          <TextInput label="Name" value={editName}
            onChange={(e) => setEditName(e.currentTarget.value)} styles={inputStyles} />
          <NumberInput label="Max Users" value={editMaxUsers}
            onChange={(v) => setEditMaxUsers(v === '' ? '' : Number(v))} min={1} styles={inputStyles} />
          <Switch label="Enabled" checked={editEnabled} onChange={(e) => setEditEnabled(e.currentTarget.checked)}
            color="teal" styles={{ label: { color: '#909296' } }} />
          <TextInput label="Subscription Page Title" value={editSubTitle}
            onChange={(e) => setEditSubTitle(e.currentTarget.value)} styles={inputStyles} />
          <TextInput label="Subscription Page Brand" value={editSubBrand}
            onChange={(e) => setEditSubBrand(e.currentTarget.value)} styles={inputStyles} />
          <Textarea label="Host Overrides (JSON)" value={editHostOverrides}
            onChange={(e) => setEditHostOverrides(e.currentTarget.value)}
            minRows={3}
            styles={{ input: { ...inputStyles.input, fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }, label: inputStyles.label }} />
          <Button variant="gradient" gradient={{ from: 'teal', to: 'cyan' }}
            loading={saving} onClick={handleSaveEdit} radius="md" fullWidth>
            Save Changes
          </Button>
        </Stack>
      </Modal>
    </Stack>
  );
}

// ============= MAIN SQUADS PAGE =============

export function SquadsPage() {
  return (
    <Stack gap="lg">
      <Group gap="sm">
        <Box style={{
          width: 36, height: 36, borderRadius: '50%',
          backgroundColor: 'rgba(32,201,151,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <IconUsersGroup size={20} color="#20C997" stroke={1.5} />
        </Box>
        <Text size="22px" fw={700} style={{ color: '#C1C2C5' }}>Squads</Text>
      </Group>

      <Tabs defaultValue="internal" styles={{
        root: { },
        tab: {
          color: '#909296',
          fontWeight: 500,
          borderBottom: '2px solid transparent',
          '&[dataActive]': {
            color: '#20C997',
            borderBottomColor: '#20C997',
          },
        },
        list: {
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        },
      }}>
        <Tabs.List>
          <Tabs.Tab value="internal">Internal Squads</Tabs.Tab>
          <Tabs.Tab value="external">External Squads</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="internal" pt="lg">
          <InternalSquadsTab />
        </Tabs.Panel>

        <Tabs.Panel value="external" pt="lg">
          <ExternalSquadsTab />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
