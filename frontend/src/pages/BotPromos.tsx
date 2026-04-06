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
  Switch,
  Table,
  Text,
  TextInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconPlus, IconTrash, IconTicket } from '@tabler/icons-react';
import { PageHeader } from '../components/PageHeader';
import {
  listBotPromos,
  createBotPromo,
  deleteBotPromo,
  type BotPromo,
} from '../api/bot';
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
  label: { color: '#909296', fontSize: '12px', fontWeight: 600, marginBottom: 4 },
};

const thStyle = {
  color: '#5c5f66',
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '0.8px',
  textTransform: 'uppercase' as const,
};

export function BotPromosPage() {
  const [items, setItems] = useState<BotPromo[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [percent, setPercent] = useState<number | ''>(10);
  const [maxUses, setMaxUses] = useState<number | ''>('');
  const [enabled, setEnabled] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await listBotPromos());
    } catch (err) {
      notifications.show({ color: 'red', message: extractErrorMessage(err) });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    try {
      await createBotPromo({
        code,
        discountPercent: percent === '' ? null : Number(percent),
        maxUses: maxUses === '' ? null : Number(maxUses),
        enabled,
      } as Partial<BotPromo>);
      notifications.show({ color: 'teal', message: 'Created' });
      setOpen(false);
      setCode('');
      setPercent(10);
      setMaxUses('');
      void load();
    } catch (err) {
      notifications.show({ color: 'red', message: extractErrorMessage(err) });
    }
  };

  const remove = async (p: BotPromo) => {
    if (!confirm(`Delete promo ${p.code}?`)) return;
    try {
      await deleteBotPromo(p.id);
      notifications.show({ color: 'teal', message: 'Deleted' });
      void load();
    } catch (err) {
      notifications.show({ color: 'red', message: extractErrorMessage(err) });
    }
  };

  return (
    <>
      <PageHeader
        title="Promo Codes"
        subtitle="Discount codes for the shop bot"
        icon={IconTicket}
        iconColor="#FCC419"
        count={items.length}
        actions={
          <Button leftSection={<IconPlus size={16} />} color="teal" onClick={() => setOpen(true)}>
            New promo
          </Button>
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
              No promo codes
            </Text>
          </Box>
        ) : (
          <Box style={{ overflowX: 'auto' }}>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th style={thStyle}>Code</Table.Th>
                <Table.Th style={thStyle}>Discount</Table.Th>
                <Table.Th style={thStyle}>Usage</Table.Th>
                <Table.Th style={thStyle}>Status</Table.Th>
                <Table.Th style={thStyle}>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {items.map((p) => (
                <Table.Tr key={p.id}>
                  <Table.Td>
                    <Text size="sm" style={{ fontFamily: "'JetBrains Mono', monospace", color: '#C1C2C5' }}>
                      {p.code}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" style={{ color: '#909296' }}>
                      {p.discountPercent ? `${p.discountPercent}%` : p.discountAmount ? `-${p.discountAmount}` : '-'}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" style={{ color: '#909296' }}>
                      {p.usedCount} / {p.maxUses ?? '∞'}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    {p.enabled ? (
                      <Badge color="teal" variant="light" size="sm">
                        enabled
                      </Badge>
                    ) : (
                      <Badge color="gray" variant="light" size="sm">
                        disabled
                      </Badge>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <ActionIcon variant="subtle" color="red" onClick={() => remove(p)}>
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
          </Box>
        )}
      </Paper>

      <Modal
        opened={open}
        onClose={() => setOpen(false)}
        title="New promo code"
        styles={{ content: { backgroundColor: '#1E2128' }, header: { backgroundColor: '#1E2128' } }}
      >
        <Stack>
          <TextInput
            label="Code"
            value={code}
            onChange={(e) => setCode(e.currentTarget.value)}
            styles={inputStyles}
          />
          <NumberInput
            label="Discount %"
            value={percent}
            onChange={(v) => setPercent((v as number) || '')}
            min={1}
            max={100}
            styles={inputStyles}
          />
          <NumberInput
            label="Max uses (empty = unlimited)"
            value={maxUses}
            onChange={(v) => setMaxUses((v as number) || '')}
            min={1}
            styles={inputStyles}
          />
          <Switch
            label="Enabled"
            checked={enabled}
            onChange={(e) => setEnabled(e.currentTarget.checked)}
            color="teal"
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button color="teal" onClick={save}>
              Create
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}

export default BotPromosPage;
