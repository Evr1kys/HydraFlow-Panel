import { useEffect, useState, useCallback } from 'react';
import {
  Table,
  Button,
  Group,
  Text,
  Badge,
  TextInput,
  NumberInput,
  Modal,
  Stack,
  ActionIcon,
  Box,
  Title,
  Loader,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconPlus,
  IconTrash,
  IconRefresh,
  IconServer,
} from '@tabler/icons-react';
import {
  getNodes,
  createNode,
  deleteNode,
  checkNodeHealth,
} from '../api/nodes';
import type { Node } from '../types';

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

  const inputStyles = {
    input: {
      backgroundColor: '#060a12',
      borderColor: '#1a2940',
      color: '#d0d7e3',
    },
    label: { color: '#97a8c2' },
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
      <Group justify="space-between">
        <Group gap="sm">
          <IconServer size={28} color="#00e8c6" />
          <Title order={2} style={{ color: '#d0d7e3' }}>
            Nodes
          </Title>
        </Group>
        <Button
          leftSection={<IconPlus size={16} />}
          variant="gradient"
          gradient={{ from: 'teal', to: 'cyan' }}
          onClick={() => setCreateOpen(true)}
        >
          Add Node
        </Button>
      </Group>

      <Box
        style={{
          backgroundColor: '#0b1121',
          border: '1px solid #1a2940',
          borderRadius: 8,
          overflow: 'auto',
        }}
      >
        <Table horizontalSpacing="md" verticalSpacing="sm">
          <Table.Thead>
            <Table.Tr style={{ borderBottom: '1px solid #1a2940' }}>
              <Table.Th style={{ color: '#97a8c2' }}>Name</Table.Th>
              <Table.Th style={{ color: '#97a8c2' }}>Address</Table.Th>
              <Table.Th style={{ color: '#97a8c2' }}>Status</Table.Th>
              <Table.Th style={{ color: '#97a8c2' }}>Last Checked</Table.Th>
              <Table.Th style={{ color: '#97a8c2' }}>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {nodes.map((node) => (
              <Table.Tr
                key={node.id}
                style={{ borderBottom: '1px solid #111b30' }}
              >
                <Table.Td>
                  <Text size="sm" fw={500} style={{ color: '#d0d7e3' }}>
                    {node.name}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" ff="monospace" style={{ color: '#d0d7e3' }}>
                    {node.address}:{node.port}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Badge
                    color={
                      node.status === 'online'
                        ? 'teal'
                        : node.status === 'offline'
                          ? 'red'
                          : 'gray'
                    }
                    variant="light"
                  >
                    {node.status}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" style={{ color: '#d0d7e3' }}>
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
                      loading={checkingId === node.id}
                      onClick={() => handleCheck(node.id)}
                    >
                      <IconRefresh size={16} />
                    </ActionIcon>
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      onClick={() => handleDelete(node.id)}
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
            {nodes.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={5}>
                  <Text ta="center" c="dimmed" py="xl">
                    No nodes configured
                  </Text>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Box>

      <Modal
        opened={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Add Node"
        styles={{
          content: { backgroundColor: '#0b1121', borderColor: '#1a2940' },
          header: { backgroundColor: '#0b1121' },
          title: { color: '#d0d7e3' },
        }}
      >
        <Stack gap="md">
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
          >
            Add Node
          </Button>
        </Stack>
      </Modal>
    </Stack>
  );
}
