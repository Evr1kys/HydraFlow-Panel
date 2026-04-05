import { useCallback, useEffect, useState } from 'react';
import {
  Badge,
  Box,
  Group,
  Loader,
  Paper,
  Select,
  Table,
  Text,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconReceipt2 } from '@tabler/icons-react';
import { PageHeader } from '../components/PageHeader';
import { listBotTransactions, type BotTransaction } from '../api/bot';
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

function statusColor(status: string): string {
  switch (status) {
    case 'completed':
      return 'teal';
    case 'pending':
      return 'yellow';
    case 'failed':
      return 'red';
    case 'cancelled':
      return 'gray';
    default:
      return 'gray';
  }
}

export function BotTransactionsPage() {
  const [items, setItems] = useState<BotTransaction[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listBotTransactions({
        status: status ?? undefined,
        size: 100,
      });
      setItems(data.items);
      setTotal(data.total);
    } catch (err) {
      notifications.show({ color: 'red', message: extractErrorMessage(err) });
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <PageHeader
        title="Bot Transactions"
        subtitle="Payment history from the shop bot"
        icon={IconReceipt2}
        iconColor="#20C997"
        count={total}
        actions={
          <Select
            placeholder="Filter by status"
            clearable
            data={[
              { value: 'pending', label: 'Pending' },
              { value: 'completed', label: 'Completed' },
              { value: 'failed', label: 'Failed' },
              { value: 'cancelled', label: 'Cancelled' },
            ]}
            value={status}
            onChange={setStatus}
            styles={inputStyles}
          />
        }
      />

      <Paper p={0} style={cardStyle}>
        {loading ? (
          <Group justify="center" p="xl">
            <Loader size="sm" />
          </Group>
        ) : items.length === 0 ? (
          <Box p="xl">
            <Text size="sm" style={{ color: '#909296' }}>
              No transactions
            </Text>
          </Box>
        ) : (
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th style={thStyle}>Date</Table.Th>
                <Table.Th style={thStyle}>Type</Table.Th>
                <Table.Th style={thStyle}>Amount</Table.Th>
                <Table.Th style={thStyle}>Provider</Table.Th>
                <Table.Th style={thStyle}>Promo</Table.Th>
                <Table.Th style={thStyle}>Status</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {items.map((t) => (
                <Table.Tr key={t.id}>
                  <Table.Td>
                    <Text size="xs" style={{ color: '#909296', fontFamily: "'JetBrains Mono', monospace" }}>
                      {new Date(t.createdAt).toISOString().slice(0, 19).replace('T', ' ')}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" style={{ color: '#C1C2C5' }}>
                      {t.type}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" style={{ color: '#20C997', fontFamily: "'JetBrains Mono', monospace" }}>
                      {t.amount} {t.currency}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" style={{ color: '#909296' }}>
                      {t.provider}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs" style={{ color: '#5c5f66', fontFamily: "'JetBrains Mono', monospace" }}>
                      {t.promoCode ?? '-'}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge color={statusColor(t.status)} variant="light" size="sm">
                      {t.status}
                    </Badge>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Paper>
    </>
  );
}
