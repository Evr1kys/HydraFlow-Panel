import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  TextInput,
  PasswordInput,
  Button,
  Text,
  Stack,
  Center,
  Box,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconMail, IconLock } from '@tabler/icons-react';
import { login } from '../api/auth';
import { useAuth } from '../components/AuthProvider';

// CSS-only constellation particles
function ConstellationBackground() {
  // Static positioned dots with CSS animation
  const particles = [
    { top: '10%', left: '15%', size: 2, delay: 0 },
    { top: '20%', left: '80%', size: 3, delay: 0.5 },
    { top: '35%', left: '25%', size: 2, delay: 1.2 },
    { top: '45%', left: '70%', size: 1.5, delay: 0.8 },
    { top: '60%', left: '10%', size: 2, delay: 1.5 },
    { top: '70%', left: '85%', size: 2.5, delay: 0.3 },
    { top: '80%', left: '40%', size: 2, delay: 2.0 },
    { top: '15%', left: '55%', size: 1.5, delay: 1.8 },
    { top: '50%', left: '90%', size: 2, delay: 0.7 },
    { top: '85%', left: '20%', size: 3, delay: 1.0 },
    { top: '25%', left: '45%', size: 1.5, delay: 2.2 },
    { top: '55%', left: '35%', size: 2, delay: 0.4 },
    { top: '40%', left: '5%', size: 2.5, delay: 1.6 },
    { top: '75%', left: '60%', size: 2, delay: 0.9 },
    { top: '90%', left: '75%', size: 1.5, delay: 2.5 },
    { top: '5%', left: '35%', size: 2, delay: 1.3 },
    { top: '65%', left: '50%', size: 3, delay: 0.6 },
    { top: '30%', left: '92%', size: 2, delay: 1.9 },
  ];

  return (
    <Box
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      {particles.map((p, i) => (
        <Box
          key={i}
          style={{
            position: 'absolute',
            top: p.top,
            left: p.left,
            width: p.size,
            height: p.size,
            borderRadius: '50%',
            backgroundColor: 'rgba(32, 201, 151, 0.4)',
            animation: `float-particle ${3 + p.delay}s ease-in-out ${p.delay}s infinite`,
          }}
        />
      ))}
    </Box>
  );
}

const inputFocusStyles = {
  input: {
    backgroundColor: '#161B23',
    border: '1px solid rgba(255,255,255,0.06)',
    color: '#C1C2C5',
    height: 42,
    transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
    '&:focus': {
      borderColor: '#20C997',
      boxShadow: '0 0 0 3px rgba(32, 201, 151, 0.15)',
    },
  },
  label: { color: '#909296', fontSize: '12px', fontWeight: 600, marginBottom: 4 },
};

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { setToken } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      notifications.show({
        title: 'Validation',
        message: 'Please fill in all fields',
        color: 'red',
      });
      return;
    }

    setLoading(true);
    try {
      const token = await login(email, password);
      setToken(token);
      navigate('/');
    } catch {
      notifications.show({
        title: 'Login failed',
        message: 'Invalid email or password',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      style={{
        minHeight: '100vh',
        background: 'radial-gradient(ellipse at 50% 0%, rgba(32,201,151,0.06) 0%, transparent 60%), linear-gradient(180deg, #0F1318 0%, #161B23 50%, #0F1318 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
      }}
    >
      <ConstellationBackground />
      <Box style={{ position: 'relative' }}>
        <Box
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 500,
            height: 400,
            background: 'radial-gradient(ellipse, rgba(32,201,151,0.08) 0%, transparent 70%)',
            filter: 'blur(60px)',
            pointerEvents: 'none',
          }}
        />
        <Card
          padding={40}
          radius={16}
          w={420}
          style={{
            backgroundColor: '#1E2128',
            border: '1px solid rgba(255,255,255,0.06)',
            boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
            position: 'relative',
            zIndex: 1,
          }}
        >
          <form onSubmit={handleSubmit}>
            <Stack gap="lg">
              <Center>
                {/* Hydra SVG icon logo */}
                <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
                  <defs>
                    <linearGradient id="loginGrad" x1="0" y1="0" x2="56" y2="56">
                      <stop offset="0%" stopColor="#20C997" />
                      <stop offset="100%" stopColor="#339AF0" />
                    </linearGradient>
                    <filter id="logoGlow">
                      <feGaussianBlur stdDeviation="2" result="blur" />
                      <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>
                  <circle cx="28" cy="28" r="25" stroke="url(#loginGrad)" strokeWidth="2" fill="none" opacity="0.4" />
                  <circle cx="28" cy="28" r="21" stroke="url(#loginGrad)" strokeWidth="2.5" fill="none" />
                  {/* Hydra hexagonal shape */}
                  <path d="M17 20 L28 13 L39 20 L39 36 L28 43 L17 36Z" stroke="url(#loginGrad)" strokeWidth="1.5" fill="rgba(32,201,151,0.12)" />
                  {/* Inner connections */}
                  <line x1="28" y1="13" x2="28" y2="43" stroke="url(#loginGrad)" strokeWidth="0.5" opacity="0.3" />
                  <line x1="17" y1="20" x2="39" y2="36" stroke="url(#loginGrad)" strokeWidth="0.5" opacity="0.3" />
                  <line x1="39" y1="20" x2="17" y2="36" stroke="url(#loginGrad)" strokeWidth="0.5" opacity="0.3" />
                  {/* Core */}
                  <circle cx="28" cy="28" r="5" fill="url(#loginGrad)" filter="url(#logoGlow)" />
                  <circle cx="28" cy="28" r="2" fill="#0F1318" />
                </svg>
              </Center>

              <Box>
                <Text ta="center" size="20px" fw={700} style={{ color: '#C1C2C5' }}>
                  Sign in to HydraFlow
                </Text>
                <Text ta="center" size="sm" mt={4} style={{ color: '#5c5f66' }}>
                  Enter your credentials to access the panel
                </Text>
              </Box>

              <TextInput
                label="Email"
                placeholder="admin@hydraflow.dev"
                leftSection={<IconMail size={16} color="#5c5f66" />}
                value={email}
                onChange={(e) => setEmail(e.currentTarget.value)}
                radius="md"
                styles={inputFocusStyles}
              />

              <PasswordInput
                label="Password"
                placeholder="Enter your password"
                leftSection={<IconLock size={16} color="#5c5f66" />}
                value={password}
                onChange={(e) => setPassword(e.currentTarget.value)}
                radius="md"
                styles={{
                  ...inputFocusStyles,
                  innerInput: { color: '#C1C2C5' },
                }}
              />

              <Button
                type="submit"
                fullWidth
                loading={loading}
                variant="gradient"
                gradient={{ from: '#20C997', to: '#339AF0' }}
                size="md"
                radius="md"
                mt="xs"
                styles={{
                  root: {
                    height: 44,
                    fontWeight: 600,
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      transform: 'translateY(-1px)',
                      boxShadow: '0 4px 12px rgba(32, 201, 151, 0.3)',
                    },
                  },
                }}
              >
                Sign in
              </Button>

              <Text ta="center" size="xs" style={{ color: '#373A40' }}>
                HydraFlow Panel v2.0.0
              </Text>
            </Stack>
          </form>
        </Card>
      </Box>
    </Box>
  );
}
