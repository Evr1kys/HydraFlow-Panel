import { useCallback, useEffect, useState } from 'react';
import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Code,
  CopyButton,
  Group,
  Loader,
  Modal,
  MultiSelect,
  Paper,
  Stack,
  Table,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import {
  IconAlertTriangle,
  IconCheck,
  IconCopy,
  IconKey,
  IconPlus,
  IconTrash,
} from '@tabler/icons-react';
import {
  ALL_API_KEY_SCOPES,
  createApiKey,
  listApiKeys,
  revokeApiKey,
  type ApiKeyEntry,
  type ApiKeyScope,
  type ApiKeyWithPlaintext,
} from '../api/apiKeys';

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

export function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKeyEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newScopes, setNewScopes] = useState<ApiKeyScope[]>(['users:read']);
  const [newExpires, setNewExpires] = useState<Date | null>(null);
  const [creating, setCreating] = useState(false);
  const [createdKey, setCreatedKey] = useState<ApiKeyWithPlaintext | null>(null);

  const fetchKeys = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listApiKeys();
      setKeys(data);
    } catch {
      notifications.show({
        title: 'Error',
        message: 'Failed to load API keys',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  const handleCreate = async () => {
    if (!newName || newScopes.length === 0) return;
    setCreating(true);
    try {
      const created = await createApiKey({
        name: newName,
        scopes: newScopes,
        expiresAt: newExpires ? newExpires.toISOString() : undefined,
      });
      setCreatedKey(created);
      setCreateOpen(false);
      setNewName('');
      setNewScopes(['users:read']);
      setNewExpires(null);
      await fetchKeys();
    } catch {
      notifications.show({
        title: 'Error',
        message: 'Failed to create API key',
        color: 'red',
      });
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (id: string) => {
    if (!confirm('Revoke this API key?')) return;
    try {
      await revokeApiKey(id);
      notifications.show({ title: 'Success', message: 'API key revoked', color: 'teal' });
      await fetchKeys();
    } catch {
      notifications.show({
        title: 'Error',
        message: 'Failed to revoke',
        color: 'red',
      });
    }
  };

  const statusOf = (k: ApiKeyEntry): { label: string; color: string } => {
    if (k.revoked) return { label: 'revoked', color: 'red' };
    if (k.expiresAt && new Date(k.expiresAt).getTime() < Date.now())
      return { label: 'expired', color: 'gray' };
    return { label: 'active', color: 'teal' };
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
            <IconKey size={20} color="#20C997" stroke={1.5} />
          </Box>
          <Text size="22px" fw={700} style={{ color: '#C1C2C5' }}>
            API Keys
          </Text>
          <Badge
            variant="light"
            color="teal"
            size="lg"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            {keys.length}
          </Badge>
        </Group>
        <Button
          leftSection={<IconPlus size={16} />}
          variant="gradient"
          gradient={{ from: 'teal', to: 'cyan' }}
          radius="md"
          onClick={() => setCreateOpen(true)}
        >
          Generate new
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
                  <Table.Th style={thStyle}>Name</Table.Th>
                  <Table.Th style={thStyle}>Key prefix</Table.Th>
                  <Table.Th style={thStyle}>Scopes</Table.Th>
                  <Table.Th style={thStyle}>Last used</Table.Th>
                  <Table.Th style={thStyle}>Expires</Table.Th>
                  <Table.Th style={thStyle}>Status</Table.Th>
                  <Table.Th style={{ ...thStyle, width: 60 }}>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {keys.map((k, idx) => {
                  const st = statusOf(k);
                  return (
                    <Table.Tr
                      key={k.id}
                      style={{
                        borderBottom: '1px solid rgba(255,255,255,0.03)',
                        backgroundColor:
                          idx % 2 === 1 ? 'rgba(255,255,255,0.015)' : 'transparent',
                      }}
                    >
                      <Table.Td>
                        <Text size="sm" fw={500} style={{ color: '#C1C2C5' }}>
                          {k.name}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Code style={{ backgroundColor: '#161B23', color: '#20C997' }}>
                          {k.keyPrefix}...
                        </Code>
                      </Table.Td>
                      <Table.Td>
                        <Group gap={4}>
                          {k.scopes.map((s) => (
                            <Badge key={s} variant="light" color="blue" size="xs">
                              {s}
                            </Badge>
                          ))}
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs" ff="monospace" style={{ color: '#909296' }}>
                          {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : '-'}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs" ff="monospace" style={{ color: '#909296' }}>
                          {k.expiresAt ? new Date(k.expiresAt).toLocaleDateString() : '-'}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge variant="light" color={st.color} size="sm">
                          {st.label}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        {!k.revoked && (
                          <Tooltip label="Revoke">
                            <ActionIcon
                              variant="subtle"
                              color="red"
                              onClick={() => handleRevoke(k.id)}
                            >
                              <IconTrash size={16} stroke={1.5} />
                            </ActionIcon>
                          </Tooltip>
                        )}
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
                {keys.length === 0 && (
                  <Table.Tr>
                    <Table.Td colSpan={7}>
                      <Text ta="center" c="dimmed" py="xl" size="sm">
                        No API keys
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
        title="Generate API key"
        centered
        styles={{
          content: { backgroundColor: '#1E2128' },
          header: { backgroundColor: '#1E2128' },
          title: { color: '#C1C2C5', fontWeight: 600 },
        }}
      >
        <Stack>
          <TextInput
            label="Name"
            placeholder="CI automation"
            value={newName}
            onChange={(e) => setNewName(e.currentTarget.value)}
            styles={inputStyles}
            required
          />
          <MultiSelect
            label="Scopes"
            data={ALL_API_KEY_SCOPES.map((s) => ({ value: s, label: s }))}
            value={newScopes}
            onChange={(v) => setNewScopes(v as ApiKeyScope[])}
            styles={inputStyles}
            required
          />
          <DateInput
            label="Expires at (optional)"
            value={newExpires}
            onChange={setNewExpires}
            clearable
            styles={inputStyles}
          />
          <Button
            onClick={handleCreate}
            loading={creating}
            variant="gradient"
            gradient={{ from: 'teal', to: 'cyan' }}
          >
            Generate
          </Button>
        </Stack>
      </Modal>

      <Modal
        opened={!!createdKey}
        onClose={() => setCreatedKey(null)}
        title="API key created"
        centered
        size="lg"
        styles={{
          content: { backgroundColor: '#1E2128' },
          header: { backgroundColor: '#1E2128' },
          title: { color: '#C1C2C5', fontWeight: 600 },
        }}
      >
        <Stack>
          <Alert
            icon={<IconAlertTriangle size={18} />}
            color="yellow"
            title="Save this now - it will not be shown again"
          >
            Copy this key and store it securely. You will not be able to see it again
            after closing this dialog.
          </Alert>
          {createdKey && (
            <Paper p="md" style={{ backgroundColor: '#161B23' }}>
              <Group justify="space-between" wrap="nowrap">
                <Code
                  style={{
                    backgroundColor: 'transparent',
                    color: '#20C997',
                    fontSize: 13,
                    wordBreak: 'break-all',
                  }}
                >
                  {createdKey.key}
                </Code>
                <CopyButton value={createdKey.key}>
                  {({ copied, copy }) => (
                    <Tooltip label={copied ? 'Copied' : 'Copy'}>
                      <ActionIcon
                        variant="light"
                        color={copied ? 'teal' : 'gray'}
                        onClick={copy}
                      >
                        {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                      </ActionIcon>
                    </Tooltip>
                  )}
                </CopyButton>
              </Group>
            </Paper>
          )}
          <Button onClick={() => setCreatedKey(null)} variant="default">
            Done
          </Button>
        </Stack>
      </Modal>
    </Stack>
  );
}
