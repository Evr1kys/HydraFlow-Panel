import { useCallback, useEffect, useState } from 'react';
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Group,
  Loader,
  Modal,
  NumberInput,
  Paper,
  Stack,
  Table,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconSearch,
  IconUsers,
  IconUserOff,
  IconUserCheck,
  IconCoin,
} from '@tabler/icons-react';
import { PageHeader } from '../components/PageHeader';
import {
  getBotUsers,
  updateBotUser,
  type BotUserRow,
} from '../api/bot';
import { extractErrorMessage } from '../api/client';

const cardStyle = {
  backgroundColor: '#1E2128',
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: 12,
  boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
};

const thStyle = {
  color: '#5c5f66',
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '0.8px',
  textTransform: 'uppercase' as const,
};

const inputStyles = {
  input: {
    backgroundColor: '#161B23',
    border: '1px solid rgba(255,255,255,0.06)',
    color: '#C1C2C5',
    borderRadius: 8,
  },
  label: { color: '#909296', fontSize: '12px', fontWeight: 600, marginBottom: 4 },
};

export function BotUsersPage() {
  const [items, setItems] = useState<BotUserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const [balanceModalUser, setBalanceModalUser] = useState<BotUserRow | null>(null);
  const [balanceInput, setBalanceInput] = useState<number | string>(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getBotUsers({ search: search || undefined, size: 100 });
      setItems(data.items);
      setTotal(data.total);
    } catch (err) {
      notifications.show({ color: 'red', message: extractErrorMessage(err) });
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleBan = async (user: BotUserRow) => {
    try {
      await updateBotUser(user.id, { banned: !user.banned });
      notifications.show({ color: 'teal', message: user.banned ? 'Unbanned' : 'Banned' });
      void load();
    } catch (err) {
      notifications.show({ color: 'red', message: extractErrorMessage(err) });
    }
  };

  const saveBalance = async () => {
    if (!balanceModalUser) return;
    try {
      const amount = Number(balanceInput);
      if (!Number.isFinite(amount)) throw new Error('Invalid amount');
      await updateBotUser(balanceModalUser.id, { balance: amount });
      notifications.show({ color: 'teal', message: 'Balance updated' });
      setBalanceModalUser(null);
      void load();
    } catch (err) {
      notifications.show({ color: 'red', message: extractErrorMessage(err) });
    }
  };

  return (
    <>
      <PageHeader
        title="Bot Users"
        subtitle="Telegram shop bot users"
        icon={IconUsers}
        iconColor="#20C997"
        count={total}
      />

      <Paper p="md" mb="md" style={cardStyle}>
        <TextInput
          placeholder="Search by username or name"
          leftSection={<IconSearch size={16} />}
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          styles={inputStyles}
        />
      </Paper>

      <Paper p={0} style={cardStyle}>
        {loading ? (
          <Group justify="center" p="xl">
            <Loader size="sm" />
          </Group>
        ) : items.length === 0 ? (
          <Box p="xl">
            <Text size="sm" style={{ color: '#909296' }}>
              No users found
            </Text>
          </Box>
        ) : (
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th style={thStyle}>Telegram ID</Table.Th>
                <Table.Th style={thStyle}>Username</Table.Th>
                <Table.Th style={thStyle}>Name</Table.Th>
                <Table.Th style={thStyle}>Balance</Table.Th>
                <Table.Th style={thStyle}>Total Spent</Table.Th>
                <Table.Th style={thStyle}>Status</Table.Th>
                <Table.Th style={thStyle}>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {items.map((u) => (
                <Table.Tr key={u.id}>
                  <Table.Td>
                    <Text size="sm" style={{ fontFamily: "'JetBrains Mono', monospace", color: '#C1C2C5' }}>
                      {u.telegramId}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" style={{ color: '#C1C2C5' }}>
                      {u.username ? '@' + u.username : '-'}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" style={{ color: '#909296' }}>
                      {u.firstName ?? '-'}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" style={{ color: '#20C997' }}>
                      {u.balance}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" style={{ color: '#909296' }}>
                      {u.totalSpent}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    {u.banned ? (
                      <Badge color="red" variant="light" size="sm">
                        Banned
                      </Badge>
                    ) : (
                      <Badge color="teal" variant="light" size="sm">
                        Active
                      </Badge>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Group gap={4}>
                      <Tooltip label="Edit balance">
                        <ActionIcon
                          variant="subtle"
                          color="blue"
                          onClick={() => {
                            setBalanceModalUser(u);
                            setBalanceInput(Number(u.balance));
                          }}
                        >
                          <IconCoin size={16} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label={u.banned ? 'Unban' : 'Ban'}>
                        <ActionIcon
                          variant="subtle"
                          color={u.banned ? 'teal' : 'red'}
                          onClick={() => toggleBan(u)}
                        >
                          {u.banned ? <IconUserCheck size={16} /> : <IconUserOff size={16} />}
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Paper>

      <Modal
        opened={balanceModalUser !== null}
        onClose={() => setBalanceModalUser(null)}
        title="Edit balance"
        styles={{ content: { backgroundColor: '#1E2128' }, header: { backgroundColor: '#1E2128' } }}
      >
        <Stack>
          <NumberInput
            label="New balance"
            value={balanceInput}
            onChange={(v) => setBalanceInput(v)}
            step={1}
            min={0}
            decimalScale={2}
            styles={inputStyles}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setBalanceModalUser(null)}>
              Cancel
            </Button>
            <Button color="teal" onClick={saveBalance}>
              Save
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
