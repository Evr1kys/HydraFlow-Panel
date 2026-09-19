import { useEffect, useMemo, useState } from 'react';
import {
  ActionIcon,
  Badge,
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

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function statusColor(status: string): string {
  if (status === 'healthy') return 'teal';
  if (status === 'degraded') return 'yellow';
  if (status === 'offline') return 'orange';
  if (status === 'error') return 'red';
  return 'gray';
}

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleString() : 'Never';
}

export function NodesPage() {
  const { t } = useTranslation();
  const permissions = usePermissions();
  const [query, setQuery] = useState('');
  const [debouncedQuery] = useDebouncedValue(query, 300);
  const [status, setStatus] = useState<string | null>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<CreateNodeInput>(initialForm);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [historyNode, setHistoryNode] = useState<Node | null>(null);
  const [history, setHistory] = useState<NodeDeployment[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const paginated = usePaginated<Node>(getNodesPaginated, {
    size: 25,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });

  useEffect(() => {
    paginated.setSearch(debouncedQuery);
  }, [debouncedQuery, paginated.setSearch]);

  useEffect(() => {
    paginated.setFilter(
      'status',
      status && status !== 'all' ? status : undefined,
    );
  }, [status, paginated.setFilter]);

  const pages = useMemo(
    () => Math.max(1, Math.ceil(paginated.total / paginated.size)),
    [paginated.size, paginated.total],
  );
  const page = Math.floor(paginated.start / paginated.size) + 1;

  const showError = (title: string, error: unknown) => {
    notifications.show({ title, message: messageOf(error), color: 'red' });
  };

  const run = async (
    key: string,
    operation: () => Promise<unknown>,
    success: string,
  ) => {
    setBusy(key);
    try {
      await operation();
      notifications.show({
        title: t('common.success'),
        message: success,
        color: 'teal',
      });
      await paginated.refetch();
    } catch (error) {
      showError('Agent operation failed', error);
    } finally {
      setBusy(null);
    }
  };

  const register = async () => {
    if (!form.name.trim() || !form.address.trim()) {
      notifications.show({
        title: 'Invalid registration',
        message: 'Name and Agent address are required',
        color: 'red',
      });
      return;
    }
    if (!/^[A-Za-z0-9._-]{3,64}$/.test(form.keyId)) {
      notifications.show({
        title: 'Invalid registration',
        message: 'Agent key ID is invalid',
        color: 'red',
      });
      return;
    }
    if (form.apiKey.trim().length < 40) {
      notifications.show({
        title: 'Invalid registration',
        message: 'Agent registration secret is missing or too short',
        color: 'red',
      });
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
      showError('Agent registration failed', error);
    } finally {
      setCreating(false);
    }
  };

  const remove = async (node: Node) => {
    if (!window.confirm(`Delete Agent node “${node.name}”?`)) return;
    await run(`delete:${node.id}`, () => deleteNode(node.id), 'Node deleted');
  };

  const openHistory = async (node: Node) => {
    setHistoryNode(node);
    setHistoryLoading(true);
    try {
      setHistory(await getNodeDeployments(node.id));
    } catch (error) {
      setHistory([]);
      showError('Could not load deployment history', error);
    } finally {
      setHistoryLoading(false);
    }
  };

  const rollback = async (deployment: NodeDeployment) => {
    if (!historyNode || !deployment.revision) return;
    if (!window.confirm(`Roll back to ${deployment.revision}?`)) return;
    await run(
      `rollback:${deployment.id}`,
      () =>
        rollbackNode(
          historyNode.id,
          deployment.revision as string,
          `Panel rollback from deployment ${deployment.id}`,
        ),
      `Rolled back to ${deployment.revision}`,
    );
    setHistory(await getNodeDeployments(historyNode.id));
  };

  if (paginated.loading && paginated.items.length === 0) {
    return <LoadingSkeleton variant="table" rows={5} />;
  }

  if (paginated.error) {
    return <EmptyState icon={IconServer} message={paginated.error} />;
  }

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Group gap="sm">
          <IconServer size={24} color="#20C997" />
          <Text size="xl" fw={700}>
            {t('nodes.title')}
          </Text>
          <Badge color="teal" variant="light">
            {paginated.total}
          </Badge>
        </Group>
        {permissions.canManageNodes && (
          <Button
            color="teal"
            leftSection={<IconPlus size={16} />}
            onClick={() => setCreateOpen(true)}
          >
            Register Agent
          </Button>
        )}
      </Group>

      <Group align="end">
        <TextInput
          label="Search"
          placeholder="Name or address"
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
          style={{ flex: 1, minWidth: 240 }}
        />
        <Select
          label="Status"
          value={status}
          onChange={setStatus}
          w={170}
          data={[
            { value: 'all', label: 'All' },
            { value: 'healthy', label: 'Healthy' },
            { value: 'degraded', label: 'Degraded' },
            { value: 'offline', label: 'Offline' },
            { value: 'error', label: 'Error' },
            { value: 'unknown', label: 'Unknown' },
          ]}
        />
        <Select
          label="Rows"
          value={String(paginated.size)}
          onChange={(value) => paginated.setSize(Number(value ?? 25))}
          data={['10', '25', '50', '100']}
          w={100}
        />
      </Group>

      <Paper withBorder radius="md" style={{ overflow: 'hidden' }}>
        <ScrollArea>
          <Table horizontalSpacing="md" verticalSpacing="sm" miw={1000}>
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
                    <Text fw={600}>{node.name}</Text>
                    {node.lastSyncError && (
                      <Tooltip label={node.lastSyncError} multiline maw={400}>
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
                    <Badge color={statusColor(node.status)}>{node.status}</Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs" c="dimmed">
                      API {node.agentApiVersion ?? 'unknown'} · Agent{' '}
                      {node.agentVersion ?? 'unknown'}
                    </Text>
                    <Code>{node.lastRevision?.slice(0, 22) ?? 'no revision'}</Code>
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs">Check: {formatDate(node.lastCheck)}</Text>
                    <Text size="xs">Sync: {formatDate(node.lastSyncAt)}</Text>
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
                            color="teal"
                            variant="subtle"
                            disabled={busy === `check:${node.id}`}
                            onClick={() =>
                              void run(
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
                          color="blue"
                          variant="subtle"
                          onClick={() => void openHistory(node)}
                        >
                          <IconHistory size={16} />
                        </ActionIcon>
                      </Tooltip>
                      {permissions.canManageNodes && (
                        <Tooltip label="Restart Xray">
                          <ActionIcon
                            color="orange"
                            variant="subtle"
                            disabled={busy === `restart:${node.id}`}
                            onClick={() =>
                              void run(
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
                            color="violet"
                            variant="subtle"
                            disabled={busy === `rotate:${node.id}`}
                            onClick={() =>
                              void run(
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
                            color="red"
                            variant="subtle"
                            disabled={busy === `delete:${node.id}`}
                            onClick={() => void remove(node)}
                          >
                            <IconTrash size={16} />
                          </ActionIcon>
                        </Tooltip>
                      )}
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </ScrollArea>
        {paginated.items.length === 0 && (
          <EmptyState
            icon={IconServer}
            message="No HydraFlow Agents match the current filter"
          />
        )}
      </Paper>

      <Group justify="space-between">
        <Text size="sm" c="dimmed">
          {paginated.total} node{paginated.total === 1 ? '' : 's'}
        </Text>
        <Pagination value={page} total={pages} onChange={paginated.setPage} />
      </Group>

      <Modal
        opened={createOpen}
        onClose={() => !creating && setCreateOpen(false)}
        title="Register HydraFlow Agent"
        size="lg"
      >
        <Stack>
          <Text size="sm" c="dimmed">
            Use the one-time output of <Code>hydraflow-agent init</Code>. Panel
            verifies TLS, API compatibility and Xray health before saving.
          </Text>
          <TextInput
            label="Name"
            value={form.name}
            onChange={(event) =>
              setForm((current) => ({ ...current, name: event.currentTarget.value }))
            }
            required
          />
          <Group grow>
            <TextInput
              label="Agent DNS name or public IP"
              value={form.address}
              onChange={(event) =>
                setForm((current) => ({ ...current, address: event.currentTarget.value }))
              }
              required
            />
            <NumberInput
              label="HTTPS port"
              value={form.port}
              min={1}
              max={65535}
              onChange={(value) =>
                setForm((current) => ({
                  ...current,
                  port: typeof value === 'number' ? value : 8443,
                }))
              }
              required
            />
          </Group>
          <TextInput
            label="Agent key ID"
            value={form.keyId}
            placeholder="agent-0123456789abcdef"
            onChange={(event) =>
              setForm((current) => ({ ...current, keyId: event.currentTarget.value }))
            }
            required
          />
          <PasswordInput
            label="Agent registration secret"
            description="Shown once by hydraflow-agent init"
            value={form.apiKey}
            onChange={(event) =>
              setForm((current) => ({ ...current, apiKey: event.currentTarget.value }))
            }
            required
          />
          <Textarea
            label="Agent CA certificate"
            description="Optional only when the Agent certificate chains to the system trust store"
            value={form.caCertificate}
            autosize
            minRows={4}
            maxRows={8}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                caCertificate: event.currentTarget.value,
              }))
            }
          />
          <TextInput
            label="TLS server name"
            value={form.serverName}
            placeholder="node-01.example.com"
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                serverName: event.currentTarget.value,
              }))
            }
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setCreateOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button color="teal" loading={creating} onClick={() => void register()}>
              Verify and register
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={historyNode !== null}
        onClose={() => setHistoryNode(null)}
        title={`Deployment history${historyNode ? ` — ${historyNode.name}` : ''}`}
        size="xl"
      >
        {historyLoading ? (
          <LoadingSkeleton variant="cards" rows={3} />
        ) : history.length === 0 ? (
          <Text c="dimmed">No deployments recorded.</Text>
        ) : (
          <ScrollArea h={460}>
            <Stack>
              {history.map((deployment) => (
                <Paper key={deployment.id} withBorder p="sm">
                  <Group justify="space-between" align="flex-start" wrap="nowrap">
                    <Stack gap={3} style={{ minWidth: 0 }}>
                      <Group gap="xs">
                        <Badge
                          color={
                            deployment.status === 'succeeded'
                              ? 'teal'
                              : deployment.status === 'failed'
                                ? 'red'
                                : 'yellow'
                          }
                        >
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
                        color="orange"
                        variant="light"
                        leftSection={<IconRestore size={14} />}
                        disabled={busy === `rollback:${deployment.id}`}
                        onClick={() => void rollback(deployment)}
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
