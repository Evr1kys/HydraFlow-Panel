import { useEffect, useState, useCallback } from 'react';
import {
  Stack,
  Paper,
  Group,
  Text,
  TextInput,
  Switch,
  Button,
  SimpleGrid,
  PasswordInput,
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

function SectionTitle({ children }: { children: string }) {
  return (
    <Group gap={0} mt="lg" mb={8}>
      <Box
        style={{
          width: 3,
          height: 14,
          borderRadius: 2,
          backgroundColor: '#20C997',
          marginRight: 8,
          flexShrink: 0,
        }}
      />
      <Text
        size="11px"
        fw={700}
        style={{
          color: '#5c5f66',
          letterSpacing: '1.5px',
          textTransform: 'uppercase',
        }}
      >
        {children}
      </Text>
    </Group>
  );
}

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

  return (
    <Stack gap={0}>
      {/* Header */}
      <Group justify="space-between" mb="lg">
        <Text size="22px" fw={700} style={{ color: '#C1C2C5' }}>
          Configuration
        </Text>
        <Button
          leftSection={<IconDeviceFloppy size={16} />}
          variant="gradient"
          gradient={{ from: 'teal', to: 'cyan' }}
          radius="md"
          loading={saving}
          onClick={handleSave}
        >
          Save & Restart
        </Button>
      </Group>

      {/* Server IP */}
      <Paper p="lg" style={cardStyle} mb="md">
        <TextInput
          label="Server IP"
          placeholder="Your server public IP"
          leftSection={<IconNetwork size={16} color="#909296" />}
          value={settings.serverIp ?? ''}
          onChange={(e) => update('serverIp', e.currentTarget.value)}
          styles={inputStyles}
        />
      </Paper>

      {/* Protocol cards */}
      <SectionTitle>Protocols</SectionTitle>
      <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
        {/* Reality */}
        <Paper
          style={{
            ...cardStyle,
            overflow: 'hidden',
            borderColor: settings.realityEnabled
              ? 'rgba(32,201,151,0.25)'
              : 'rgba(255,255,255,0.06)',
          }}
        >
          <Box
            px="lg"
            py="sm"
            style={{
              background: settings.realityEnabled
                ? 'linear-gradient(135deg, rgba(32,201,151,0.12), rgba(32,201,151,0.04))'
                : 'rgba(255,255,255,0.02)',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <Group justify="space-between">
              <Group gap={8}>
                <IconShieldCheck size={18} color={settings.realityEnabled ? '#20C997' : '#5c5f66'} />
                <Text fw={600} size="sm" style={{ color: settings.realityEnabled ? '#C1C2C5' : '#5c5f66' }}>
                  VLESS+Reality
                </Text>
              </Group>
              <Switch
                checked={settings.realityEnabled}
                onChange={(e) => update('realityEnabled', e.currentTarget.checked)}
                color="teal"
                size="sm"
              />
            </Group>
          </Box>
          <Stack gap="sm" p="lg">
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

        {/* WebSocket */}
        <Paper
          style={{
            ...cardStyle,
            overflow: 'hidden',
            borderColor: settings.wsEnabled
              ? 'rgba(51,154,240,0.25)'
              : 'rgba(255,255,255,0.06)',
          }}
        >
          <Box
            px="lg"
            py="sm"
            style={{
              background: settings.wsEnabled
                ? 'linear-gradient(135deg, rgba(51,154,240,0.12), rgba(51,154,240,0.04))'
                : 'rgba(255,255,255,0.02)',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <Group justify="space-between">
              <Group gap={8}>
                <IconWorld size={18} color={settings.wsEnabled ? '#339AF0' : '#5c5f66'} />
                <Text fw={600} size="sm" style={{ color: settings.wsEnabled ? '#C1C2C5' : '#5c5f66' }}>
                  VLESS+WebSocket
                </Text>
              </Group>
              <Switch
                checked={settings.wsEnabled}
                onChange={(e) => update('wsEnabled', e.currentTarget.checked)}
                color="blue"
                size="sm"
              />
            </Group>
          </Box>
          <Stack gap="sm" p="lg">
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

        {/* Shadowsocks */}
        <Paper
          style={{
            ...cardStyle,
            overflow: 'hidden',
            borderColor: settings.ssEnabled
              ? 'rgba(132,94,247,0.25)'
              : 'rgba(255,255,255,0.06)',
          }}
        >
          <Box
            px="lg"
            py="sm"
            style={{
              background: settings.ssEnabled
                ? 'linear-gradient(135deg, rgba(132,94,247,0.12), rgba(132,94,247,0.04))'
                : 'rgba(255,255,255,0.02)',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <Group justify="space-between">
              <Group gap={8}>
                <IconLock size={18} color={settings.ssEnabled ? '#845EF7' : '#5c5f66'} />
                <Text fw={600} size="sm" style={{ color: settings.ssEnabled ? '#C1C2C5' : '#5c5f66' }}>
                  Shadowsocks
                </Text>
              </Group>
              <Switch
                checked={settings.ssEnabled}
                onChange={(e) => update('ssEnabled', e.currentTarget.checked)}
                color="grape"
                size="sm"
              />
            </Group>
          </Box>
          <Stack gap="sm" p="lg">
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

      {/* Features */}
      <SectionTitle>Features</SectionTitle>
      <Paper p="lg" style={cardStyle}>
        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="xl">
          <Group justify="space-between">
            <Group gap={8}>
              <Box
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  backgroundColor: 'rgba(32,201,151,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <IconFilter size={16} color="#20C997" />
              </Box>
              <Box>
                <Text size="sm" fw={500} style={{ color: '#C1C2C5' }}>
                  Split Tunneling
                </Text>
                <Text size="xs" style={{ color: '#5c5f66' }}>
                  Route traffic selectively
                </Text>
              </Box>
            </Group>
            <Switch
              checked={settings.splitTunneling}
              onChange={(e) => update('splitTunneling', e.currentTarget.checked)}
              color="teal"
              size="sm"
            />
          </Group>
          <Group justify="space-between">
            <Group gap={8}>
              <Box
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  backgroundColor: 'rgba(255,107,107,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <IconShieldOff size={16} color="#ff6b6b" />
              </Box>
              <Box>
                <Text size="sm" fw={500} style={{ color: '#C1C2C5' }}>
                  Ad Blocking
                </Text>
                <Text size="xs" style={{ color: '#5c5f66' }}>
                  Block ads and trackers
                </Text>
              </Box>
            </Group>
            <Switch
              checked={settings.adBlocking}
              onChange={(e) => update('adBlocking', e.currentTarget.checked)}
              color="teal"
              size="sm"
            />
          </Group>
          <TextInput
            label="CDN Domain"
            placeholder="cdn.example.com"
            value={settings.cdnDomain ?? ''}
            onChange={(e) => update('cdnDomain', e.currentTarget.value)}
            size="sm"
            styles={inputStyles}
          />
        </SimpleGrid>
      </Paper>

      {/* Admin / Password */}
      <SectionTitle>Admin</SectionTitle>
      <Paper p="lg" style={cardStyle}>
        <Group align="end" gap="md">
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
            radius="md"
            loading={changingPassword}
            onClick={handleChangePassword}
            styles={{
              root: {
                border: '1px solid rgba(32,201,151,0.2)',
                height: 36,
              },
            }}
          >
            Change
          </Button>
        </Group>
      </Paper>
    </Stack>
  );
}
