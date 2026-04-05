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
  Box,
  Paper,
  Badge,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconPlus,
  IconTrash,
  IconRefresh,
  IconServer,
  IconCircleFilled,
  IconAlertTriangle,
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import {
  getNodes,
  createNode,
  deleteNode,
  checkNodeHealth,
} from '../api/nodes';
import type { Node } from '../types';
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

interface CreateNodeFormValues {
  name: string;
  address: string;
  port: number | '';
  apiKey: string;
}

export function NodesPage() {
  const { t } = useTranslation();
  const permissions = usePermissions();
  const [nodes, setNodes] = useState<Node[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [checkingId, setCheckingId] = useState<string | null>(null);

  const nodeForm = useFormValidation<CreateNodeFormValues>(
    { name: '', address: '', port: 443, apiKey: '' },
    {
      name: validators.combine(
        validators.isNotEmpty(t('validation.required')),
        validators.hasLength({ min: 1, max: 100 }),
      ),
      address: validators.combine(
        validators.isNotEmpty(t('validation.required')),
        validators.isHostOrIp(t('validation.hostOrIp')),
      ),
      port: validators.combine(
        validators.isNotEmpty(t('validation.required')),
        validators.isPort(t('validation.port')),
      ),
    },
  );

  const fetchNodes = useCallback(async () => {
    setLoadError(null);
    try {
      const data = await getNodes();
      setNodes(data);
    } catch (err) {
      const message = extractErrorMessage(err);
      setLoadError(message);
      notifications.show({
        title: t('common.error'),
        message: t('notification.nodesError'),
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchNodes();
  }, [fetchNodes]);

  const handleCreate = async () => {
    if (!nodeForm.validate()) return;
    const { name, address, port, apiKey } = nodeForm.values;
    setCreating(true);
    try {
      await createNode({
        name,
        address,
        port: Number(port) || 443,
        apiKey: apiKey || undefined,
      });
      setCreateOpen(false);
      nodeForm.reset({ port: 443 });
      notifications.show({
        title: t('common.success'),
        message: t('notification.nodeAdded'),
        color: 'teal',
      });
      await fetchNodes();
    } catch {
      notifications.show({
        title: t('common.error'),
        message: t('notification.nodeAddError'),
        color: 'red',
      });
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteNode(id);
      notifications.show({
        title: t('common.success'),
        message: t('notification.nodeDeleted'),
        color: 'teal',
      });
      await fetchNodes();
    } catch {
      notifications.show({
        title: t('common.error'),
        message: t('notification.nodeDeleteError'),
        color: 'red',
      });
    }
  };

  const handleCheck = async (id: string) => {
    setCheckingId(id);
    try {
      const updated = await checkNodeHealth(id);
      setNodes((prev) => prev.map((n) => (n.id === id ? updated : n)));
      notifications.show({
        title: t('common.success'),
        message: t('notification.healthCheckResult', { status: updated.status }),
        color: updated.status === 'online' ? 'teal' : 'red',
      });
    } catch {
      notifications.show({
        title: t('common.error'),
        message: t('notification.healthCheckError'),
        color: 'red',
      });
    } finally {
      setCheckingId(null);
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
            <IconServer size={20} color="#20C997" stroke={1.5} />
          </Box>
          <Text size="22px" fw={700} style={{ color: '#C1C2C5' }}>
            {t('nodes.title')}
          </Text>
          <Badge
            variant="light"
            color="teal"
            size="lg"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            {nodes.length}
          </Badge>
        </Group>
        {permissions.canManageNodes && (
          <Button
            leftSection={<IconPlus size={16} />}
            variant="gradient"
            gradient={{ from: 'teal', to: 'cyan' }}
            radius="md"
            onClick={() => setCreateOpen(true)}
          >
            {t('nodes.addNode')}
          </Button>
        )}
      </Group>

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
                <Table.Th style={thStyle}>{t('nodes.name')}</Table.Th>
                <Table.Th style={thStyle}>{t('nodes.address')}</Table.Th>
                <Table.Th style={thStyle}>{t('nodes.status')}</Table.Th>
                <Table.Th style={thStyle}>{t('nodes.lastChecked')}</Table.Th>
                <Table.Th style={{ ...thStyle, width: 100 }}>{t('nodes.actions')}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {nodes.map((node, idx) => {
                const dotColor =
                  node.status === 'online'
                    ? '#51cf66'
                    : node.status === 'offline'
                      ? '#ff6b6b'
                      : '#5c5f66';
                return (
                  <Table.Tr
                    key={node.id}
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
                    <Table.Td>
                      <Text size="sm" fw={500} style={{ color: '#C1C2C5' }}>
                        {node.name}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" ff="monospace" fw={500} style={{ color: '#C1C2C5' }}>
                        {node.address}:{node.port}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Group gap={6}>
                        <IconCircleFilled size={8} color={dotColor} />
                        <Text size="xs" fw={500} style={{ color: dotColor }}>
                          {node.status}
                        </Text>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" style={{ color: '#909296' }}>
                        {node.lastCheck
                          ? new Date(node.lastCheck).toLocaleString()
                          : t('nodes.never')}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs">
                        <ActionIcon
                          variant="subtle"
                          color="teal"
                          radius="md"
                          loading={checkingId === node.id}
                          onClick={() => handleCheck(node.id)}
                          style={{ border: '1px solid rgba(32,201,151,0.15)' }}
                        >
                          <IconRefresh size={14} />
                        </ActionIcon>
                        {permissions.canDelete && (
                          <ActionIcon
                            variant="subtle"
                            color="red"
                            radius="md"
                            onClick={() => handleDelete(node.id)}
                            style={{ border: '1px solid rgba(255,107,107,0.15)' }}
                          >
                            <IconTrash size={14} />
                          </ActionIcon>
                        )}
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
              {nodes.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={5} style={{ padding: 0 }}>
                    <EmptyState
                      icon={IconServer}
                      message={t('nodes.noNodes')}
                      minHeight={220}
                      action={
                        permissions.canManageNodes ? (
                          <Button
                            leftSection={<IconPlus size={14} />}
                            variant="light"
                            color="teal"
                            radius="md"
                            size="sm"
                            onClick={() => setCreateOpen(true)}
                          >
                            {t('nodes.addNode')}
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

      {/* Create Node Modal */}
      <Modal
        opened={createOpen}
        onClose={() => setCreateOpen(false)}
        title={t('nodes.addNode')}
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
            label={t('nodes.name')}
            placeholder="Node-1"
            value={nodeForm.values.name}
            onChange={(e) =>
              nodeForm.setFieldValue('name', e.currentTarget.value)
            }
            onBlur={() => nodeForm.setFieldTouched('name', true)}
            error={nodeForm.getInputProps('name').error}
            styles={inputStyles}
          />
          <TextInput
            label={t('nodes.address')}
            placeholder="192.168.1.100"
            value={nodeForm.values.address}
            onChange={(e) =>
              nodeForm.setFieldValue('address', e.currentTarget.value)
            }
            onBlur={() => nodeForm.setFieldTouched('address', true)}
            error={nodeForm.getInputProps('address').error}
            styles={inputStyles}
          />
          <NumberInput
            label={t('nodes.port')}
            value={nodeForm.values.port}
            onChange={(v) =>
              nodeForm.setFieldValue('port', v === '' ? '' : Number(v))
            }
            onBlur={() => nodeForm.setFieldTouched('port', true)}
            error={nodeForm.getInputProps('port').error}
            min={1}
            max={65535}
            styles={inputStyles}
          />
          <TextInput
            label={t('nodes.apiKey')}
            placeholder={t('nodes.optional')}
            value={nodeForm.values.apiKey}
            onChange={(e) =>
              nodeForm.setFieldValue('apiKey', e.currentTarget.value)
            }
            styles={inputStyles}
          />
          <Button
            variant="gradient"
            gradient={{ from: 'teal', to: 'cyan' }}
            loading={creating}
            onClick={handleCreate}
            disabled={!nodeForm.isValid || creating}
            radius="md"
            fullWidth
          >
            {t('nodes.addNode')}
          </Button>
        </Stack>
      </Modal>
    </Stack>
  );
}
