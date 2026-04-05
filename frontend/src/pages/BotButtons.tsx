import { useCallback, useEffect, useMemo, useState } from 'react';
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
  Select,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconPlus,
  IconPencil,
  IconTrash,
  IconLayoutGrid,
  IconArrowUp,
  IconArrowDown,
} from '@tabler/icons-react';
import { PageHeader } from '../components/PageHeader';
import {
  listBotButtons,
  createBotButton,
  updateBotButton,
  deleteBotButton,
  reorderBotButtons,
  getBotMenu,
  updateBotMenu,
  type BotButton,
  type BotMenuConfig,
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

const MENU_TYPES = [
  { value: 'main_menu', label: 'Main menu' },
  { value: 'buy_menu', label: 'Buy menu' },
  { value: 'profile_menu', label: 'Profile menu' },
  { value: 'support_menu', label: 'Support menu' },
  { value: 'admin_menu', label: 'Admin menu' },
];

interface ButtonForm {
  buttonId: string;
  text: string;
  callbackData: string;
  url: string;
  rowPosition: number;
  columnPosition: number;
  buttonWidth: number;
  sortOrder: number;
  isActive: boolean;
}

const emptyForm: ButtonForm = {
  buttonId: '',
  text: '',
  callbackData: '',
  url: '',
  rowPosition: 0,
  columnPosition: 0,
  buttonWidth: 1,
  sortOrder: 0,
  isActive: true,
};

export function BotButtonsPage() {
  const [menuType, setMenuType] = useState('main_menu');
  const [items, setItems] = useState<BotButton[]>([]);
  const [menuConfig, setMenuConfig] = useState<BotMenuConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<BotButton | null>(null);
  const [form, setForm] = useState<ButtonForm>(emptyForm);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [btns, menu] = await Promise.all([
        listBotButtons(menuType),
        getBotMenu(menuType),
      ]);
      setItems(btns);
      setMenuConfig(menu);
    } catch (err) {
      notifications.show({ color: 'red', message: extractErrorMessage(err) });
    } finally {
      setLoading(false);
    }
  }, [menuType]);

  const saveKeyboardMode = async (mode: 'inline' | 'reply') => {
    try {
      const updated = await updateBotMenu(menuType, { keyboardMode: mode });
      setMenuConfig(updated);
      notifications.show({
        color: 'teal',
        message: `Switched "${menuType}" to ${mode} keyboard`,
      });
    } catch (err) {
      notifications.show({ color: 'red', message: extractErrorMessage(err) });
    }
  };

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm({
      ...emptyForm,
      rowPosition: items.length > 0 ? Math.max(...items.map((i) => i.rowPosition)) + 1 : 0,
    });
    setModalOpen(true);
  };

  const openEdit = (b: BotButton) => {
    setEditing(b);
    setForm({
      buttonId: b.buttonId,
      text: b.text,
      callbackData: b.callbackData ?? '',
      url: b.url ?? '',
      rowPosition: b.rowPosition,
      columnPosition: b.columnPosition,
      buttonWidth: b.buttonWidth,
      sortOrder: b.sortOrder,
      isActive: b.isActive,
    });
    setModalOpen(true);
  };

  const save = async () => {
    try {
      const body: Partial<BotButton> = {
        text: form.text,
        callbackData: form.callbackData || null,
        url: form.url || null,
        rowPosition: form.rowPosition,
        columnPosition: form.columnPosition,
        buttonWidth: form.buttonWidth,
        sortOrder: form.sortOrder,
        isActive: form.isActive,
      };
      if (editing) {
        await updateBotButton(editing.id, body);
      } else {
        await createBotButton({
          ...body,
          menuType,
          buttonId: form.buttonId || `btn_${Date.now()}`,
        });
      }
      notifications.show({ color: 'teal', message: 'Saved' });
      setModalOpen(false);
      void load();
    } catch (err) {
      notifications.show({ color: 'red', message: extractErrorMessage(err) });
    }
  };

  const remove = async (b: BotButton) => {
    if (!confirm(`Delete button "${b.text}"?`)) return;
    try {
      await deleteBotButton(b.id);
      notifications.show({ color: 'teal', message: 'Deleted' });
      void load();
    } catch (err) {
      notifications.show({ color: 'red', message: extractErrorMessage(err) });
    }
  };

  const moveRow = async (b: BotButton, dir: 'up' | 'down') => {
    const delta = dir === 'up' ? -1 : 1;
    const newRow = Math.max(0, b.rowPosition + delta);
    try {
      await reorderBotButtons([
        {
          id: b.id,
          rowPosition: newRow,
          columnPosition: b.columnPosition,
          sortOrder: b.sortOrder,
          buttonWidth: b.buttonWidth,
        },
      ]);
      void load();
    } catch (err) {
      notifications.show({ color: 'red', message: extractErrorMessage(err) });
    }
  };

  // Build preview: group buttons by rowPosition
  const preview = useMemo(() => {
    const rowMap = new Map<number, BotButton[]>();
    for (const b of items) {
      if (!b.isActive) continue;
      const arr = rowMap.get(b.rowPosition) ?? [];
      arr.push(b);
      rowMap.set(b.rowPosition, arr);
    }
    const rows = [...rowMap.keys()].sort((a, b) => a - b);
    return rows.map((r) =>
      (rowMap.get(r) ?? []).sort(
        (a, b) => a.columnPosition - b.columnPosition || a.sortOrder - b.sortOrder,
      ),
    );
  }, [items]);

  return (
    <>
      <PageHeader
        title="Button Constructor"
        subtitle="Build the bot's inline keyboards"
        icon={IconLayoutGrid}
        iconColor="#845EF7"
        count={items.length}
        actions={
          <Group gap="sm">
            <Select
              data={MENU_TYPES}
              value={menuType}
              onChange={(v) => v && setMenuType(v)}
              styles={inputStyles}
            />
            <Button leftSection={<IconPlus size={16} />} color="teal" onClick={openCreate}>
              New button
            </Button>
          </Group>
        }
      />

      <Stack>
        <Paper p="lg" style={cardStyle}>
          <Group justify="space-between" mb="md">
            <div>
              <Text size="sm" fw={600} style={{ color: '#C1C2C5' }}>
                Keyboard mode
              </Text>
              <Text size="xs" style={{ color: '#5c5f66' }}>
                Inline shows buttons under the message. Reply shows a persistent keyboard at the bottom.
              </Text>
            </div>
            <Group gap="xs">
              <Button
                size="xs"
                variant={menuConfig?.keyboardMode === 'inline' ? 'filled' : 'default'}
                color="teal"
                onClick={() => saveKeyboardMode('inline')}
              >
                Inline
              </Button>
              <Button
                size="xs"
                variant={menuConfig?.keyboardMode === 'reply' ? 'filled' : 'default'}
                color="teal"
                onClick={() => saveKeyboardMode('reply')}
              >
                Reply
              </Button>
            </Group>
          </Group>
          <Text size="sm" fw={600} style={{ color: '#C1C2C5' }} mb="sm">
            Live preview
          </Text>
          {preview.length === 0 ? (
            <Text size="sm" style={{ color: '#5c5f66' }}>
              No buttons yet
            </Text>
          ) : (
            <Stack gap={8}>
              {preview.map((row, idx) => (
                <Group key={idx} gap={8} wrap="nowrap">
                  {row.map((b) => (
                    <Box
                      key={b.id}
                      style={{
                        flex: b.buttonWidth >= 2 ? '1 1 100%' : '1 1 50%',
                        padding: '10px 14px',
                        borderRadius: 8,
                        backgroundColor: '#2D3139',
                        border: '1px solid rgba(255,255,255,0.08)',
                        textAlign: 'center',
                        color: '#C1C2C5',
                        fontSize: 14,
                      }}
                    >
                      {b.text}
                    </Box>
                  ))}
                </Group>
              ))}
            </Stack>
          )}
        </Paper>

        <Paper p={0} style={cardStyle}>
          {loading ? (
            <Group justify="center" p="xl">
              <Loader size="sm" />
            </Group>
          ) : items.length === 0 ? (
            <Box p="xl">
              <Text size="sm" style={{ color: '#909296' }}>
                No buttons configured for this menu
              </Text>
            </Box>
          ) : (
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th style={{ color: '#5c5f66', fontSize: 11, fontWeight: 700 }}>
                    Row
                  </Table.Th>
                  <Table.Th style={{ color: '#5c5f66', fontSize: 11, fontWeight: 700 }}>
                    Text
                  </Table.Th>
                  <Table.Th style={{ color: '#5c5f66', fontSize: 11, fontWeight: 700 }}>
                    Callback / URL
                  </Table.Th>
                  <Table.Th style={{ color: '#5c5f66', fontSize: 11, fontWeight: 700 }}>
                    Width
                  </Table.Th>
                  <Table.Th style={{ color: '#5c5f66', fontSize: 11, fontWeight: 700 }}>
                    Status
                  </Table.Th>
                  <Table.Th style={{ color: '#5c5f66', fontSize: 11, fontWeight: 700 }}>
                    Actions
                  </Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {items.map((b) => (
                  <Table.Tr key={b.id}>
                    <Table.Td>
                      <Group gap={4}>
                        <Badge size="sm" variant="light">
                          {b.rowPosition}.{b.columnPosition}
                        </Badge>
                        <ActionIcon size="xs" variant="subtle" onClick={() => moveRow(b, 'up')}>
                          <IconArrowUp size={12} />
                        </ActionIcon>
                        <ActionIcon size="xs" variant="subtle" onClick={() => moveRow(b, 'down')}>
                          <IconArrowDown size={12} />
                        </ActionIcon>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" style={{ color: '#C1C2C5' }}>
                        {b.text}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" style={{ color: '#909296', fontFamily: "'JetBrains Mono', monospace" }}>
                        {b.callbackData ?? b.url ?? '-'}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" style={{ color: '#909296' }}>
                        {b.buttonWidth}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      {b.isActive ? (
                        <Badge color="teal" variant="light" size="sm">
                          active
                        </Badge>
                      ) : (
                        <Badge color="gray" variant="light" size="sm">
                          inactive
                        </Badge>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Group gap={4}>
                        <Tooltip label="Edit">
                          <ActionIcon variant="subtle" color="blue" onClick={() => openEdit(b)}>
                            <IconPencil size={16} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Delete">
                          <ActionIcon variant="subtle" color="red" onClick={() => remove(b)}>
                            <IconTrash size={16} />
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
      </Stack>

      <Modal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit button' : 'New button'}
        styles={{ content: { backgroundColor: '#1E2128' }, header: { backgroundColor: '#1E2128' } }}
      >
        <Stack>
          {!editing && (
            <TextInput
              label="Button ID (unique)"
              value={form.buttonId}
              onChange={(e) => setForm({ ...form, buttonId: e.currentTarget.value })}
              styles={inputStyles}
            />
          )}
          <TextInput
            label="Text"
            value={form.text}
            onChange={(e) => setForm({ ...form, text: e.currentTarget.value })}
            styles={inputStyles}
          />
          <TextInput
            label="Callback data (optional)"
            value={form.callbackData}
            onChange={(e) => setForm({ ...form, callbackData: e.currentTarget.value })}
            styles={inputStyles}
          />
          <TextInput
            label="URL (optional)"
            value={form.url}
            onChange={(e) => setForm({ ...form, url: e.currentTarget.value })}
            styles={inputStyles}
          />
          <Group grow>
            <NumberInput
              label="Row"
              value={form.rowPosition}
              onChange={(v) => setForm({ ...form, rowPosition: Number(v) || 0 })}
              min={0}
              styles={inputStyles}
            />
            <NumberInput
              label="Column"
              value={form.columnPosition}
              onChange={(v) => setForm({ ...form, columnPosition: Number(v) || 0 })}
              min={0}
              styles={inputStyles}
            />
            <NumberInput
              label="Width"
              value={form.buttonWidth}
              onChange={(v) => setForm({ ...form, buttonWidth: Number(v) || 1 })}
              min={1}
              max={3}
              styles={inputStyles}
            />
          </Group>
          <Switch
            label="Active"
            checked={form.isActive}
            onChange={(e) => setForm({ ...form, isActive: e.currentTarget.checked })}
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
