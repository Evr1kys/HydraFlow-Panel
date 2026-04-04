import { useEffect, useState, useCallback } from 'react';
import {
  Stack,
  Title,
  Paper,
  Group,
  Text,
  TextInput,
  Switch,
  Button,
  SimpleGrid,
  PasswordInput,
  Divider,
  NumberInput,
  Box,
  Loader,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconShieldCheck,
  IconWorld,
  IconLock,
  IconDeviceFloppy,
  IconNetwork,
  IconFilter,
  IconShieldOff,
} from '@tabler/icons-react';
import { getSettings, updateSettings } from '../api/settings';
import { changePassword } from '../api/auth';
import type { Settings } from '../types';

export function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  const fetchSettings = useCallback(async () => {
    try {
      const data = await getSettings();
      setSettings(data);
    } catch {
      notifications.show({
        title: 'Error',
        message: 'Failed to load settings',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const { id, ...data } = settings;
      void id;
      await updateSettings(data);
      notifications.show({
        title: 'Saved',
        message: 'Settings updated and Xray restarted',
        color: 'teal',
      });
    } catch {
      notifications.show({
        title: 'Error',
        message: 'Failed to save settings',
        color: 'red',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword) return;
    setChangingPassword(true);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      notifications.show({
        title: 'Success',
        message: 'Password changed',
        color: 'teal',
      });
    } catch {
      notifications.show({
        title: 'Error',
        message: 'Failed to change password. Check current password.',
        color: 'red',
      });
    } finally {
      setChangingPassword(false);
    }
  };

  const update = (field: keyof Settings, value: Settings[keyof Settings]) => {
    if (!settings) return;
    setSettings({ ...settings, [field]: value });
  };

  if (loading || !settings) {
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

  const inputStyles = {
    input: {
      backgroundColor: '#060a12',
      borderColor: '#1a2940',
      color: '#d0d7e3',
    },
    label: { color: '#97a8c2' },
  };

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Title order={2} style={{ color: '#d0d7e3' }}>
          Settings
        </Title>
        <Button
          leftSection={<IconDeviceFloppy size={16} />}
          variant="gradient"
          gradient={{ from: 'teal', to: 'cyan' }}
          loading={saving}
          onClick={handleSave}
        >
          Save & Restart
        </Button>
      </Group>

      <TextInput
        label="Server IP"
        placeholder="Your server public IP"
        leftSection={<IconNetwork size={16} />}
        value={settings.serverIp ?? ''}
        onChange={(e) => update('serverIp', e.currentTarget.value)}
        styles={inputStyles}
      />

      <SimpleGrid cols={{ base: 1, md: 3 }}>
        <Paper
          p="md"
          radius="md"
          style={{
            backgroundColor: '#0b1121',
            border: `1px solid ${settings.realityEnabled ? '#00e8c6' : '#1a2940'}`,
          }}
        >
          <Group justify="space-between" mb="md">
            <Group gap="xs">
              <IconShieldCheck size={20} color="#00e8c6" />
              <Text fw={600}>VLESS+Reality</Text>
            </Group>
            <Switch
              checked={settings.realityEnabled}
              onChange={(e) =>
                update('realityEnabled', e.currentTarget.checked)
              }
              color="teal"
            />
          </Group>
          <Stack gap="sm">
            <NumberInput
              label="Port"
              value={settings.realityPort}
              onChange={(v) => update('realityPort', Number(v))}
              styles={inputStyles}
            />
            <TextInput
              label="SNI"
              value={settings.realitySni}
              onChange={(e) => update('realitySni', e.currentTarget.value)}
              styles={inputStyles}
            />
            <TextInput
              label="Public Key"
              value={settings.realityPbk ?? ''}
              onChange={(e) => update('realityPbk', e.currentTarget.value)}
              styles={inputStyles}
            />
            <TextInput
              label="Private Key"
              value={settings.realityPvk ?? ''}
              onChange={(e) => update('realityPvk', e.currentTarget.value)}
              styles={inputStyles}
            />
            <TextInput
              label="Short ID"
              value={settings.realitySid ?? ''}
              onChange={(e) => update('realitySid', e.currentTarget.value)}
              styles={inputStyles}
            />
          </Stack>
        </Paper>

        <Paper
          p="md"
          radius="md"
          style={{
            backgroundColor: '#0b1121',
            border: `1px solid ${settings.wsEnabled ? '#339af0' : '#1a2940'}`,
          }}
        >
          <Group justify="space-between" mb="md">
            <Group gap="xs">
              <IconWorld size={20} color="#339af0" />
              <Text fw={600}>VLESS+WebSocket</Text>
            </Group>
            <Switch
              checked={settings.wsEnabled}
              onChange={(e) =>
                update('wsEnabled', e.currentTarget.checked)
              }
              color="blue"
            />
          </Group>
          <Stack gap="sm">
            <NumberInput
              label="Port"
              value={settings.wsPort}
              onChange={(v) => update('wsPort', Number(v))}
              styles={inputStyles}
            />
            <TextInput
              label="Path"
              value={settings.wsPath ?? ''}
              onChange={(e) => update('wsPath', e.currentTarget.value)}
              styles={inputStyles}
            />
            <TextInput
              label="Host"
              value={settings.wsHost ?? ''}
              onChange={(e) => update('wsHost', e.currentTarget.value)}
              styles={inputStyles}
            />
          </Stack>
        </Paper>

        <Paper
          p="md"
          radius="md"
          style={{
            backgroundColor: '#0b1121',
            border: `1px solid ${settings.ssEnabled ? '#be4bdb' : '#1a2940'}`,
          }}
        >
          <Group justify="space-between" mb="md">
            <Group gap="xs">
              <IconLock size={20} color="#be4bdb" />
              <Text fw={600}>Shadowsocks</Text>
            </Group>
            <Switch
              checked={settings.ssEnabled}
              onChange={(e) =>
                update('ssEnabled', e.currentTarget.checked)
              }
              color="grape"
            />
          </Group>
          <Stack gap="sm">
            <NumberInput
              label="Port"
              value={settings.ssPort}
              onChange={(v) => update('ssPort', Number(v))}
              styles={inputStyles}
            />
            <TextInput
              label="Method"
              value={settings.ssMethod}
              onChange={(e) => update('ssMethod', e.currentTarget.value)}
              styles={inputStyles}
            />
            <PasswordInput
              label="Password"
              value={settings.ssPassword ?? ''}
              onChange={(e) => update('ssPassword', e.currentTarget.value)}
              styles={inputStyles}
            />
          </Stack>
        </Paper>
      </SimpleGrid>

      <Title order={4} style={{ color: '#d0d7e3' }} mt="sm">
        Features
      </Title>
      <Paper
        p="md"
        radius="md"
        style={{
          backgroundColor: '#0b1121',
          border: '1px solid #1a2940',
        }}
      >
        <SimpleGrid cols={{ base: 1, sm: 3 }}>
          <Group justify="space-between">
            <Group gap="xs">
              <IconFilter size={18} color="#00e8c6" />
              <Text size="sm">Split Tunneling</Text>
            </Group>
            <Switch
              checked={settings.splitTunneling}
              onChange={(e) =>
                update('splitTunneling', e.currentTarget.checked)
              }
              color="teal"
            />
          </Group>
          <Group justify="space-between">
            <Group gap="xs">
              <IconShieldOff size={18} color="#ff6b6b" />
              <Text size="sm">Ad Blocking</Text>
            </Group>
            <Switch
              checked={settings.adBlocking}
              onChange={(e) =>
                update('adBlocking', e.currentTarget.checked)
              }
              color="teal"
            />
          </Group>
          <TextInput
            label="CDN Domain"
            placeholder="cdn.example.com"
            value={settings.cdnDomain ?? ''}
            onChange={(e) => update('cdnDomain', e.currentTarget.value)}
            size="xs"
            styles={inputStyles}
          />
        </SimpleGrid>
      </Paper>

      <Divider color="#1a2940" />

      <Title order={4} style={{ color: '#d0d7e3' }}>
        Admin
      </Title>
      <Paper
        p="md"
        radius="md"
        style={{
          backgroundColor: '#0b1121',
          border: '1px solid #1a2940',
        }}
      >
        <Group align="end">
          <PasswordInput
            label="Current Password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.currentTarget.value)}
            styles={inputStyles}
            style={{ flex: 1 }}
          />
          <PasswordInput
            label="New Password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.currentTarget.value)}
            styles={inputStyles}
            style={{ flex: 1 }}
          />
          <Button
            variant="light"
            color="teal"
            loading={changingPassword}
            onClick={handleChangePassword}
          >
            Change
          </Button>
        </Group>
      </Paper>
    </Stack>
  );
}
