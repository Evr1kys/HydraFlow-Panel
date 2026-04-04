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
  Badge,
  Table,
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
  IconFingerprint,
  IconPlus,
  IconTrash,
  IconBrandGithub,
  IconBrandTelegram,
  IconUnlink,
} from '@tabler/icons-react';
import { getSettings, updateSettings } from '../api/settings';
import {
  changePassword,
  getPasskeyRegisterOptions,
  verifyPasskeyRegister,
  listPasskeys,
  deletePasskey,
  getLinkedOAuthAccounts,
  unlinkOAuthAccount,
} from '../api/auth';
import type { PasskeyInfo, OAuthAccount } from '../api/auth';
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

function YandexIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M13.32 21.634h2.504V2.366h-3.39c-4.108 0-6.26 2.121-6.26 5.207 0 2.583 1.31 4.052 3.576 5.575l-3.997 8.486h2.715l4.329-9.186-1.26-.848c-1.848-1.26-2.818-2.387-2.818-4.349 0-1.92 1.31-3.243 3.63-3.243h.97v17.626z" />
    </svg>
  );
}

function providerIcon(provider: string) {
  switch (provider) {
    case 'github':
      return <IconBrandGithub size={16} />;
    case 'telegram':
      return <IconBrandTelegram size={16} />;
    case 'yandex':
      return <YandexIcon size={16} />;
    default:
      return null;
  }
}

export function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  // Passkeys
  const [passkeys, setPasskeys] = useState<PasskeyInfo[]>([]);
  const [addingPasskey, setAddingPasskey] = useState(false);

  // OAuth accounts
  const [oauthAccounts, setOauthAccounts] = useState<OAuthAccount[]>([]);

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

  const fetchPasskeys = useCallback(async () => {
    try {
      const data = await listPasskeys();
      setPasskeys(data);
    } catch {
      // passkeys not available yet, ignore
    }
  }, []);

  const fetchOAuthAccounts = useCallback(async () => {
    try {
      const data = await getLinkedOAuthAccounts();
      setOauthAccounts(data);
    } catch {
      // OAuth accounts not available yet, ignore
    }
  }, []);

  useEffect(() => {
    fetchSettings();
    fetchPasskeys();
    fetchOAuthAccounts();
  }, [fetchSettings, fetchPasskeys, fetchOAuthAccounts]);

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

  const handleAddPasskey = async () => {
    setAddingPasskey(true);
    try {
      const { startRegistration } = await import('@simplewebauthn/browser');
      const options = await getPasskeyRegisterOptions();
      const credential = await startRegistration({ optionsJSON: options as Parameters<typeof startRegistration>[0]['optionsJSON'] });
      await verifyPasskeyRegister(credential);
      notifications.show({
        title: 'Success',
        message: 'Passkey registered successfully',
        color: 'teal',
      });
      fetchPasskeys();
    } catch {
      notifications.show({
        title: 'Error',
        message: 'Failed to register passkey',
        color: 'red',
      });
    } finally {
      setAddingPasskey(false);
    }
  };

  const handleDeletePasskey = async (id: string) => {
    try {
      await deletePasskey(id);
      notifications.show({
        title: 'Success',
        message: 'Passkey deleted',
        color: 'teal',
      });
      fetchPasskeys();
    } catch {
      notifications.show({
        title: 'Error',
        message: 'Failed to delete passkey',
        color: 'red',
      });
    }
  };

  const handleUnlinkOAuth = async (accountId: string) => {
    try {
      await unlinkOAuthAccount(accountId);
      notifications.show({
        title: 'Success',
        message: 'OAuth account unlinked',
        color: 'teal',
      });
      fetchOAuthAccounts();
    } catch {
      notifications.show({
        title: 'Error',
        message: 'Failed to unlink account',
        color: 'red',
      });
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

      {/* Passkeys */}
      <SectionTitle>Passkeys</SectionTitle>
      <Paper p="lg" style={cardStyle}>
        <Group justify="space-between" mb="md">
          <Group gap={8}>
            <IconFingerprint size={20} color="#20C997" />
            <Box>
              <Text size="sm" fw={600} style={{ color: '#C1C2C5' }}>
                WebAuthn Passkeys
              </Text>
              <Text size="xs" style={{ color: '#5c5f66' }}>
                Use fingerprint, face, or security key to sign in
              </Text>
            </Box>
          </Group>
          <Button
            leftSection={<IconPlus size={14} />}
            variant="light"
            color="teal"
            radius="md"
            size="sm"
            loading={addingPasskey}
            onClick={handleAddPasskey}
            styles={{
              root: { border: '1px solid rgba(32,201,151,0.2)' },
            }}
          >
            Add Passkey
          </Button>
        </Group>

        {passkeys.length === 0 ? (
          <Text size="sm" style={{ color: '#5c5f66' }}>
            No passkeys registered yet. Add one to enable passwordless login.
          </Text>
        ) : (
          <Table
            highlightOnHover
            styles={{
              table: { borderCollapse: 'separate', borderSpacing: 0 },
              th: {
                color: '#909296',
                fontSize: '11px',
                fontWeight: 700,
                textTransform: 'uppercase' as const,
                letterSpacing: '1px',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                padding: '8px 12px',
              },
              td: {
                color: '#C1C2C5',
                fontSize: '13px',
                borderBottom: '1px solid rgba(255,255,255,0.04)',
                padding: '8px 12px',
              },
              tr: {
                '&:hover': { backgroundColor: 'rgba(255,255,255,0.02)' },
              },
            }}
          >
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Credential</Table.Th>
                <Table.Th>Transports</Table.Th>
                <Table.Th>Created</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {passkeys.map((pk) => (
                <Table.Tr key={pk.id}>
                  <Table.Td>
                    <Text size="xs" style={{ fontFamily: 'monospace', color: '#909296' }}>
                      {pk.credentialId.slice(0, 16)}...
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap={4}>
                      {pk.transports.map((t) => (
                        <Badge
                          key={t}
                          size="xs"
                          variant="outline"
                          color="teal"
                        >
                          {t}
                        </Badge>
                      ))}
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    {new Date(pk.createdAt).toLocaleDateString()}
                  </Table.Td>
                  <Table.Td>
                    <Button
                      size="xs"
                      variant="subtle"
                      color="red"
                      leftSection={<IconTrash size={14} />}
                      onClick={() => handleDeletePasskey(pk.id)}
                    >
                      Delete
                    </Button>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Paper>

      {/* OAuth Accounts */}
      <SectionTitle>Linked OAuth Accounts</SectionTitle>
      <Paper p="lg" style={cardStyle}>
        <Group gap={8} mb="md">
          <Box>
            <Text size="sm" fw={600} style={{ color: '#C1C2C5' }}>
              External Accounts
            </Text>
            <Text size="xs" style={{ color: '#5c5f66' }}>
              Link OAuth accounts to enable social login (Telegram, GitHub, Yandex)
            </Text>
          </Box>
        </Group>

        {oauthAccounts.length === 0 ? (
          <Text size="sm" style={{ color: '#5c5f66' }}>
            No OAuth accounts linked. Log in via OAuth to automatically link your account.
          </Text>
        ) : (
          <Table
            highlightOnHover
            styles={{
              table: { borderCollapse: 'separate', borderSpacing: 0 },
              th: {
                color: '#909296',
                fontSize: '11px',
                fontWeight: 700,
                textTransform: 'uppercase' as const,
                letterSpacing: '1px',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                padding: '8px 12px',
              },
              td: {
                color: '#C1C2C5',
                fontSize: '13px',
                borderBottom: '1px solid rgba(255,255,255,0.04)',
                padding: '8px 12px',
              },
              tr: {
                '&:hover': { backgroundColor: 'rgba(255,255,255,0.02)' },
              },
            }}
          >
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Provider</Table.Th>
                <Table.Th>Email</Table.Th>
                <Table.Th>Linked</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {oauthAccounts.map((acc) => (
                <Table.Tr key={acc.id}>
                  <Table.Td>
                    <Group gap={6}>
                      {providerIcon(acc.provider)}
                      <Text size="sm" tt="capitalize">
                        {acc.provider}
                      </Text>
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs" style={{ color: '#909296' }}>
                      {acc.email ?? '-'}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    {new Date(acc.createdAt).toLocaleDateString()}
                  </Table.Td>
                  <Table.Td>
                    <Button
                      size="xs"
                      variant="subtle"
                      color="red"
                      leftSection={<IconUnlink size={14} />}
                      onClick={() => handleUnlinkOAuth(acc.id)}
                    >
                      Unlink
                    </Button>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Paper>
    </Stack>
  );
}
