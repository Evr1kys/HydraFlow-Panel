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
      }}
    >
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
            position: 'relative',
            zIndex: 1,
          }}
        >
          <form onSubmit={handleSubmit}>
            <Stack gap="lg">
              <Center>
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                  <defs>
                    <linearGradient id="loginGrad" x1="0" y1="0" x2="48" y2="48">
                      <stop offset="0%" stopColor="#20C997" />
                      <stop offset="100%" stopColor="#339AF0" />
                    </linearGradient>
                  </defs>
                  <circle cx="24" cy="24" r="21" stroke="url(#loginGrad)" strokeWidth="2.5" fill="none" />
                  <path d="M15 18 L24 12 L33 18 L33 30 L24 36 L15 30Z" stroke="url(#loginGrad)" strokeWidth="1.5" fill="rgba(32,201,151,0.15)" />
                  <circle cx="24" cy="24" r="4.5" fill="url(#loginGrad)" />
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
                styles={{
                  input: {
                    backgroundColor: '#161B23',
                    border: '1px solid rgba(255,255,255,0.06)',
                    color: '#C1C2C5',
                    height: 42,
                  },
                  label: { color: '#909296', fontSize: '12px', fontWeight: 600, marginBottom: 4 },
                }}
              />

              <PasswordInput
                label="Password"
                placeholder="Enter your password"
                leftSection={<IconLock size={16} color="#5c5f66" />}
                value={password}
                onChange={(e) => setPassword(e.currentTarget.value)}
                radius="md"
                styles={{
                  input: {
                    backgroundColor: '#161B23',
                    border: '1px solid rgba(255,255,255,0.06)',
                    color: '#C1C2C5',
                    height: 42,
                  },
                  label: { color: '#909296', fontSize: '12px', fontWeight: 600, marginBottom: 4 },
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
                styles={{ root: { height: 44, fontWeight: 600 } }}
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
