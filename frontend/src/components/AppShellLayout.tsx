import { AppShell, NavLink, Group, Text, ActionIcon, Box } from '@mantine/core';
import { IconDashboard, IconUsers, IconSettings, IconLogout, IconDroplet } from '@tabler/icons-react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthProvider';

const navItems = [
  { label: 'Dashboard', icon: IconDashboard, path: '/dashboard' },
  { label: 'Users', icon: IconUsers, path: '/users' },
  { label: 'Settings', icon: IconSettings, path: '/settings' },
];

export function AppShellLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, admin } = useAuth();

  return (
    <AppShell
      navbar={{ width: 260, breakpoint: 'sm' }}
      padding="lg"
      styles={{
        main: { backgroundColor: 'var(--mantine-color-dark-8)', minHeight: '100vh' },
        navbar: { backgroundColor: 'var(--mantine-color-dark-7)', borderRight: '1px solid var(--mantine-color-dark-4)' },
      }}
    >
      <AppShell.Navbar p="md">
        <AppShell.Section>
          <Group gap="sm" mb="xl" mt="xs">
            <IconDroplet size={32} stroke={1.5} color="var(--mantine-color-teal-5)" />
            <Box>
              <Text size="lg" fw={700} c="white" lh={1.2}>HydraFlow</Text>
              <Text size="xs" c="dimmed">Panel</Text>
            </Box>
          </Group>
        </AppShell.Section>
        <AppShell.Section grow>
          {navItems.map((item) => (
            <NavLink key={item.path} label={item.label} leftSection={<item.icon size={20} stroke={1.5} />}
              active={location.pathname === item.path} onClick={() => navigate(item.path)} variant="filled"
              styles={{ root: { borderRadius: 'var(--mantine-radius-md)', marginBottom: 4 } }} />
          ))}
        </AppShell.Section>
        <AppShell.Section>
          <Group justify="space-between" p="sm">
            <Text size="sm" c="dimmed" truncate>{admin?.email}</Text>
            <ActionIcon variant="subtle" color="gray" onClick={() => { logout(); navigate('/login'); }}>
              <IconLogout size={18} stroke={1.5} />
            </ActionIcon>
          </Group>
        </AppShell.Section>
      </AppShell.Navbar>
      <AppShell.Main><Outlet /></AppShell.Main>
    </AppShell>
  );
}
