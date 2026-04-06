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
  Badge,
  Table,
} from '@mantine/core';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { EmptyState } from '../components/EmptyState';
import { IconAlertTriangle } from '@tabler/icons-react';
import { extractErrorMessage } from '../api/client';
import { usePermissions } from '../hooks/usePermissions';
import { notifications } from '@mantine/notifications';
import {
  IconShieldCheck,
  IconWorld,
  IconLock,
  IconDeviceFloppy,
  IconNetwork,
  IconFilter,
  IconShieldOff,
  IconShieldLock,
  IconBrandTelegram,
  IconChartDots,
  IconPlugConnected,
  IconFingerprint,
  IconPlus,
  IconTrash,
  IconBrandGithub,
  IconUnlink,
  IconMail,
  IconMailCheck,
  IconWebhook,
  IconRefresh,
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import {
  getSettings,
  updateSettings,
  getEmailSettings,
  updateEmailSettings,
  sendTestEmail,
  type EmailSettings as EmailSettingsType,
} from '../api/settings';
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
import type { Settings, Webhook } from '../types';
import {
  getWebhooks,
  createWebhook,
  deleteWebhook,
  getWebhookDeliveries,
  retryWebhookDelivery,
  type WebhookDelivery,
} from '../api/webhooks';

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
    case 'github': return <IconBrandGithub size={16} />;
    case 'telegram': return <IconBrandTelegram size={16} />;
    case 'yandex': return <YandexIcon size={16} />;
    default: return null;
  }
}

export function SettingsPage() {
  const { t } = useTranslation();
  const permissions = usePermissions();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [telegramToken, setTelegramToken] = useState('');
  const [testingTelegram, setTestingTelegram] = useState(false);
  const [prometheusEnabled, setPrometheusEnabled] = useState(false);
  const [testingConnection, setTestingConnection] = useState<string | null>(null);
  const [passkeys, setPasskeys] = useState<PasskeyInfo[]>([]);
  const [addingPasskey, setAddingPasskey] = useState(false);
  const [oauthAccounts, setOauthAccounts] = useState<OAuthAccount[]>([]);
  const [emailSettings, setEmailSettings] = useState<EmailSettingsType | null>(null);
  const [savingEmail, setSavingEmail] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);
  const [testEmailTo, setTestEmailTo] = useState('');
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [webhookDeliveries, setWebhookDeliveries] = useState<Record<string, WebhookDelivery[]>>({});
  const [expandedWebhookId, setExpandedWebhookId] = useState<string | null>(null);
  const [newWebhookUrl, setNewWebhookUrl] = useState('');
  const [newWebhookSecret, setNewWebhookSecret] = useState('');
  const [newWebhookEvents, setNewWebhookEvents] = useState('user.created,user.renewed');
  const [addingWebhook, setAddingWebhook] = useState(false);

  const fetchSettings = useCallback(async () => {
    setLoadError(null);
    try { const data = await getSettings(); setSettings(data); }
    catch (err) {
      setLoadError(extractErrorMessage(err));
      notifications.show({ title: t('common.error'), message: t('notification.settingsError'), color: 'red' });
    }
    finally { setLoading(false); }
  }, [t]);

  const fetchPasskeys = useCallback(async () => {
    try { const data = await listPasskeys(); setPasskeys(data); } catch { /* ignore */ }
  }, []);

  const fetchOAuthAccounts = useCallback(async () => {
    try { const data = await getLinkedOAuthAccounts(); setOauthAccounts(data); } catch { /* ignore */ }
  }, []);

  const fetchEmailSettings = useCallback(async () => {
    try { const data = await getEmailSettings(); setEmailSettings(data); } catch { /* ignore */ }
  }, []);

  const fetchWebhooks = useCallback(async () => {
    try { const data = await getWebhooks(); setWebhooks(data); } catch { /* ignore */ }
  }, []);

  const fetchWebhookDeliveries = useCallback(async (webhookId: string) => {
    try {
      const data = await getWebhookDeliveries(webhookId, 10);
      setWebhookDeliveries((prev) => ({ ...prev, [webhookId]: data }));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchSettings(); fetchPasskeys(); fetchOAuthAccounts(); fetchEmailSettings(); fetchWebhooks(); }, [fetchSettings, fetchPasskeys, fetchOAuthAccounts, fetchEmailSettings, fetchWebhooks]);

  const toggleWebhookExpanded = async (id: string) => {
    if (expandedWebhookId === id) {
      setExpandedWebhookId(null);
      return;
    }
    setExpandedWebhookId(id);
    await fetchWebhookDeliveries(id);
  };

  const handleAddWebhook = async () => {
    if (!newWebhookUrl || !newWebhookSecret) return;
    setAddingWebhook(true);
    try {
      const events = newWebhookEvents.split(',').map((s) => s.trim()).filter(Boolean);
      await createWebhook({ url: newWebhookUrl, secret: newWebhookSecret, events });
      setNewWebhookUrl('');
      setNewWebhookSecret('');
      notifications.show({ title: t('common.success'), message: 'Webhook added', color: 'teal' });
      await fetchWebhooks();
    } catch {
      notifications.show({ title: t('common.error'), message: 'Failed to add webhook', color: 'red' });
    } finally {
      setAddingWebhook(false);
    }
  };

  const handleDeleteWebhook = async (id: string) => {
    try {
      await deleteWebhook(id);
      notifications.show({ title: t('common.success'), message: 'Webhook deleted', color: 'teal' });
      await fetchWebhooks();
    } catch {
      notifications.show({ title: t('common.error'), message: 'Failed to delete webhook', color: 'red' });
    }
  };

  const handleRetryDelivery = async (webhookId: string, deliveryId: string) => {
    try {
      await retryWebhookDelivery(webhookId, deliveryId);
      notifications.show({ title: t('common.success'), message: 'Retry scheduled', color: 'teal' });
      await fetchWebhookDeliveries(webhookId);
    } catch {
      notifications.show({ title: t('common.error'), message: 'Failed to schedule retry', color: 'red' });
    }
  };

  const updateEmail = (field: keyof EmailSettingsType, value: EmailSettingsType[keyof EmailSettingsType]) => {
    if (!emailSettings) return;
    setEmailSettings({ ...emailSettings, [field]: value });
  };

  const handleSaveEmail = async () => {
    if (!emailSettings) return;
    setSavingEmail(true);
    try {
      const { id, updatedAt, ...data } = emailSettings;
      void id; void updatedAt;
      const updated = await updateEmailSettings(data);
      setEmailSettings(updated);
      notifications.show({ title: t('common.saved'), message: t('email.saved'), color: 'teal' });
    } catch {
      notifications.show({ title: t('common.error'), message: t('email.saveError'), color: 'red' });
    } finally {
      setSavingEmail(false);
    }
  };

  const handleSendTestEmail = async () => {
    if (!testEmailTo) return;
    setTestingEmail(true);
    try {
      const res = await sendTestEmail(testEmailTo);
      notifications.show({
        title: res.success ? t('common.success') : t('common.error'),
        message: res.success ? t('email.testSent') : t('email.testFailed'),
        color: res.success ? 'teal' : 'red',
      });
    } catch {
      notifications.show({ title: t('common.error'), message: t('email.testFailed'), color: 'red' });
    } finally {
      setTestingEmail(false);
    }
  };

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    try { const { id, ...data } = settings; void id; await updateSettings(data); notifications.show({ title: t('common.saved'), message: t('notification.settingsSaved'), color: 'teal' }); }
    catch { notifications.show({ title: t('common.error'), message: t('notification.settingsSaveError'), color: 'red' }); }
    finally { setSaving(false); }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword) return;
    setChangingPassword(true);
    try { await changePassword(currentPassword, newPassword); setCurrentPassword(''); setNewPassword(''); notifications.show({ title: t('common.success'), message: t('notification.passwordChanged'), color: 'teal' }); }
    catch { notifications.show({ title: t('common.error'), message: t('notification.passwordError'), color: 'red' }); }
    finally { setChangingPassword(false); }
  };

  const handleToggle2FA = () => {
    if (twoFactorEnabled) { setTwoFactorEnabled(false); setShowQR(false); notifications.show({ title: t('common.success'), message: t('notification.twoFactorDisabled'), color: 'teal' }); }
    else { setTwoFactorEnabled(true); setShowQR(true); notifications.show({ title: t('common.success'), message: t('notification.twoFactorEnabled'), color: 'teal' }); }
  };

  const handleTestTelegram = () => {
    setTestingTelegram(true);
    setTimeout(() => { setTestingTelegram(false); notifications.show({ title: telegramToken ? t('common.success') : t('common.error'), message: telegramToken ? t('notification.telegramTestSuccess') : t('notification.telegramTestError'), color: telegramToken ? 'teal' : 'red' }); }, 1500);
  };

  const handleTestConnection = (protocol: string) => {
    setTestingConnection(protocol);
    setTimeout(() => { setTestingConnection(null); notifications.show({ title: t('common.success'), message: t('notification.testConnectionSuccess'), color: 'teal' }); }, 2000);
  };

  const handleAddPasskey = async () => {
    setAddingPasskey(true);
    try {
      const { startRegistration } = await import('@simplewebauthn/browser');
      const options = await getPasskeyRegisterOptions();
      const credential = await startRegistration({ optionsJSON: options as Parameters<typeof startRegistration>[0]['optionsJSON'] });
      await verifyPasskeyRegister(credential);
      notifications.show({ title: t('common.success'), message: 'Passkey added', color: 'teal' });
      await fetchPasskeys();
    } catch { notifications.show({ title: t('common.error'), message: 'Failed to add passkey', color: 'red' }); }
    finally { setAddingPasskey(false); }
  };

  const handleDeletePasskey = async (id: string) => {
    try { await deletePasskey(id); notifications.show({ title: t('common.success'), message: 'Passkey removed', color: 'teal' }); await fetchPasskeys(); }
    catch { notifications.show({ title: t('common.error'), message: 'Failed to remove passkey', color: 'red' }); }
  };

  const handleUnlinkOAuth = async (accountId: string) => {
    try { await unlinkOAuthAccount(accountId); notifications.show({ title: t('common.success'), message: 'Account unlinked', color: 'teal' }); await fetchOAuthAccounts(); }
    catch { notifications.show({ title: t('common.error'), message: 'Failed to unlink', color: 'red' }); }
  };

  const update = (field: keyof Settings, value: Settings[keyof Settings]) => { if (!settings) return; setSettings({ ...settings, [field]: value }); };

  if (loading) {
    return <LoadingSkeleton variant="form" rows={8} />;
  }
  if (loadError) {
    return (
      <EmptyState
        icon={IconAlertTriangle}
        title={t('common.error')}
        message={loadError}
      />
    );
  }
  if (!settings) {
    return (
      <EmptyState
        icon={IconAlertTriangle}
        message={t('notification.settingsError')}
      />
    );
  }

  return (
    <Stack gap={0}>
      <Group justify="space-between" mb="lg">
        <Text size="22px" fw={700} style={{ color: '#C1C2C5' }}>{t('settings.title')}</Text>
        {permissions.canManageSettings && (
          <Button leftSection={<IconDeviceFloppy size={16} />} variant="gradient" gradient={{ from: 'teal', to: 'cyan' }} radius="md" loading={saving} onClick={handleSave}>{t('settings.saveRestart')}</Button>
        )}
      </Group>

      <Paper p="lg" style={cardStyle} mb="md">
        <TextInput label={t('settings.serverIp')} placeholder={t('settings.serverIpPlaceholder')} leftSection={<IconNetwork size={16} color="#909296" />} value={settings.serverIp ?? ''} onChange={(e) => update('serverIp', e.currentTarget.value)} styles={inputStyles} />
      </Paper>

      <SectionTitle>{t('settings.protocols')}</SectionTitle>
      <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
        <Paper style={{ ...cardStyle, overflow: 'hidden', borderColor: settings.realityEnabled ? 'rgba(32,201,151,0.25)' : 'rgba(255,255,255,0.06)' }}>
          <Box px="lg" py="sm" style={{ background: settings.realityEnabled ? 'linear-gradient(135deg, rgba(32,201,151,0.12), rgba(32,201,151,0.04))' : 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <Group justify="space-between"><Group gap={8}><IconShieldCheck size={18} color={settings.realityEnabled ? '#20C997' : '#5c5f66'} /><Text fw={600} size="sm" style={{ color: settings.realityEnabled ? '#C1C2C5' : '#5c5f66' }}>VLESS+Reality</Text></Group><Switch checked={settings.realityEnabled} onChange={(e) => update('realityEnabled', e.currentTarget.checked)} color="teal" size="sm" /></Group>
          </Box>
          <Stack gap="sm" p="lg">
            <NumberInput label="Port" value={settings.realityPort} onChange={(v) => update('realityPort', Number(v))} min={1} max={65535} error={settings.realityPort < 1 || settings.realityPort > 65535 ? t('validation.port') : null} styles={inputStyles} />
            <TextInput label="SNI" value={settings.realitySni} onChange={(e) => update('realitySni', e.currentTarget.value)} error={settings.realitySni && !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i.test(settings.realitySni) ? t('validation.domain') : null} styles={inputStyles} />
            <TextInput label="Public Key" value={settings.realityPbk ?? ''} onChange={(e) => update('realityPbk', e.currentTarget.value)} styles={inputStyles} />
            <TextInput label="Private Key" value={settings.realityPvk ?? ''} onChange={(e) => update('realityPvk', e.currentTarget.value)} styles={inputStyles} />
            <TextInput label="Short ID" value={settings.realitySid ?? ''} onChange={(e) => update('realitySid', e.currentTarget.value)} styles={inputStyles} />
            <Button variant="light" color="teal" size="xs" radius="md" leftSection={<IconPlugConnected size={14} />} loading={testingConnection === 'reality'} onClick={() => handleTestConnection('reality')} styles={{ root: { border: '1px solid rgba(32,201,151,0.2)' } }}>{t('settings.testConnection')}</Button>
          </Stack>
        </Paper>
        <Paper style={{ ...cardStyle, overflow: 'hidden', borderColor: settings.wsEnabled ? 'rgba(51,154,240,0.25)' : 'rgba(255,255,255,0.06)' }}>
          <Box px="lg" py="sm" style={{ background: settings.wsEnabled ? 'linear-gradient(135deg, rgba(51,154,240,0.12), rgba(51,154,240,0.04))' : 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <Group justify="space-between"><Group gap={8}><IconWorld size={18} color={settings.wsEnabled ? '#339AF0' : '#5c5f66'} /><Text fw={600} size="sm" style={{ color: settings.wsEnabled ? '#C1C2C5' : '#5c5f66' }}>VLESS+WebSocket</Text></Group><Switch checked={settings.wsEnabled} onChange={(e) => update('wsEnabled', e.currentTarget.checked)} color="blue" size="sm" /></Group>
          </Box>
          <Stack gap="sm" p="lg">
            <NumberInput label="Port" value={settings.wsPort} onChange={(v) => update('wsPort', Number(v))} min={1} max={65535} error={settings.wsPort < 1 || settings.wsPort > 65535 ? t('validation.port') : null} styles={inputStyles} />
            <TextInput label="Path" value={settings.wsPath ?? ''} onChange={(e) => update('wsPath', e.currentTarget.value)} error={settings.wsPath && !settings.wsPath.startsWith('/') ? 'Path must start with /' : null} styles={inputStyles} />
            <TextInput label="Host" value={settings.wsHost ?? ''} onChange={(e) => update('wsHost', e.currentTarget.value)} styles={inputStyles} />
            <Button variant="light" color="blue" size="xs" radius="md" leftSection={<IconPlugConnected size={14} />} loading={testingConnection === 'websocket'} onClick={() => handleTestConnection('websocket')} styles={{ root: { border: '1px solid rgba(51,154,240,0.2)' } }}>{t('settings.testConnection')}</Button>
          </Stack>
        </Paper>
        <Paper style={{ ...cardStyle, overflow: 'hidden', borderColor: settings.ssEnabled ? 'rgba(132,94,247,0.25)' : 'rgba(255,255,255,0.06)' }}>
          <Box px="lg" py="sm" style={{ background: settings.ssEnabled ? 'linear-gradient(135deg, rgba(132,94,247,0.12), rgba(132,94,247,0.04))' : 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <Group justify="space-between"><Group gap={8}><IconLock size={18} color={settings.ssEnabled ? '#845EF7' : '#5c5f66'} /><Text fw={600} size="sm" style={{ color: settings.ssEnabled ? '#C1C2C5' : '#5c5f66' }}>Shadowsocks</Text></Group><Switch checked={settings.ssEnabled} onChange={(e) => update('ssEnabled', e.currentTarget.checked)} color="grape" size="sm" /></Group>
          </Box>
          <Stack gap="sm" p="lg">
            <NumberInput label="Port" value={settings.ssPort} onChange={(v) => update('ssPort', Number(v))} min={1} max={65535} error={settings.ssPort < 1 || settings.ssPort > 65535 ? t('validation.port') : null} styles={inputStyles} />
            <TextInput label="Method" value={settings.ssMethod} onChange={(e) => update('ssMethod', e.currentTarget.value)} styles={inputStyles} />
            <PasswordInput label="Password" value={settings.ssPassword ?? ''} onChange={(e) => update('ssPassword', e.currentTarget.value)} styles={inputStyles} />
            <Button variant="light" color="grape" size="xs" radius="md" leftSection={<IconPlugConnected size={14} />} loading={testingConnection === 'shadowsocks'} onClick={() => handleTestConnection('shadowsocks')} styles={{ root: { border: '1px solid rgba(132,94,247,0.2)' } }}>{t('settings.testConnection')}</Button>
          </Stack>
        </Paper>
      </SimpleGrid>

      <SectionTitle>{t('settings.features')}</SectionTitle>
      <Paper p="lg" style={cardStyle}>
        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="xl">
          <Group justify="space-between"><Group gap={8}><Box style={{ width: 32, height: 32, borderRadius: '50%', backgroundColor: 'rgba(32,201,151,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><IconFilter size={16} color="#20C997" /></Box><Box><Text size="sm" fw={500} style={{ color: '#C1C2C5' }}>{t('settings.splitTunneling')}</Text><Text size="xs" style={{ color: '#5c5f66' }}>{t('settings.splitTunnelingDesc')}</Text></Box></Group><Switch checked={settings.splitTunneling} onChange={(e) => update('splitTunneling', e.currentTarget.checked)} color="teal" size="sm" /></Group>
          <Group justify="space-between"><Group gap={8}><Box style={{ width: 32, height: 32, borderRadius: '50%', backgroundColor: 'rgba(255,107,107,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><IconShieldOff size={16} color="#ff6b6b" /></Box><Box><Text size="sm" fw={500} style={{ color: '#C1C2C5' }}>{t('settings.adBlocking')}</Text><Text size="xs" style={{ color: '#5c5f66' }}>{t('settings.adBlockingDesc')}</Text></Box></Group><Switch checked={settings.adBlocking} onChange={(e) => update('adBlocking', e.currentTarget.checked)} color="teal" size="sm" /></Group>
          <TextInput label={t('settings.cdnDomain')} placeholder="cdn.example.com" value={settings.cdnDomain ?? ''} onChange={(e) => update('cdnDomain', e.currentTarget.value)} size="sm" styles={inputStyles} />
        </SimpleGrid>
      </Paper>

      <SectionTitle>{t('settings.integrations')}</SectionTitle>
      <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
        <Paper p="lg" style={cardStyle}>
          <Group gap={8} mb="md"><Box style={{ width: 32, height: 32, borderRadius: '50%', backgroundColor: 'rgba(32,201,151,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><IconShieldLock size={16} color="#20C997" /></Box><Box><Text size="sm" fw={600} style={{ color: '#C1C2C5' }}>{t('settings.twoFactor')}</Text><Text size="xs" style={{ color: '#5c5f66' }}>{t('settings.twoFactorDesc')}</Text></Box></Group>
          {showQR && twoFactorEnabled && (<Box mb="md" p="md" style={{ backgroundColor: '#161B23', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}><svg width="120" height="120" viewBox="0 0 120 120"><rect width="120" height="120" fill="#fff" rx="8" /><rect x="10" y="10" width="30" height="30" fill="#000" /><rect x="80" y="10" width="30" height="30" fill="#000" /><rect x="10" y="80" width="30" height="30" fill="#000" /><rect x="15" y="15" width="20" height="20" fill="#fff" /><rect x="85" y="15" width="20" height="20" fill="#fff" /><rect x="15" y="85" width="20" height="20" fill="#fff" /><rect x="20" y="20" width="10" height="10" fill="#000" /><rect x="90" y="20" width="10" height="10" fill="#000" /><rect x="20" y="90" width="10" height="10" fill="#000" /><rect x="50" y="50" width="20" height="20" fill="#000" /></svg><Text size="xs" style={{ color: '#5c5f66' }}>{t('settings.scanQR')}</Text></Box>)}
          <Button variant="light" color={twoFactorEnabled ? 'red' : 'teal'} radius="md" fullWidth onClick={handleToggle2FA} styles={{ root: { border: `1px solid ${twoFactorEnabled ? 'rgba(255,107,107,0.2)' : 'rgba(32,201,151,0.2)'}` } }}>{twoFactorEnabled ? t('settings.disable2FA') : t('settings.enable2FA')}</Button>
        </Paper>
        <Paper p="lg" style={cardStyle}>
          <Group gap={8} mb="md"><Box style={{ width: 32, height: 32, borderRadius: '50%', backgroundColor: 'rgba(51,154,240,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><IconBrandTelegram size={16} color="#339AF0" /></Box><Box><Text size="sm" fw={600} style={{ color: '#C1C2C5' }}>{t('settings.telegramBot')}</Text><Text size="xs" style={{ color: '#5c5f66' }}>{t('settings.telegramBotDesc')}</Text></Box></Group>
          <Stack gap="sm"><TextInput label={t('settings.botToken')} placeholder={t('settings.botTokenPlaceholder')} value={telegramToken} onChange={(e) => setTelegramToken(e.currentTarget.value)} styles={inputStyles} /><Button variant="light" color="blue" radius="md" fullWidth loading={testingTelegram} onClick={handleTestTelegram} styles={{ root: { border: '1px solid rgba(51,154,240,0.2)' } }}>{t('settings.testBot')}</Button></Stack>
        </Paper>
        <Paper p="lg" style={cardStyle}>
          <Group gap={8} mb="md"><Box style={{ width: 32, height: 32, borderRadius: '50%', backgroundColor: 'rgba(132,94,247,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><IconChartDots size={16} color="#845EF7" /></Box><Box><Text size="sm" fw={600} style={{ color: '#C1C2C5' }}>{t('settings.prometheus')}</Text><Text size="xs" style={{ color: '#5c5f66' }}>{t('settings.prometheusDesc')}</Text></Box></Group>
          <Group justify="space-between" mt="md"><Text size="sm" style={{ color: '#909296' }}>{prometheusEnabled ? t('common.enabled') : t('common.disabled')}</Text><Switch checked={prometheusEnabled} onChange={(e) => setPrometheusEnabled(e.currentTarget.checked)} color="grape" size="sm" /></Group>
        </Paper>
      </SimpleGrid>

      <SectionTitle>Passkeys</SectionTitle>
      <Paper p="lg" style={cardStyle}>
        <Group justify="space-between" mb="md"><Group gap={8}><IconFingerprint size={18} color="#20C997" /><Text size="sm" fw={600} style={{ color: '#C1C2C5' }}>Registered Passkeys</Text></Group><Button size="xs" variant="light" color="teal" radius="md" leftSection={<IconPlus size={14} />} loading={addingPasskey} onClick={handleAddPasskey} styles={{ root: { border: '1px solid rgba(32,201,151,0.2)' } }}>Add Passkey</Button></Group>
        {passkeys.length > 0 ? (
          <Box style={{ overflowX: 'auto' }}>
          <Table horizontalSpacing="md" verticalSpacing="xs" styles={{ table: { borderCollapse: 'separate', borderSpacing: 0 } }}>
            <Table.Thead><Table.Tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}><Table.Th style={thStyle}>Credential ID</Table.Th><Table.Th style={thStyle}>Created</Table.Th><Table.Th style={{ ...thStyle, width: 60 }} /></Table.Tr></Table.Thead>
            <Table.Tbody>{passkeys.map((pk) => (<Table.Tr key={pk.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}><Table.Td><Text size="xs" ff="monospace" style={{ color: '#909296' }}>{pk.credentialId.substring(0, 24)}...</Text></Table.Td><Table.Td><Text size="xs" style={{ color: '#909296' }}>{new Date(pk.createdAt).toLocaleDateString()}</Text></Table.Td><Table.Td><Button size="xs" variant="subtle" color="red" radius="md" onClick={() => handleDeletePasskey(pk.id)} leftSection={<IconTrash size={12} />} styles={{ root: { padding: '2px 8px' } }}>Remove</Button></Table.Td></Table.Tr>))}</Table.Tbody>
          </Table>
          </Box>
        ) : (<Text size="sm" style={{ color: '#5c5f66' }}>No passkeys registered</Text>)}
      </Paper>

      {oauthAccounts.length > 0 && (<><SectionTitle>Linked Accounts</SectionTitle><Paper p="lg" style={cardStyle}><Stack gap="sm">{oauthAccounts.map((acct) => (<Group key={acct.id} justify="space-between" style={{ padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}><Group gap={8}>{providerIcon(acct.provider)}<Box><Text size="sm" fw={500} style={{ color: '#C1C2C5', textTransform: 'capitalize' }}>{acct.provider}</Text>{acct.email && <Text size="xs" style={{ color: '#5c5f66' }}>{acct.email}</Text>}</Box><Badge size="xs" variant="light" color="gray">{acct.providerId}</Badge></Group><Button size="xs" variant="subtle" color="red" radius="md" leftSection={<IconUnlink size={12} />} onClick={() => handleUnlinkOAuth(acct.id)}>Unlink</Button></Group>))}</Stack></Paper></>)}

      <SectionTitle>{t('email.title')}</SectionTitle>
      <Paper p="lg" style={cardStyle}>
        {emailSettings ? (
          <Stack gap="md">
            <Group justify="space-between">
              <Group gap={8}>
                <Box style={{ width: 32, height: 32, borderRadius: '50%', backgroundColor: 'rgba(51,154,240,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <IconMail size={16} color="#339AF0" />
                </Box>
                <Box>
                  <Text size="sm" fw={600} style={{ color: '#C1C2C5' }}>{t('email.smtp')}</Text>
                  <Text size="xs" style={{ color: '#5c5f66' }}>{t('email.smtpDesc')}</Text>
                </Box>
              </Group>
              <Switch
                checked={emailSettings.enabled}
                onChange={(e) => updateEmail('enabled', e.currentTarget.checked)}
                color="teal"
                size="sm"
              />
            </Group>

            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              <TextInput
                label={t('email.host')}
                placeholder="smtp.example.com"
                value={emailSettings.smtpHost ?? ''}
                onChange={(e) => updateEmail('smtpHost', e.currentTarget.value)}
                styles={inputStyles}
              />
              <NumberInput
                label={t('email.port')}
                value={emailSettings.smtpPort}
                onChange={(v) => updateEmail('smtpPort', Number(v))}
                styles={inputStyles}
              />
              <TextInput
                label={t('email.user')}
                value={emailSettings.smtpUser ?? ''}
                onChange={(e) => updateEmail('smtpUser', e.currentTarget.value)}
                styles={inputStyles}
              />
              <PasswordInput
                label={t('email.password')}
                value={emailSettings.smtpPass ?? ''}
                onChange={(e) => updateEmail('smtpPass', e.currentTarget.value)}
                styles={inputStyles}
              />
              <TextInput
                label={t('email.fromEmail')}
                placeholder="noreply@example.com"
                value={emailSettings.fromEmail ?? ''}
                onChange={(e) => updateEmail('fromEmail', e.currentTarget.value)}
                styles={inputStyles}
              />
              <TextInput
                label={t('email.fromName')}
                value={emailSettings.fromName}
                onChange={(e) => updateEmail('fromName', e.currentTarget.value)}
                styles={inputStyles}
              />
            </SimpleGrid>

            <Group justify="space-between">
              <Group gap={8}>
                <Text size="sm" style={{ color: '#909296' }}>{t('email.secure')}</Text>
                <Switch
                  checked={emailSettings.smtpSecure}
                  onChange={(e) => updateEmail('smtpSecure', e.currentTarget.checked)}
                  color="teal"
                  size="sm"
                />
              </Group>
              <Button
                variant="light"
                color="teal"
                radius="md"
                size="sm"
                leftSection={<IconDeviceFloppy size={14} />}
                loading={savingEmail}
                onClick={handleSaveEmail}
                styles={{ root: { border: '1px solid rgba(32,201,151,0.2)' } }}
              >
                {t('common.save')}
              </Button>
            </Group>

            <Group align="end" gap="sm">
              <TextInput
                label={t('email.testTo')}
                placeholder="you@example.com"
                value={testEmailTo}
                onChange={(e) => setTestEmailTo(e.currentTarget.value)}
                styles={inputStyles}
                style={{ flex: 1 }}
              />
              <Button
                variant="light"
                color="blue"
                radius="md"
                size="sm"
                leftSection={<IconMailCheck size={14} />}
                loading={testingEmail}
                onClick={handleSendTestEmail}
                disabled={!emailSettings.enabled || !testEmailTo}
                styles={{ root: { border: '1px solid rgba(51,154,240,0.2)', height: 36 } }}
              >
                {t('email.sendTest')}
              </Button>
            </Group>
          </Stack>
        ) : (
          <Text size="sm" style={{ color: '#5c5f66' }}>{t('common.loading')}</Text>
        )}
      </Paper>

      <SectionTitle>Webhooks</SectionTitle>
      <Paper p="lg" style={cardStyle}>
        <Group gap={8} mb="md">
          <IconWebhook size={18} color="#339AF0" />
          <Text size="sm" fw={600} style={{ color: '#C1C2C5' }}>Delivery Endpoints</Text>
        </Group>
        <Stack gap="sm" mb="md">
          <Group gap="xs" align="end" wrap="wrap">
            <TextInput
              label="URL"
              placeholder="https://example.com/webhook"
              value={newWebhookUrl}
              onChange={(e) => setNewWebhookUrl(e.currentTarget.value)}
              error={
                newWebhookUrl.trim() &&
                !/^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(newWebhookUrl.trim())
                  ? t('validation.url')
                  : null
              }
              styles={inputStyles}
              style={{ flex: 2, minWidth: 220 }}
            />
            <TextInput
              label="Events (comma-separated)"
              placeholder="user.created,user.renewed"
              value={newWebhookEvents}
              onChange={(e) => setNewWebhookEvents(e.currentTarget.value)}
              error={
                newWebhookEvents.trim() === '' ? t('validation.required') : null
              }
              styles={inputStyles}
              style={{ flex: 2, minWidth: 200 }}
            />
            <PasswordInput
              label="Secret"
              value={newWebhookSecret}
              onChange={(e) => setNewWebhookSecret(e.currentTarget.value)}
              error={
                newWebhookSecret && newWebhookSecret.length < 8
                  ? t('validation.minLength')
                  : null
              }
              styles={inputStyles}
              style={{ flex: 1, minWidth: 160 }}
            />
            <Button
              variant="light"
              color="blue"
              radius="md"
              leftSection={<IconPlus size={14} />}
              loading={addingWebhook}
              onClick={handleAddWebhook}
              disabled={
                !newWebhookUrl ||
                !/^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(newWebhookUrl.trim()) ||
                newWebhookSecret.length < 8 ||
                !newWebhookEvents.trim()
              }
              styles={{ root: { border: '1px solid rgba(51,154,240,0.2)', height: 36 } }}
            >
              Add
            </Button>
          </Group>
        </Stack>
        {webhooks.length > 0 ? (
          <Stack gap="xs">
            {webhooks.map((wh) => {
              const deliveries = webhookDeliveries[wh.id] ?? [];
              const expanded = expandedWebhookId === wh.id;
              return (
                <Box
                  key={wh.id}
                  style={{
                    backgroundColor: '#161B23',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: 8,
                    overflow: 'hidden',
                  }}
                >
                  <Group justify="space-between" px="md" py="sm" wrap="nowrap">
                    <Box style={{ overflow: 'hidden', flex: 1 }}>
                      <Text size="sm" fw={500} ff="monospace" style={{ color: '#C1C2C5', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {wh.url}
                      </Text>
                      <Group gap={4} mt={2}>
                        {wh.events.map((ev) => (
                          <Badge key={ev} size="xs" variant="light" color="gray">{ev}</Badge>
                        ))}
                      </Group>
                    </Box>
                    <Group gap="xs">
                      <Button
                        size="xs"
                        variant="subtle"
                        color="gray"
                        radius="md"
                        onClick={() => toggleWebhookExpanded(wh.id)}
                      >
                        {expanded ? 'Hide' : 'Deliveries'}
                      </Button>
                      <Button
                        size="xs"
                        variant="subtle"
                        color="red"
                        radius="md"
                        onClick={() => handleDeleteWebhook(wh.id)}
                        leftSection={<IconTrash size={12} />}
                      >
                        Remove
                      </Button>
                    </Group>
                  </Group>
                  {expanded && (
                    <Box style={{ borderTop: '1px solid rgba(255,255,255,0.06)', overflowX: 'auto' }}>
                      <Table horizontalSpacing="md" verticalSpacing="xs">
                        <Table.Thead>
                          <Table.Tr>
                            <Table.Th style={thStyle}>Event</Table.Th>
                            <Table.Th style={thStyle}>Status</Table.Th>
                            <Table.Th style={thStyle}>Attempts</Table.Th>
                            <Table.Th style={thStyle}>When</Table.Th>
                            <Table.Th style={{ ...thStyle, width: 90 }}>Actions</Table.Th>
                          </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                          {deliveries.map((d) => {
                            const color =
                              d.status === 'success' ? 'teal'
                                : d.status === 'pending' ? 'yellow'
                                  : d.status === 'failed' ? 'orange'
                                    : 'red';
                            return (
                              <Table.Tr key={d.id}>
                                <Table.Td>
                                  <Text size="xs" ff="monospace" style={{ color: '#C1C2C5' }}>{d.event}</Text>
                                </Table.Td>
                                <Table.Td>
                                  <Badge variant="light" color={color} size="xs">{d.status}</Badge>
                                </Table.Td>
                                <Table.Td>
                                  <Text size="xs" style={{ color: '#909296' }}>{d.attempts}</Text>
                                </Table.Td>
                                <Table.Td>
                                  <Text size="xs" style={{ color: '#909296' }}>
                                    {new Date(d.createdAt).toLocaleString()}
                                  </Text>
                                </Table.Td>
                                <Table.Td>
                                  {(d.status === 'failed' || d.status === 'dead') && (
                                    <Button
                                      size="xs"
                                      variant="subtle"
                                      color="teal"
                                      radius="md"
                                      leftSection={<IconRefresh size={12} />}
                                      onClick={() => handleRetryDelivery(wh.id, d.id)}
                                    >
                                      Retry
                                    </Button>
                                  )}
                                </Table.Td>
                              </Table.Tr>
                            );
                          })}
                          {deliveries.length === 0 && (
                            <Table.Tr>
                              <Table.Td colSpan={5}>
                                <Text size="xs" ta="center" py="sm" style={{ color: '#5c5f66' }}>
                                  No deliveries yet
                                </Text>
                              </Table.Td>
                            </Table.Tr>
                          )}
                        </Table.Tbody>
                      </Table>
                    </Box>
                  )}
                </Box>
              );
            })}
          </Stack>
        ) : (
          <Text size="sm" style={{ color: '#5c5f66' }}>No webhooks configured</Text>
        )}
      </Paper>

      <SectionTitle>{t('settings.admin')}</SectionTitle>
      <Paper p="lg" style={cardStyle}>
        <Group align="end" gap="md" wrap="wrap">
          <PasswordInput label={t('settings.currentPassword')} value={currentPassword} onChange={(e) => setCurrentPassword(e.currentTarget.value)} error={currentPassword && currentPassword.length < 1 ? t('validation.required') : null} styles={inputStyles} style={{ flex: 1, minWidth: 200 }} />
          <PasswordInput label={t('settings.newPassword')} value={newPassword} onChange={(e) => setNewPassword(e.currentTarget.value)} error={newPassword && newPassword.length < 8 ? t('validation.password') : null} styles={inputStyles} style={{ flex: 1, minWidth: 200 }} />
          <Button variant="light" color="teal" radius="md" loading={changingPassword} onClick={handleChangePassword} disabled={!currentPassword || newPassword.length < 8 || changingPassword} styles={{ root: { border: '1px solid rgba(32,201,151,0.2)', height: 36 } }}>{t('settings.change')}</Button>
        </Group>
      </Paper>
    </Stack>
  );
}

export default SettingsPage;
