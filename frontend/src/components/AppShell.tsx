import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  AppShell as MantineAppShell,
  NavLink,
  Group,
  Text,
  UnstyledButton,
  Box,
  Divider,
} from '@mantine/core';
import {
  IconDashboard,
  IconUsers,
  IconSettings,
  IconRadar,
  IconLogout,
  IconDroplet,
  IconServer,
} from '@tabler/icons-react';
import { useAuth } from './AuthProvider';

const navItems = [
  { label: 'Dashboard', icon: IconDashboard, path: '/' },
  { label: 'Users', icon: IconUsers, path: '/users' },
  { label: 'Nodes', icon: IconServer, path: '/nodes' },
  { label: 'Intelligence', icon: IconRadar, path: '/intelligence' },
  { label: 'Settings', icon: IconSettings, path: '/settings' },
];

export function AppShellLayout() {
  const [opened] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <MantineAppShell
      navbar={{
        width: 260,
        breakpoint: 'sm',
        collapsed: { mobile: !opened },
      }}
      padding="md"
      styles={{
        main: {
          backgroundColor: '#060a12',
          minHeight: '100vh',
        },
        navbar: {
          backgroundColor: '#0b1121',
          borderRight: '1px solid #1a2940',
        },
      }}
    >
      <MantineAppShell.Navbar p="md">
        <MantineAppShell.Section>
          <Group gap="xs" mb="xl" mt="xs">
            <IconDroplet size={28} color="#00e8c6" stroke={2} />
            <Text
              size="xl"
              fw={700}
              style={{ color: '#00e8c6', letterSpacing: '-0.5px' }}
            >
              HydraFlow
            </Text>
          </Group>
        </MantineAppShell.Section>

        <MantineAppShell.Section grow>
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              label={item.label}
              leftSection={<item.icon size={20} stroke={1.5} />}
              active={location.pathname === item.path}
              onClick={() => navigate(item.path)}
              variant="filled"
              styles={{
                root: {
                  borderRadius: 8,
                  marginBottom: 4,
                  color: location.pathname === item.path ? '#00e8c6' : '#97a8c2',
                  backgroundColor:
                    location.pathname === item.path
                      ? 'rgba(0, 232, 198, 0.1)'
                      : 'transparent',
                  '&:hover': {
                    backgroundColor: 'rgba(0, 232, 198, 0.05)',
                  },
                },
                label: {
                  fontWeight: location.pathname === item.path ? 600 : 400,
                },
              }}
            />
          ))}
        </MantineAppShell.Section>

        <MantineAppShell.Section>
          <Divider color="#1a2940" mb="sm" />
          <UnstyledButton
            onClick={handleLogout}
            style={{ width: '100%' }}
          >
            <Box
              p="xs"
              style={{
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                color: '#97a8c2',
              }}
            >
              <IconLogout size={20} stroke={1.5} />
              <Text size="sm">Logout</Text>
            </Box>
          </UnstyledButton>
        </MantineAppShell.Section>
      </MantineAppShell.Navbar>

      <MantineAppShell.Main>
        <Outlet />
      </MantineAppShell.Main>
    </MantineAppShell>
  );
}
