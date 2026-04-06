import { useEffect, useState } from 'react';
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
  Pagination,
  Select,
  Chip,
  UnstyledButton,
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconPlus,
  IconTrash,
  IconRefresh,
  IconServer,
  IconCircleFilled,
  IconAlertTriangle,
  IconSearch,
  IconArrowUp,
  IconArrowDown,
  IconArrowsSort,
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import {
  getNodesPaginated,
  createNode,
  deleteNode,
  checkNodeHealth,
} from '../api/nodes';
import type { Node } from '../types';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { EmptyState } from '../components/EmptyState';
import { useFormValidation, validators } from '../hooks/useFormValidation';
import { usePermissions } from '../hooks/usePermissions';
import { usePaginated } from '../hooks/usePaginated';

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

type NodeStatusFilter = 'all' | 'healthy' | 'error' | 'unknown';

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

export function NodesPage() {
  const { t } = useTranslation();
  const permissions = usePermissions();
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch] = useDebouncedValue(searchInput, 300);
  const [statusFilter, setStatusFilter] = useState<NodeStatusFilter>('all');

  const paginated = usePaginated<Node>(getNodesPaginated, {
    size: 25,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });

  const {
    items: nodes,
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
    refetch: fetchNodes,
  } = paginated;

  useEffect(() => {
    setPaginatedSearch(debouncedSearch);
  }, [debouncedSearch, setPaginatedSearch]);

  useEffect(() => {
    if (statusFilter === 'all') {
      setFilter('status', undefined);
    } else {
      setFilter('status', statusFilter);
    }
  }, [statusFilter, setFilter]);

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
      notifications.show({
        title: t('common.success'),
        message: t('notification.healthCheckResult', {
          status: updated.status,
        }),
        color: updated.status === 'healthy' ? 'teal' : 'red',
      });
      await fetchNodes();
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

  const totalPages = Math.max(1, Math.ceil(total / size));
  const currentPage = Math.floor(start / size) + 1;

  if (loading && nodes.length === 0) {
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
            {total}
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

      {/* Search + Filters */}
      <Group gap="sm" wrap="wrap" align="center">
        <TextInput
          placeholder="Search by name or address"
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
          onChange={(v) => setStatusFilter(v as NodeStatusFilter)}
        >
          <Group gap="xs">
            <Chip value="all" color="teal" radius="md" size="sm">
              All
            </Chip>
            <Chip value="healthy" color="teal" radius="md" size="sm">
              Healthy
            </Chip>
            <Chip value="error" color="red" radius="md" size="sm">
              Error
            </Chip>
            <Chip value="unknown" color="gray" radius="md" size="sm">
              Unknown
            </Chip>
          </Group>
        </Chip.Group>
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
                <Table.Th style={thStyle}>
                  <SortableHeader
                    label={t('nodes.name')}
                    field="name"
                    sortBy={sortBy}
                    sortOrder={sortOrder}
                    onToggle={toggleSort}
                  />
                </Table.Th>
                <Table.Th style={thStyle}>{t('nodes.address')}</Table.Th>
                <Table.Th style={thStyle}>
                  <SortableHeader
                    label={t('nodes.status')}
                    field="status"
                    sortBy={sortBy}
                    sortOrder={sortOrder}
                    onToggle={toggleSort}
                  />
                </Table.Th>
                <Table.Th style={thStyle}>
                  <SortableHeader
                    label={t('nodes.lastChecked')}
                    field="lastCheck"
                    sortBy={sortBy}
                    sortOrder={sortOrder}
                    onToggle={toggleSort}
                  />
                </Table.Th>
                <Table.Th style={{ ...thStyle, width: 100 }}>{t('nodes.actions')}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {nodes.map((node, idx) => {
                const dotColor =
                  node.status === 'healthy'
                    ? '#51cf66'
                    : node.status === 'error'
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

export default NodesPage;
