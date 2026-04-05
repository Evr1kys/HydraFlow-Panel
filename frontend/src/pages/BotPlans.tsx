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
import {
  IconPlus,
  IconPencil,
  IconTrash,
  IconReceiptTax,
} from '@tabler/icons-react';
import { PageHeader } from '../components/PageHeader';
import {
  listBotPlans,
  createBotPlan,
  updateBotPlan,
  deleteBotPlan,
  type BotPlan,
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

interface EditableFields {
  name: string;
  daysDuration: number;
  trafficGb: number | '';
  price: number;
  currency: string;
  enabled: boolean;
  sortOrder: number;
}

const emptyForm: EditableFields = {
  name: '',
  daysDuration: 30,
  trafficGb: '',
  price: 0,
  currency: 'RUB',
  enabled: true,
  sortOrder: 0,
};

export function BotPlansPage() {
  const [items, setItems] = useState<BotPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<BotPlan | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<EditableFields>(emptyForm);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await listBotPlans());
    } catch (err) {
      notifications.show({ color: 'red', message: extractErrorMessage(err) });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (p: BotPlan) => {
    setEditing(p);
    setForm({
      name: p.name,
      daysDuration: p.daysDuration,
      trafficGb: p.trafficGb ?? '',
      price: Number(p.price),
      currency: p.currency,
      enabled: p.enabled,
      sortOrder: p.sortOrder,
    });
    setModalOpen(true);
  };

  const save = async () => {
    try {
      const body = {
        name: form.name,
        daysDuration: form.daysDuration,
        trafficGb: form.trafficGb === '' ? null : Number(form.trafficGb),
        price: form.price,
        currency: form.currency,
        enabled: form.enabled,
        sortOrder: form.sortOrder,
      } as unknown as Partial<BotPlan>;
      if (editing) {
        await updateBotPlan(editing.id, body);
      } else {
        await createBotPlan(body);
      }
      notifications.show({ color: 'teal', message: 'Saved' });
      setModalOpen(false);
      void load();
    } catch (err) {
      notifications.show({ color: 'red', message: extractErrorMessage(err) });
    }
  };

  const remove = async (p: BotPlan) => {
    if (!confirm(`Delete plan ${p.name}?`)) return;
    try {
      await deleteBotPlan(p.id);
      notifications.show({ color: 'teal', message: 'Deleted' });
      void load();
    } catch (err) {
      notifications.show({ color: 'red', message: extractErrorMessage(err) });
    }
  };

  return (
    <>
      <PageHeader
        title="Bot Plans"
        subtitle="Subscription plans offered by the shop bot"
        icon={IconReceiptTax}
        iconColor="#339AF0"
        count={items.length}
        actions={
          <Button leftSection={<IconPlus size={16} />} color="teal" onClick={openCreate}>
            New plan
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
              No plans yet
            </Text>
          </Box>
        ) : (
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th style={thStyle}>Name</Table.Th>
                <Table.Th style={thStyle}>Duration</Table.Th>
                <Table.Th style={thStyle}>Traffic</Table.Th>
                <Table.Th style={thStyle}>Price</Table.Th>
                <Table.Th style={thStyle}>Status</Table.Th>
                <Table.Th style={thStyle}>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {items.map((p) => (
                <Table.Tr key={p.id}>
                  <Table.Td>
                    <Text size="sm" style={{ color: '#C1C2C5' }}>
                      {p.name}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" style={{ color: '#909296' }}>
                      {p.daysDuration}d
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" style={{ color: '#909296' }}>
                      {p.trafficGb === null ? 'unlimited' : `${p.trafficGb} GB`}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" style={{ color: '#20C997', fontFamily: "'JetBrains Mono', monospace" }}>
                      {p.price} {p.currency}
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
                    <Group gap={4}>
                      <ActionIcon variant="subtle" color="blue" onClick={() => openEdit(p)}>
                        <IconPencil size={16} />
                      </ActionIcon>
                      <ActionIcon variant="subtle" color="red" onClick={() => remove(p)}>
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Paper>

      <Modal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit plan' : 'New plan'}
        styles={{ content: { backgroundColor: '#1E2128' }, header: { backgroundColor: '#1E2128' } }}
      >
        <Stack>
          <TextInput
            label="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.currentTarget.value })}
            styles={inputStyles}
          />
          <NumberInput
            label="Duration (days)"
            value={form.daysDuration}
            onChange={(v) => setForm({ ...form, daysDuration: Number(v) || 0 })}
            min={1}
            styles={inputStyles}
          />
          <NumberInput
            label="Traffic (GB, empty = unlimited)"
            value={form.trafficGb}
            onChange={(v) => setForm({ ...form, trafficGb: (v as number) || '' })}
            min={0}
            styles={inputStyles}
          />
          <NumberInput
            label="Price"
            value={form.price}
            onChange={(v) => setForm({ ...form, price: Number(v) || 0 })}
            min={0}
            decimalScale={2}
            styles={inputStyles}
          />
          <TextInput
            label="Currency"
            value={form.currency}
            onChange={(e) => setForm({ ...form, currency: e.currentTarget.value })}
            styles={inputStyles}
          />
          <NumberInput
            label="Sort order"
            value={form.sortOrder}
            onChange={(v) => setForm({ ...form, sortOrder: Number(v) || 0 })}
            styles={inputStyles}
          />
          <Switch
            label="Enabled"
            checked={form.enabled}
            onChange={(e) => setForm({ ...form, enabled: e.currentTarget.checked })}
            color="teal"
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button color="teal" onClick={save}>
              Save
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
