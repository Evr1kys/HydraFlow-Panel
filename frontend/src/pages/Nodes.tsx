import { useEffect, useMemo, useState } from 'react';
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Code,
  Group,
  Modal,
  NumberInput,
  Pagination,
  Paper,
  PasswordInput,
  ScrollArea,
  Select,
  Stack,
  Table,
  Text,
  Textarea,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconAlertTriangle,
  IconHistory,
  IconKey,
  IconPlus,
  IconRefresh,
  IconRestore,
  IconServer,
  IconTrash,
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import {
  checkNodeHealth,
  createNode,
  deleteNode,
  getNodeDeployments,
  getNodesPaginated,
  restartNode,
  rollbackNode,
  rotateNodeKey,
  type CreateNodeInput,
  type NodeDeployment,
} from '../api/nodes';
import { EmptyState } from '../components/EmptyState';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { usePaginated } from '../hooks/usePaginated';
import { usePermissions } from '../hooks/usePermissions';
import type { Node } from '../types';

const cardStyle = {
  backgroundColor: '#1E2128',
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: 12,
  boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
};

const inputStyles = {
  input: {
    backgroundColor: '#161B23',
    border: '1px solid rgba(255,255,255,0.08)',
    color: '#C1C2C5',
    borderRadius: 8,
  },
  label: {
    color: '#909296',
    fontSize: '12px',
    fontWeight: 600,
    marginBottom: 4,
  },
  description: { color: '#5c5f66' },
};

const initialForm: CreateNodeInput = {
  name: '',
  address: '',
  port: 8443,
  keyId: '',
  apiKey: '',
  caCertificate: '',
  serverName: '',
  enabled: true,
};

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function statusColor(status: string): string {
  switch (status) {
    case 'healthy':
      return 'teal';
    case 'degraded':
      return 'yellow';
    case 'offline':
      return 'orange';
    case 'error':
      return 'red';
    default:
      return 'gray';
  }
}

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleString() : 'Never';
}

export function NodesPage() {
  const { t } = useTranslation();
  const permissions = usePermissions();
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<CreateNodeInput>(initialForm);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch] = useDebouncedValue(searchInput, 300);
  const [statusFilter, setStatusFilter] = useState<string | null>('all');
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [deploymentsOpen, setDeploymentsOpen] = useState(false);
  const [deploymentNode, setDeploymentNode] = useState<Node | null>(null);
  const [deployments, setDeployments] = useState<NodeDeployment[]>([]);
  const [deploymentsLoading, setDeploymentsLoading] = useState(false);

  const paginated = usePaginated<Node>(getNodesPaginated, {
    size: 25,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });

  useEffect(() => {
    paginated.setSearch(debouncedSearch);
  }, [debouncedSearch, paginated.setSearch]);

  useEffect(() => {
    paginated.setFilter(
      'status',
      statusFilter && statusFilter !== 'all' ? statusFilter : undefined,
    );
  }, [statusFilter, paginated.setFilter]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(paginated.total / paginated.size)),
    [paginated.total, paginated.size],
  );
  const currentPage = Math.floor(paginated.start / paginated.size) + 1;

  const notifyError = (title: string, error: unknown) => {
    notifications.show({
      title,
      message: errorMessage(error),
      color: 'red',
    });
  };

  const validateCreate = (): string | null => {
    if (!form.name.trim()) return 'Node name is required';
    if (!form.address.trim()) return 'Agent address is required';
    if (!Number.isInteger(form.port) || form.port < 1 || form.port > 65535) {
      return 'Agent port must be between 1 and 65535';
    }
    if (!/^[A-Za-z0-9._-]{3,64}$/.test(form.keyId)) {
      return 'Agent key ID is invalid';
    }
    if (form.apiKey.trim().length < 40) {
      return 'Agent registration secret is missing or too short';
    }
    return null;
  };

  const handleCreate = async () => {
    const validation = validateCreate();
    if (validation) {
      notifications.show({ title: 'Invalid Agent registration', message: validation, color: 'red' });
      return;
    }
    setCreating(true);
    try {
      await createNode({
        ...form,
        name: form.name.trim(),
        address: form.address.trim(),
        keyId: form.keyId.trim(),
        apiKey: form.apiKey.trim(),
        caCertificate: form.caCertificate?.trim() || undefined,
        serverName: form.serverName?.trim() || undefined,
      });
      setCreateOpen(false);
      setForm(initialForm);
      notifications.show({
        title: t('common.success'),
        message: 'Agent verified and registered',
        color: 'teal',
      });
      await paginated.refetch();
    } catch (error) {
      notifyError('Agent registration failed', error);
    } finally {
      setCreating(false);
    }
  };

  const runNodeAction = async (
    key: string,
    action: () => Promise<unknown>,
    successMessage: string,
  ) => {
    setBusyAction(key);
    try {
      await action();
      notifications.show({
        title: t('common.success'),
        message: successMessage,
        color: 'teal',
      });
      await paginated.refetch();
    } catch (error) {
      notifyError('Agent operation failed', error);
    } finally {
      setBusyAction(null);
    }
  };

  const handleDelete = async (node: Node) => {
    if (!window.confirm(`Delete Agent node “${node.name}”?`)) return;
    await runNodeAction(
      `delete:${node.id}`,
      () => deleteNode(node.id),
      'Node deleted',
    );
  };

  const openDeployments = async (node: Node) => {
    setDeploymentNode(node);
    setDeploymentsOpen(true);
    setDeploymentsLoading(true);
    try {
      setDeployments(await getNodeDeployments(node.id));
    } catch (error) {
      notifyError('Could not load deployment history', error);
      setDeployments([]);
    } finally {
      setDeploymentsLoading(false);
    }
  };

  const handleRollback = async (deployment: NodeDeployment) => {
    if (!deploymentNode || !deployment.revision) return;
    if (
      !window.confirm(
        `Roll back ${deploymentNode.name} to revision ${deployment.revision}?`,
      )
    ) {
      return;
    }
    await runNodeAction(
      `rollback:${deployment.id}`,
      () =>
        rollbackNode(
          deploymentNode.id,
          deployment.revision as string,
          `Panel rollback from deployment ${deployment.id}`,
        ),
      `Rolled back to ${deployment.revision}`,
    );
    setDeployments(await getNodeDeployments(deploymentNode.id));
  };

  if (paginated.loading && paginated.items.length === 0) {
    return <LoadingSkeleton variant="table" rows={5} />;
  }

  if (paginated.error) {
    return (
      <EmptyState
        icon={IconAlertTriangle}
        title={t('common.error')}
        message={paginated.error}
      />
    );
  }

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="center">
        <Group gap="sm">
          <Box
            style={{
              width: 38,
              height: 38,
              borderRadius: '50%',
              backgroundColor: 'rgba(32,201,151,0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <IconServer size={21} color="#20C997" />
          </Box>
          <Text size="22px" fw={700} c="#C1C2C5">
            {t('nodes.title')}
          </Text>
          <Badge variant="light" color="teal" size="lg">
            {paginated.total}
          </Badge>
        </Group>
        {permissions.canManageNodes && (
          <Button
            leftSection={<IconPlus size={16} />}
            color="teal"
            onClick={() => setCreateOpen(true)}
          >
            Register Agent
          </Button>
        )}
      </Group>

      <Group align="end" wrap="wrap">
        <TextInput
          label="Search"
          placeholder="Name or address"
          value={searchInput}
          onChange={(event) => setSearchInput(event.currentTarget.value)}
          styles={inputStyles}
          style={{ flex: 1, minWidth: 250 }}
        />
        <Select
          label="Status"
          value={statusFilter}
          onChange={setStatusFilter}
          data={[
            { value: 'all', label: 'All' },
            { value: 'healthy', label: 'Healthy' },
            { value: 'degraded', label: 'Degraded' },
            { value: 'offline', label: 'Offline' },
            { value: 'error', label: 'Error' },
            { value: 'unknown', label: 'Unknown' },
          ]}
          styles={inputStyles}
          w={170}
        />
        <Select
          label="Rows"
          value={String(paginated.size)}
          onChange={(value) => paginated.setSize(Number(value ?? 25))}
          data={['10', '25', '50', '100']}
          styles={inputStyles}
          w={100}
        />
      </Group>

      <Paper style={{ ...cardStyle, overflow: 'hidden' }}>
        <ScrollArea>
          <Table horizontalSpacing="md" verticalSpacing="sm" miw={1050}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Name</Table.Th>
                <Table.Th>Agent</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Version / revision</Table.Th>
                <Table.Th>Last activity</Table.Th>
                <Table.Th>Security</Table.Th>
                <Table.Th>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {paginated.items.map((node) => (
                <Table.Tr key={node.id}>
                  <Table.Td>
                    <Text fw={600} c="#C1C2C5">
                      {node.name}
                    </Text>
                    {node.lastSyncError && (
                      <Tooltip label={node.lastSyncError} multiline maw={420}>
                        <Text size="xs" c="red" lineClamp={1} maw={190}>
                          {node.lastSyncError}
                        </Text>
                      </Tooltip>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Code>{node.address}:{node.port}</Code>
                  </Table.Td>
                  <Table.Td>
                    <Badge color={statusColor(node.status)} variant="light">
                      {node.status}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Stack gap={2}>
                      <Text size="xs" c="dimmed">
                        API {node.agentApiVersion ?? 'unknown'} · Agent{' '}
                        {node.agentVersion ?? 'unknown'}
                      </Text>
                      <Tooltip label={node.lastRevision ?? 'No active revision'}>
                        <Code>{node.lastRevision?.slice(0, 22) ?? 'no revision'}</Code>
                      </Tooltip>
                    </Stack>
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs" c="dimmed">
                      Check: {formatDate(node.lastCheck)}
                    </Text>
                    <Text size="xs" c="dimmed">
                      Sync: {formatDate(node.lastSyncAt)}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Stack gap={3}>
                      <Badge
                        size="xs"
                        color={node.credentialsConfigured ? 'teal' : 'red'}
                      >
                        {node.credentialsConfigured ? 'Signed' : 'No credentials'}
                      </Badge>
                      <Badge
                        size="xs"
                        color={node.customCaConfigured ? 'blue' : 'gray'}
                      >
                        {node.customCaConfigured ? 'Custom CA' : 'System CA'}
                      </Badge>
                    </Stack>
                  </Table.Td>
                  <Table.Td>
                    <Group gap={4} wrap="nowrap">
                      {permissions.canEdit && (
                        <Tooltip label="Health check">
                          <ActionIcon
                            variant="subtle"
                            color="teal"
                            loading={busyAction === `check:${node.id}`}
                            onClick={() =>
                              void runNodeAction(
                                `check:${node.id}`,
                                () => checkNodeHealth(node.id),
                                'Agent health refreshed',
                              )
                            }
                          >
                            <IconRefresh size={16} />
                          </ActionIcon>
                        </Tooltip>
                      )}
                      <Tooltip label="Deployment history">
                        <ActionIcon
                          variant="subtle"
                          color="blue"
                          onClick={() => void openDeployments(node)}
                        >
                          <IconHistory size={16} />
                        </ActionIcon>
                      </Tooltip>
                      {permissions.canManageNodes && (
                        <Tooltip label="Restart Xray">
                          <ActionIcon
                            variant="subtle"
                            color="orange"
                            loading={busyAction === `restart:${node.id}`}
                            onClick={() =>
                              void runNodeAction(
                                `restart:${node.id}`,
                                () => restartNode(node.id),
                                'Xray restarted through Agent',
                              )
                            }
                          >
                            <IconRestore size={16} />
                          </ActionIcon>
                        </Tooltip>
                      )}
                      {permissions.role === 'superadmin' && (
                        <Tooltip label="Rotate Agent key">
                          <ActionIcon
                            variant="subtle"
                            color="violet"
                            loading={busyAction === `rotate:${node.id}`}
                            onClick={() =>
                              void runNodeAction(
                                `rotate:${node.id}`,
                                () => rotateNodeKey(node.id),
                                'Agent credential rotated',
                              )
                            }
                          >
                            <IconKey size={16} />
                          </ActionIcon>
                        </Tooltip>
                      )}
                      {permissions.canDelete && (
                        <Tooltip label="Delete node">
                          <ActionIcon
                            variant="subtle"
                            color="red"
                            loading={busyAction === `delete:${node.id}`}
                            onClick={() => void handleDelete(node)}
                          >
                            <IconTrash size={16} />
                          </ActionIcon>
                        </Tooltip>
                      )}
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
              {paginated.items.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={7}>
                    <EmptyState
                      icon={IconServer}
                      message="No HydraFlow Agents match the current filter"
                      minHeight={220}
                    />
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      </Paper>

      <Group justify="space-between">
        <Text size="sm" c="dimmed">
          {paginated.total === 0
            ? '0 nodes'
            : `${paginated.start + 1}–${Math.min(
                paginated.start + paginated.size,
                paginated.total,
              )} of ${paginated.total}`}
        </Text>
        <Pagination
          value={currentPage}
          total={totalPages}
          onChange={paginated.setPage}
          color="teal"
        />
      </Group>

      <Modal
        opened={createOpen}
        onClose={() => !creating && setCreateOpen(false)}
        title="Register HydraFlow Agent"
        size="lg"
        centered
      >
        <Stack>
          <Text size="sm" c="dimmed">
            Run <Code>hydraflow-agent init --hosts ...</Code> on the node and
            enter the one-time registration material. Panel verifies TLS,
            API compatibility and Xray health before saving it.
          </Text>
          <TextInput
            label="Name"
            value={form.name}
            onChange={(event) =>
              setForm((current) => ({ ...current, name: event.currentTarget.value }))
            }
            styles={inputStyles}
            required
          />
          <Group grow align="end">
            <TextInput
              label="Agent DNS name or public IP"
              value={form.address}
              onChange={(event) =>
                setForm((current) => ({ ...current, address: event.currentTarget.value }))
              }
              styles={inputStyles}
              required
            />
            <NumberInput
              label="HTTPS port"
              value={form.port}
              onChange={(value) =>
                setForm((current) => ({
                  ...current,
                  port: typeof value === 'number' ? value : 8443,
                }))
              }
              min={1}
              max={65535}
              styles={inputStyles}
              required
            />
          </Group>
          <TextInput
            label="Agent key ID"
            placeholder="agent-0123456789abcdef"
            value={form.keyId}
            onChange={(event) =>
              setForm((current) => ({ ...current, keyId: event.currentTarget.value }))
            }
            styles={inputStyles}
            required
          />
          <PasswordInput
            label="Agent registration secret"
            description="Shown once by hydraflow-agent init"
            value={form.apiKey}
            onChange={(event) =>
              setForm((current) => ({ ...current, apiKey: event.currentTarget.value }))
            }
            styles={inputStyles}
            required
          />
          <Textarea
            label="Agent CA certificate"
            description="PEM CA generated by Agent init; optional for a publicly trusted certificate"
            placeholder="-----BEGIN CERTIFICATE-----"
            autosize
            minRows={4}
            maxRows={8}
            value={form.caCertificate}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                caCertificate: event.currentTarget.value,
              }))
            }
            styles={inputStyles}
          />
          <TextInput
            label="TLS server name"
            description="Optional explicit certificate name"
            placeholder="node-01.example.com"
            value={form.serverName}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                serverName: event.currentTarget.value,
              }))
            }
            styles={inputStyles}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setCreateOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button color="teal" loading={creating} onClick={() => void handleCreate()}>
              Verify and register
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={deploymentsOpen}
        onClose={() => setDeploymentsOpen(false)}
        title={`Deployment history${deploymentNode ? ` — ${deploymentNode.name}` : ''}`}
        size="xl"
        centered
      >
        {deploymentsLoading ? (
          <LoadingSkeleton variant="list" rows={4} />
        ) : deployments.length === 0 ? (
          <Text c="dimmed">No configuration deployments recorded.</Text>
        ) : (
          <ScrollArea h={460}>
            <Stack gap="sm">
              {deployments.map((deployment) => (
                <Paper key={deployment.id} p="sm" withBorder bg="#161B23">
                  <Group justify="space-between" align="flex-start" wrap="nowrap">
                    <Stack gap={3} style={{ minWidth: 0 }}>
                      <Group gap="xs">
                        <Badge color={statusColor(
                          deployment.status === 'succeeded'
                            ? 'healthy'
                            : deployment.status === 'failed'
                              ? 'error'
                              : 'degraded',
                        )}>
                          {deployment.status}
                        </Badge>
                        <Text size="xs" c="dimmed">
                          {new Date(deployment.createdAt).toLocaleString()}
                        </Text>
                      </Group>
                      <Code>{deployment.revision ?? 'No revision'}</Code>
                      <Text size="xs" c="dimmed" lineClamp={1}>
                        SHA-256 {deployment.configHash}
                      </Text>
                      {deployment.error && (
                        <Text size="xs" c="red">
                          {deployment.error}
                        </Text>
                      )}
                    </Stack>
                    {permissions.canManageNodes && deployment.revision && (
                      <Button
                        size="xs"
                        variant="light"
                        color="orange"
                        leftSection={<IconRestore size={14} />}
                        loading={busyAction === `rollback:${deployment.id}`}
                        onClick={() => void handleRollback(deployment)}
                      >
                        Roll back
                      </Button>
                    )}
                  </Group>
                </Paper>
              ))}
            </Stack>
          </ScrollArea>
        )}
      </Modal>
    </Stack>
  );
}

export default NodesPage;
