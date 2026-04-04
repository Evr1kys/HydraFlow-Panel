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
  Loader,
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
} from '@tabler/icons-react';
import {
  getNodes,
  createNode,
  deleteNode,
  checkNodeHealth,
} from '../api/nodes';
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

export function NodesPage() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newPort, setNewPort] = useState<number>(443);
  const [newApiKey, setNewApiKey] = useState('');
  const [checkingId, setCheckingId] = useState<string | null>(null);

  const fetchNodes = useCallback(async () => {
    try {
      const data = await getNodes();
      setNodes(data);
    } catch {
      notifications.show({
        title: 'Error',
        message: 'Failed to load nodes',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNodes();
  }, [fetchNodes]);

  const handleCreate = async () => {
    if (!newName || !newAddress) return;
    setCreating(true);
    try {
      await createNode({
        name: newName,
        address: newAddress,
        port: newPort,
        apiKey: newApiKey || undefined,
      });
      setCreateOpen(false);
      setNewName('');
      setNewAddress('');
      setNewPort(443);
      setNewApiKey('');
      notifications.show({
        title: 'Success',
        message: 'Node added',
        color: 'teal',
      });
      await fetchNodes();
    } catch {
      notifications.show({
        title: 'Error',
        message: 'Failed to add node',
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
        title: 'Success',
        message: 'Node deleted',
        color: 'teal',
      });
      await fetchNodes();
    } catch {
      notifications.show({
        title: 'Error',
        message: 'Failed to delete node',
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
        title: 'Health Check',
        message: `Node is ${updated.status}`,
        color: updated.status === 'online' ? 'teal' : 'red',
      });
    } catch {
      notifications.show({
        title: 'Error',
        message: 'Health check failed',
        color: 'red',
      });
    } finally {
      setCheckingId(null);
    }
  };

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
            Nodes
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
        <Button
          leftSection={<IconPlus size={16} />}
          variant="gradient"
          gradient={{ from: 'teal', to: 'cyan' }}
          radius="md"
          onClick={() => setCreateOpen(true)}
        >
          Add Node
        </Button>
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
                <Table.Th style={thStyle}>Name</Table.Th>
                <Table.Th style={thStyle}>Address</Table.Th>
                <Table.Th style={thStyle}>Status</Table.Th>
                <Table.Th style={thStyle}>Last Checked</Table.Th>
                <Table.Th style={{ ...thStyle, width: 100 }}>Actions</Table.Th>
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
                          : 'Never'}
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
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          radius="md"
                          onClick={() => handleDelete(node.id)}
                          style={{ border: '1px solid rgba(255,107,107,0.15)' }}
                        >
                          <IconTrash size={14} />
                        </ActionIcon>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
              {nodes.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={5}>
                    <Box
                      py={48}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      <IconServer size={40} color="#373A40" stroke={1} />
                      <Text ta="center" size="sm" style={{ color: '#5c5f66' }}>
                        No nodes configured
                      </Text>
                    </Box>
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
        title="Add Node"
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
            label="Name"
            placeholder="Node-1"
            value={newName}
            onChange={(e) => setNewName(e.currentTarget.value)}
            styles={inputStyles}
          />
          <TextInput
            label="Address"
            placeholder="192.168.1.100"
            value={newAddress}
            onChange={(e) => setNewAddress(e.currentTarget.value)}
            styles={inputStyles}
          />
          <NumberInput
            label="Port"
            value={newPort}
            onChange={(v) => setNewPort(Number(v))}
            styles={inputStyles}
          />
          <TextInput
            label="API Key"
            placeholder="Optional"
            value={newApiKey}
            onChange={(e) => setNewApiKey(e.currentTarget.value)}
            styles={inputStyles}
          />
          <Button
            variant="gradient"
            gradient={{ from: 'teal', to: 'cyan' }}
            loading={creating}
            onClick={handleCreate}
            radius="md"
            fullWidth
          >
            Add Node
          </Button>
        </Stack>
      </Modal>
    </Stack>
  );
}
