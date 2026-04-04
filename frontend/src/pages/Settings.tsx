import { useEffect, useState } from 'react';
import { Button, Card, Divider, Grid, Group, Loader, NumberInput, PasswordInput, Stack, Switch, Text, TextInput, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconDeviceFloppy, IconLock, IconNetwork, IconServer, IconShield } from '@tabler/icons-react';
import { getSettings, updateSettings, PanelSettings } from '../api/settings';
import { changePassword } from '../api/auth';

const glass = { backgroundColor: 'rgba(11, 17, 33, 0.6)', backdropFilter: 'blur(12px)', border: '1px solid rgba(85, 104, 128, 0.2)' };
const iStyle = { input: { backgroundColor: 'rgba(26, 41, 64, 0.5)', borderColor: 'rgba(85, 104, 128, 0.3)' } };

export function Settings() {
  const [settings, setSettings] = useState<PanelSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [curPwd, setCurPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [changingPwd, setChangingPwd] = useState(false);
  const [realityOn, setRealityOn] = useState(false);
  const [wsOn, setWsOn] = useState(false);
  const [ssOn, setSsOn] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const d = await getSettings(); setSettings(d);
        setRealityOn(!!d.realityPrivateKey); setWsOn(!!d.wsPath); setSsOn(!!d.ssPassword);
      } catch { notifications.show({ title: 'Error', message: 'Failed to load settings', color: 'red' }); }
      finally { setLoading(false); }
    })();
  }, []);

  const handleSave = async () => {
    if (!settings) return; setSaving(true);
    try {
      const u = await updateSettings({
        serverIp: settings.serverIp, realityPort: settings.realityPort, realitySni: settings.realitySni,
        realityPublicKey: realityOn ? settings.realityPublicKey : null, realityPrivateKey: realityOn ? settings.realityPrivateKey : null,
        realityShortId: realityOn ? settings.realityShortId : null, wsPort: settings.wsPort, wsPath: wsOn ? settings.wsPath : null,
        ssPort: settings.ssPort, ssPassword: ssOn ? settings.ssPassword : null,
      });
      setSettings(u); notifications.show({ title: 'Saved', message: 'Settings updated', color: 'teal' });
    } catch { notifications.show({ title: 'Error', message: 'Failed to save', color: 'red' }); }
    finally { setSaving(false); }
  };

  const handleChangePwd = async () => {
    if (!curPwd || !newPwd) return; setChangingPwd(true);
    try { await changePassword(curPwd, newPwd); notifications.show({ title: 'Success', message: 'Password changed', color: 'teal' }); setCurPwd(''); setNewPwd(''); }
    catch { notifications.show({ title: 'Error', message: 'Check current password', color: 'red' }); }
    finally { setChangingPwd(false); }
  };

  const set = (f: keyof PanelSettings, v: string | number | null) => { if (settings) setSettings({ ...settings, [f]: v }); };

  if (loading) return <Stack align="center" justify="center" h="60vh"><Loader color="teal" size="lg" /></Stack>;

  return (
    <Stack gap="lg">
      <Title order={2} c="white">Settings</Title>

      <Card radius="md" p="lg" style={glass}>
        <Group gap="sm" mb="md"><IconServer size={20} stroke={1.5} color="var(--mantine-color-teal-5)" /><Text size="sm" c="dimmed" tt="uppercase" fw={600}>Server</Text></Group>
        <Grid><Grid.Col span={{ base: 12, sm: 6 }}><TextInput label="Server IP" placeholder="0.0.0.0" value={settings?.serverIp || ''} onChange={(e) => set('serverIp', e.currentTarget.value)} styles={iStyle} /></Grid.Col></Grid>
      </Card>

      <Card radius="md" p="lg" style={glass}>
        <Group justify="space-between" mb="md"><Group gap="sm"><IconShield size={20} stroke={1.5} color="var(--mantine-color-violet-5)" /><Text size="sm" c="dimmed" tt="uppercase" fw={600}>VLESS + Reality</Text></Group><Switch checked={realityOn} onChange={(e) => setRealityOn(e.currentTarget.checked)} color="teal" /></Group>
        {realityOn && <Grid>
          <Grid.Col span={{ base: 12, sm: 4 }}><NumberInput label="Port" value={settings?.realityPort || 443} onChange={(v) => set('realityPort', Number(v))} styles={iStyle} /></Grid.Col>
          <Grid.Col span={{ base: 12, sm: 8 }}><TextInput label="SNI" value={settings?.realitySni || ''} onChange={(e) => set('realitySni', e.currentTarget.value)} styles={iStyle} /></Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6 }}><TextInput label="Public Key" value={settings?.realityPublicKey || ''} onChange={(e) => set('realityPublicKey', e.currentTarget.value)} styles={iStyle} /></Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6 }}><TextInput label="Private Key" value={settings?.realityPrivateKey || ''} onChange={(e) => set('realityPrivateKey', e.currentTarget.value)} styles={iStyle} /></Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6 }}><TextInput label="Short ID" value={settings?.realityShortId || ''} onChange={(e) => set('realityShortId', e.currentTarget.value)} styles={iStyle} /></Grid.Col>
        </Grid>}
      </Card>

      <Card radius="md" p="lg" style={glass}>
        <Group justify="space-between" mb="md"><Group gap="sm"><IconNetwork size={20} stroke={1.5} color="var(--mantine-color-cyan-5)" /><Text size="sm" c="dimmed" tt="uppercase" fw={600}>VLESS + WebSocket</Text></Group><Switch checked={wsOn} onChange={(e) => setWsOn(e.currentTarget.checked)} color="teal" /></Group>
        {wsOn && <Grid>
          <Grid.Col span={{ base: 12, sm: 4 }}><NumberInput label="Port" value={settings?.wsPort || 2053} onChange={(v) => set('wsPort', Number(v))} styles={iStyle} /></Grid.Col>
          <Grid.Col span={{ base: 12, sm: 8 }}><TextInput label="Path" placeholder="/ws" value={settings?.wsPath || ''} onChange={(e) => set('wsPath', e.currentTarget.value)} styles={iStyle} /></Grid.Col>
        </Grid>}
      </Card>

      <Card radius="md" p="lg" style={glass}>
        <Group justify="space-between" mb="md"><Group gap="sm"><IconLock size={20} stroke={1.5} color="var(--mantine-color-orange-5)" /><Text size="sm" c="dimmed" tt="uppercase" fw={600}>Shadowsocks</Text></Group><Switch checked={ssOn} onChange={(e) => setSsOn(e.currentTarget.checked)} color="teal" /></Group>
        {ssOn && <Grid>
          <Grid.Col span={{ base: 12, sm: 4 }}><NumberInput label="Port" value={settings?.ssPort || 8388} onChange={(v) => set('ssPort', Number(v))} styles={iStyle} /></Grid.Col>
          <Grid.Col span={{ base: 12, sm: 8 }}><TextInput label="Password" value={settings?.ssPassword || ''} onChange={(e) => set('ssPassword', e.currentTarget.value)} styles={iStyle} /></Grid.Col>
        </Grid>}
      </Card>

      <Button size="md" leftSection={<IconDeviceFloppy size={18} stroke={1.5} />} variant="gradient" gradient={{ from: 'teal', to: 'cyan', deg: 135 }} loading={saving} onClick={handleSave}>Save Settings</Button>

      <Divider my="sm" />

      <Card radius="md" p="lg" style={glass}>
        <Group gap="sm" mb="md"><IconLock size={20} stroke={1.5} color="var(--mantine-color-red-5)" /><Text size="sm" c="dimmed" tt="uppercase" fw={600}>Change Admin Password</Text></Group>
        <Grid>
          <Grid.Col span={{ base: 12, sm: 6 }}><PasswordInput label="Current Password" value={curPwd} onChange={(e) => setCurPwd(e.currentTarget.value)} styles={iStyle} /></Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6 }}><PasswordInput label="New Password" value={newPwd} onChange={(e) => setNewPwd(e.currentTarget.value)} styles={iStyle} /></Grid.Col>
        </Grid>
        <Button mt="md" variant="light" color="red" loading={changingPwd} onClick={handleChangePwd}>Change Password</Button>
      </Card>
    </Stack>
  );
}
