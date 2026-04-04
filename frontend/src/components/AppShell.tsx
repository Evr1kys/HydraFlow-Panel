import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  AppShell as MantineAppShell,
  Group,
  Text,
  UnstyledButton,
  Box,
  Tooltip,
  Badge,
} from '@mantine/core';
import {
  IconLayoutDashboard,
  IconUsers,
  IconServer,
  IconRadar,
  IconActivity,
  IconSettings,
  IconLogout,
  IconBrandGithub,
  IconBrandTelegram,
} from '@tabler/icons-react';
import { useAuth } from './AuthProvider';

interface NavSection {
  label: string;
  color: string;
  items: {
    label: string;
    icon: typeof IconLayoutDashboard;
    path: string;
  }[];
}

const navSections: NavSection[] = [
  {
    label: 'OVERVIEW',
    color: '#20C997',
    items: [
      { label: 'Dashboard', icon: IconLayoutDashboard, path: '/' },
    ],
  },
  {
    label: 'MANAGEMENT',
    color: '#339AF0',
    items: [
      { label: 'Users', icon: IconUsers, path: '/users' },
      { label: 'Nodes', icon: IconServer, path: '/nodes' },
    ],
  },
  {
    label: 'INTELLIGENCE',
    color: '#845EF7',
    items: [
      { label: 'ISP Map', icon: IconRadar, path: '/intelligence' },
      { label: 'Protocol Health', icon: IconActivity, path: '/?section=health' },
    ],
  },
  {
    label: 'SETTINGS',
    color: '#FCC419',
    items: [
      { label: 'Configuration', icon: IconSettings, path: '/settings' },
    ],
  },
];

export function AppShellLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path: string) => {
    if (path.includes('?')) return false;
    return location.pathname === path;
  };

  return (
    <MantineAppShell
      navbar={{
        width: 260,
        breakpoint: 'sm',
      }}
      padding="xl"
      styles={{
        main: {
          backgroundColor: '#161B23',
          minHeight: '100vh',
        },
        navbar: {
          backgroundColor: '#1E2128',
          borderRight: '1px solid rgba(255,255,255,0.06)',
        },
      }}
    >
      <MantineAppShell.Navbar p="md">
        {/* Logo */}
        <MantineAppShell.Section>
          <Group gap={10} mb={28} mt={4} px={4}>
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <defs>
                <linearGradient id="hfGrad" x1="0" y1="0" x2="32" y2="32">
                  <stop offset="0%" stopColor="#20C997" />
                  <stop offset="100%" stopColor="#339AF0" />
                </linearGradient>
              </defs>
              <circle cx="16" cy="16" r="14" stroke="url(#hfGrad)" strokeWidth="2.5" fill="none" />
              <path d="M10 12 L16 8 L22 12 L22 20 L16 24 L10 20Z" stroke="url(#hfGrad)" strokeWidth="1.5" fill="rgba(32,201,151,0.15)" />
              <circle cx="16" cy="16" r="3" fill="url(#hfGrad)" />
            </svg>
            <Text
              size="lg"
              fw={700}
              style={{
                background: 'linear-gradient(135deg, #20C997, #339AF0)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                letterSpacing: '-0.3px',
              }}
            >
              HydraFlow
            </Text>
          </Group>
        </MantineAppShell.Section>

        {/* Navigation sections */}
        <MantineAppShell.Section grow style={{ overflowY: 'auto' }}>
          {navSections.map((section) => (
            <Box key={section.label} mb={16}>
              <Box
                px={12}
                py={4}
                mb={4}
                style={{
                  borderLeft: `3px solid ${section.color}`,
                }}
              >
                <Text
                  size="10px"
                  fw={700}
                  style={{
                    color: '#5c5f66',
                    letterSpacing: '1.2px',
                    textTransform: 'uppercase',
                  }}
                >
                  {section.label}
                </Text>
              </Box>

              {section.items.map((item) => {
                const active = isActive(item.path);
                return (
                  <UnstyledButton
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 8,
                      marginBottom: 2,
                      backgroundColor: active ? 'rgba(32, 201, 151, 0.15)' : 'transparent',
                      color: active ? '#20C997' : '#909296',
                      fontWeight: active ? 600 : 400,
                      fontSize: '13.5px',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (!active) {
                        (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255,255,255,0.04)';
                        (e.currentTarget as HTMLElement).style.color = '#C1C2C5';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!active) {
                        (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                        (e.currentTarget as HTMLElement).style.color = '#909296';
                      }
                    }}
                  >
                    <item.icon size={18} stroke={1.5} />
                    <Text size="sm" fw={active ? 600 : 400}>
                      {item.label}
                    </Text>
                  </UnstyledButton>
                );
              })}
            </Box>
          ))}
        </MantineAppShell.Section>

        {/* Bottom section */}
        <MantineAppShell.Section>
          <Box
            style={{
              borderTop: '1px solid rgba(255,255,255,0.06)',
              paddingTop: 12,
            }}
          >
            <UnstyledButton
              onClick={handleLogout}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                width: '100%',
                padding: '8px 12px',
                borderRadius: 8,
                color: '#909296',
                fontSize: '13.5px',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255, 107, 107, 0.1)';
                (e.currentTarget as HTMLElement).style.color = '#ff6b6b';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                (e.currentTarget as HTMLElement).style.color = '#909296';
              }}
            >
              <IconLogout size={18} stroke={1.5} />
              <Text size="sm">Logout</Text>
            </UnstyledButton>
          </Box>
        </MantineAppShell.Section>
      </MantineAppShell.Navbar>

      <MantineAppShell.Main>
        {/* Header bar */}
        <Box
          mb="xl"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 10,
          }}
        >
          <Badge
            variant="light"
            color="teal"
            size="md"
            style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 500 }}
          >
            v2.0.0
          </Badge>
          <Tooltip label="Telegram Channel" withArrow>
            <UnstyledButton
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 34,
                height: 34,
                borderRadius: 8,
                backgroundColor: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.06)',
                color: '#909296',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.color = '#339AF0';
                (e.currentTarget as HTMLElement).style.borderColor = 'rgba(51,154,240,0.3)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.color = '#909296';
                (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.06)';
              }}
            >
              <IconBrandTelegram size={18} stroke={1.5} />
            </UnstyledButton>
          </Tooltip>
          <Tooltip label="GitHub Repository" withArrow>
            <UnstyledButton
              component="a"
              href="https://github.com/Evr1kys/HydraFlow"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                height: 34,
                padding: '0 12px',
                borderRadius: 8,
                backgroundColor: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.06)',
                color: '#909296',
                fontSize: '13px',
                textDecoration: 'none',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.color = '#C1C2C5';
                (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.12)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.color = '#909296';
                (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.06)';
              }}
            >
              <IconBrandGithub size={16} stroke={1.5} />
              <Text size="xs" fw={500}>Star</Text>
            </UnstyledButton>
          </Tooltip>
        </Box>
        <Outlet />
      </MantineAppShell.Main>
    </MantineAppShell>
  );
}
