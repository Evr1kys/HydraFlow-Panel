import { useEffect, useState, useCallback } from 'react';
import {
  Table,
  Button,
  Group,
  Text,
  Modal,
  Stack,
  ActionIcon,
  Box,
  Paper,
  Badge,
  Select,
  Switch,
  Textarea,
} from '@mantine/core';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { EmptyState } from '../components/EmptyState';
import { IconAlertTriangle } from '@tabler/icons-react';
import { extractErrorMessage } from '../api/client';
import { usePermissions } from '../hooks/usePermissions';
import { useTranslation } from 'react-i18next';
import { notifications } from '@mantine/notifications';
import {
  IconPuzzle,
  IconPlus,
  IconTrash,
  IconPlayerPlay,
} from '@tabler/icons-react';
import {
  getAllPlugins,
  createNodePlugin,
  updatePlugin,
  deletePlugin,
  executePlugin,
} from '../api/plugins';
import { getNodes } from '../api/nodes';
import type { NodePlugin, Node } from '../types';

const PLUGIN_TYPES = [
  { value: 'torrent_blocker', label: 'Torrent Blocker' },
  { value: 'ingress_filter', label: 'Ingress Filter' },
  { value: 'egress_filter', label: 'Egress Filter' },
  { value: 'connection_dropper', label: 'Connection Dropper' },
];

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

function pluginTypeLabel(type: string): string {
  return PLUGIN_TYPES.find((t) => t.value === type)?.label ?? type;
}

function pluginTypeColor(type: string): string {
  switch (type) {
    case 'torrent_blocker':
      return 'red';
    case 'ingress_filter':
      return 'blue';
    case 'egress_filter':
      return 'grape';
    case 'connection_dropper':
      return 'orange';
    default:
      return 'gray';
  }
}

export function PluginsPage() {
  const { t } = useTranslation();
  const permissions = usePermissions();
  const [plugins, setPlugins] = useState<NodePlugin[]>([]);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [executingId, setExecutingId] = useState<string | null>(null);

  // Create modal
  const [createOpen, setCreateOpen] = useState(false);
  const [newNodeId, setNewNodeId] = useState<string | null>(null);
  const [newType, setNewType] = useState<string | null>(null);
  const [newConfig, setNewConfig] = useState('{}');
  const [creating, setCreating] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoadError(null);
    try {
      const [p, n] = await Promise.all([getAllPlugins(), getNodes()]);
      setPlugins(p);
      setNodes(n);
    } catch (err) {
      setLoadError(extractErrorMessage(err));
      notifications.show({ title: 'Error', message: 'Failed to load plugins', color: 'red' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleCreate = async () => {
    if (!newNodeId || !newType) return;
    setCreating(true);
    try {
      await createNodePlugin(newNodeId, { type: newType, config: newConfig });
      setCreateOpen(false);
      setNewNodeId(null);
      setNewType(null);
      setNewConfig('{}');
      notifications.show({ title: 'Success', message: 'Plugin added', color: 'teal' });
      await fetchAll();
    } catch {
      notifications.show({ title: 'Error', message: 'Failed to add plugin', color: 'red' });
    } finally {
      setCreating(false);
    }
  };

  const handleToggle = async (plugin: NodePlugin) => {
    try {
      await updatePlugin(plugin.id, { enabled: !plugin.enabled });
      setPlugins((prev) =>
        prev.map((p) => (p.id === plugin.id ? { ...p, enabled: !p.enabled } : p)),
      );
      notifications.show({
        title: 'Updated',
        message: `Plugin ${!plugin.enabled ? 'enabled' : 'disabled'}`,
        color: 'teal',
      });
    } catch {
      notifications.show({ title: 'Error', message: 'Failed to toggle plugin', color: 'red' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deletePlugin(id);
      notifications.show({ title: 'Deleted', message: 'Plugin removed', color: 'teal' });
      await fetchAll();
    } catch {
      notifications.show({ title: 'Error', message: 'Failed to delete', color: 'red' });
    }
  };

  const handleExecute = async (plugin: NodePlugin) => {
    setExecutingId(plugin.id);
    try {
      const result = await executePlugin(plugin.nodeId, plugin.id);
      notifications.show({
        title: 'Executed',
        message: result.message,
        color: 'teal',
      });
    } catch {
      notifications.show({ title: 'Error', message: 'Execution failed', color: 'red' });
    } finally {
      setExecutingId(null);
    }
  };

  if (loading) {
    return <LoadingSkeleton variant="table" rows={4} />;
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

  // Validate JSON for create form
  const configIsValid = (() => {
    if (!newConfig.trim()) return true;
    try {
      JSON.parse(newConfig);
      return true;
    } catch {
      return false;
    }
  })();

  return (
    <Stack gap="lg">
      {/* Header */}
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
            <IconPuzzle size={20} color="#20C997" stroke={1.5} />
          </Box>
          <Text size="22px" fw={700} style={{ color: '#C1C2C5' }}>
            Plugins
          </Text>
          <Badge
            variant="light"
            color="teal"
            size="lg"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            {plugins.length}
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
            Add Plugin
          </Button>
        )}
      </Group>

      {/* Table */}
      <Paper style={{ ...cardStyle, overflow: 'hidden' }}>
        <Box style={{ overflowX: 'auto' }}>
          <Table horizontalSpacing="md" verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
                <Table.Th style={thStyle}>Node</Table.Th>
                <Table.Th style={thStyle}>Type</Table.Th>
                <Table.Th style={thStyle}>Status</Table.Th>
                <Table.Th style={thStyle}>Config</Table.Th>
                <Table.Th style={{ ...thStyle, width: 140 }}>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {plugins.map((plugin, idx) => (
                <Table.Tr
                  key={plugin.id}
                  style={{
                    borderBottom: '1px solid rgba(255,255,255,0.03)',
                    backgroundColor: idx % 2 === 1 ? 'rgba(255,255,255,0.015)' : 'transparent',
                  }}
                >
                  <Table.Td>
                    <Text size="sm" fw={500} style={{ color: '#C1C2C5' }}>
                      {plugin.node?.name ?? 'Unknown'}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge variant="light" color={pluginTypeColor(plugin.type)} size="sm">
                      {pluginTypeLabel(plugin.type)}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Switch
                      checked={plugin.enabled}
                      onChange={() => handleToggle(plugin)}
                      color="teal"
                      size="sm"
                    />
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs" ff="monospace" style={{ color: '#909296', maxWidth: 200 }} lineClamp={1}>
                      {plugin.config}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      <ActionIcon
                        variant="subtle"
                        color="teal"
                        radius="md"
                        loading={executingId === plugin.id}
                        onClick={() => handleExecute(plugin)}
                        style={{ border: '1px solid rgba(32,201,151,0.15)' }}
                      >
                        <IconPlayerPlay size={14} />
                      </ActionIcon>
                      {permissions.canDelete && (
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          radius="md"
                          onClick={() => handleDelete(plugin.id)}
                          style={{ border: '1px solid rgba(255,107,107,0.15)' }}
                        >
                          <IconTrash size={14} />
                        </ActionIcon>
                      )}
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
              {plugins.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={5} style={{ padding: 0 }}>
                    <EmptyState
                      icon={IconPuzzle}
                      message={t('plugins.noPlugins')}
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
                            {t('plugins.add')}
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

      {/* Create Plugin Modal */}
      <Modal
        opened={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Add Plugin"
        radius="lg"
        styles={{
          content: { backgroundColor: '#1E2128', border: '1px solid rgba(255,255,255,0.06)' },
          header: { backgroundColor: '#1E2128', borderBottom: '1px solid rgba(255,255,255,0.06)' },
          title: { color: '#C1C2C5', fontWeight: 600 },
          close: { color: '#909296' },
        }}
      >
        <Stack gap="md" mt="md">
          <Select
            label="Node"
            placeholder="Select node"
            data={nodes.map((n) => ({ value: n.id, label: n.name }))}
            value={newNodeId}
            onChange={setNewNodeId}
            styles={{
              ...inputStyles,
              dropdown: { backgroundColor: '#1E2128', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10 },
            }}
          />
          <Select
            label="Plugin Type"
            placeholder="Select type"
            data={PLUGIN_TYPES}
            value={newType}
            onChange={setNewType}
            styles={{
              ...inputStyles,
              dropdown: { backgroundColor: '#1E2128', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10 },
            }}
          />
          <Textarea
            label="Config (JSON)"
            placeholder="{}"
            value={newConfig}
            onChange={(e) => setNewConfig(e.currentTarget.value)}
            error={configIsValid ? null : t('validation.json')}
            minRows={3}
            styles={inputStyles}
          />
          <Button
            variant="gradient"
            gradient={{ from: 'teal', to: 'cyan' }}
            loading={creating}
            onClick={handleCreate}
            radius="md"
            fullWidth
            disabled={!newNodeId || !newType || !configIsValid || creating}
          >
            Add Plugin
          </Button>
        </Stack>
      </Modal>
    </Stack>
  );
}
