import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Card,
  TextInput,
  PasswordInput,
  Button,
  Text,
  Stack,
  Center,
  Box,
  Checkbox,
  PinInput,
  Transition,
  Divider,
  Group,
  Tooltip,
  ActionIcon,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconMail,
  IconLock,
  IconShieldLock,
  IconArrowLeft,
  IconBrandTelegram,
  IconBrandGithub,
  IconFingerprint,
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import {
  login,
  getOAuthProviders,
  getPasskeyLoginOptions,
  verifyPasskeyLogin,
} from '../api/auth';
import type { OAuthProvider } from '../api/auth';
import { useAuth } from '../components/AuthProvider';
import { useFormValidation, validators } from '../hooks/useFormValidation';

// Yandex icon (not in @tabler/icons)
function YandexIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M13.32 21.634h2.504V2.366h-3.39c-4.108 0-6.26 2.121-6.26 5.207 0 2.583 1.31 4.052 3.576 5.575l-3.997 8.486h2.715l4.329-9.186-1.26-.848c-1.848-1.26-2.818-2.387-2.818-4.349 0-1.92 1.31-3.243 3.63-3.243h.97v17.626z" />
    </svg>
  );
}

function ConstellationBackground() {
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

type LoginStep = 'credentials' | '2fa';

export function LoginPage() {
  const { t } = useTranslation();
  const loginForm = useFormValidation(
    { email: '', password: '' },
    {
      email: validators.combine(
        validators.isNotEmpty(t('validation.required')),
        validators.isEmail(t('validation.email')),
      ),
      password: validators.combine(
        validators.isNotEmpty(t('validation.required')),
        validators.hasLength({ min: 8 }, t('validation.password')),
      ),
    },
  );
  const { email, password } = loginForm.values;
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [step, setStep] = useState<LoginStep>('credentials');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [providers, setProviders] = useState<OAuthProvider[]>([]);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setToken } = useAuth();

  // Handle OAuth callback token from URL
  useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      setToken(token);
      navigate('/', { replace: true });
    }
    const error = searchParams.get('error');
    if (error) {
      notifications.show({
        title: 'OAuth failed',
        message: 'Authentication with external provider failed',
        color: 'red',
      });
    }
  }, [searchParams, setToken, navigate]);

  // Load enabled OAuth providers
  useEffect(() => {
    getOAuthProviders()
      .then(setProviders)
      .catch(() => {
        // OAuth providers endpoint not available, ignore
      });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!loginForm.validate()) {
      notifications.show({
        title: t('common.error'),
        message: t('notification.loginValidation'),
        color: 'red',
      });
      return;
    }

    setLoading(true);
    try {
      const token = await login(email, password);

      if (token === '2fa_required') {
        setStep('2fa');
        setLoading(false);
        return;
      }

      if (rememberMe) {
        localStorage.setItem('hydraflow_remember', 'true');
      }
      setToken(token);
      navigate('/');
    } catch {
      notifications.show({
        title: t('common.error'),
        message: t('notification.loginFailed'),
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerify2FA = async () => {
    if (twoFactorCode.length !== 6) return;
    setVerifying(true);
    try {
      const token = await login(email, password);
      setToken(token);
      navigate('/');
    } catch {
      notifications.show({
        title: t('common.error'),
        message: t('notification.twoFactorInvalid'),
        color: 'red',
      });
    } finally {
      setVerifying(false);
    }
  };

  const handleBackToLogin = () => {
    setStep('credentials');
    setTwoFactorCode('');
  };

  const handleGitHubLogin = () => {
    window.location.href = '/api/auth/oauth/github';
  };

  const handleYandexLogin = () => {
    window.location.href = '/api/auth/oauth/yandex';
  };

  const handlePasskeyLogin = async () => {
    setPasskeyLoading(true);
    try {
      const { startAuthentication } = await import('@simplewebauthn/browser');
      const options = await getPasskeyLoginOptions();
      const credential = await startAuthentication({ optionsJSON: options as Parameters<typeof startAuthentication>[0]['optionsJSON'] });
      const token = await verifyPasskeyLogin(credential);
      setToken(token);
      navigate('/');
    } catch {
      notifications.show({
        title: 'Passkey login failed',
        message: 'Could not authenticate with passkey',
        color: 'red',
      });
    } finally {
      setPasskeyLoading(false);
    }
  };

  const enabledProviders = providers.filter((p) => p.enabled);
  const hasOAuth = enabledProviders.length > 0;

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
          {/* Credentials step */}
          <Transition mounted={step === 'credentials'} transition="fade" duration={300}>
            {(styles) => (
              <form onSubmit={handleSubmit} style={styles}>
                <Stack gap="lg">
                  <Center>
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
                      <path d="M17 20 L28 13 L39 20 L39 36 L28 43 L17 36Z" stroke="url(#loginGrad)" strokeWidth="1.5" fill="rgba(32,201,151,0.12)" />
                      <line x1="28" y1="13" x2="28" y2="43" stroke="url(#loginGrad)" strokeWidth="0.5" opacity="0.3" />
                      <line x1="17" y1="20" x2="39" y2="36" stroke="url(#loginGrad)" strokeWidth="0.5" opacity="0.3" />
                      <line x1="39" y1="20" x2="17" y2="36" stroke="url(#loginGrad)" strokeWidth="0.5" opacity="0.3" />
                      <circle cx="28" cy="28" r="5" fill="url(#loginGrad)" filter="url(#logoGlow)" />
                      <circle cx="28" cy="28" r="2" fill="#0F1318" />
                    </svg>
                  </Center>

                  <Box>
                    <Text ta="center" size="20px" fw={700} style={{ color: '#C1C2C5' }}>
                      {t('login.title')}
                    </Text>
                    <Text ta="center" size="sm" mt={4} style={{ color: '#5c5f66' }}>
                      {t('login.subtitle')}
                    </Text>
                  </Box>

                  <TextInput
                    label={t('login.email')}
                    placeholder={t('login.emailPlaceholder')}
                    leftSection={<IconMail size={16} color="#5c5f66" />}
                    value={email}
                    onChange={(e) =>
                      loginForm.setFieldValue('email', e.currentTarget.value)
                    }
                    onBlur={() => loginForm.setFieldTouched('email', true)}
                    error={loginForm.getInputProps('email').error}
                    radius="md"
                    styles={inputFocusStyles}
                  />

                  <PasswordInput
                    label={t('login.password')}
                    placeholder={t('login.passwordPlaceholder')}
                    leftSection={<IconLock size={16} color="#5c5f66" />}
                    value={password}
                    onChange={(e) =>
                      loginForm.setFieldValue('password', e.currentTarget.value)
                    }
                    onBlur={() => loginForm.setFieldTouched('password', true)}
                    error={loginForm.getInputProps('password').error}
                    radius="md"
                    styles={{
                      ...inputFocusStyles,
                      innerInput: { color: '#C1C2C5' },
                    }}
                  />

                  <Checkbox
                    label={t('login.rememberMe')}
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.currentTarget.checked)}
                    color="teal"
                    size="sm"
                    styles={{
                      label: { color: '#909296', fontSize: '13px' },
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
                    styles={{
                      root: {
                        height: 44,
                        fontWeight: 600,
                        transition: 'all 0.2s ease',
                      },
                    }}
                  >
                    {t('login.signIn')}
                  </Button>

                  {/* Passkey login */}
                  <Button
                    fullWidth
                    variant="outline"
                    color="gray"
                    radius="md"
                    loading={passkeyLoading}
                    onClick={handlePasskeyLogin}
                    leftSection={<IconFingerprint size={18} />}
                    styles={{
                      root: {
                        height: 42,
                        borderColor: 'rgba(255,255,255,0.1)',
                        color: '#909296',
                      },
                    }}
                  >
                    Sign in with Passkey
                  </Button>

                  {/* OAuth providers */}
                  {hasOAuth && (
                    <>
                      <Divider
                        label="or continue with"
                        labelPosition="center"
                        styles={{
                          label: { color: '#5c5f66', fontSize: '11px' },
                          root: { borderColor: 'rgba(255,255,255,0.06)' },
                        }}
                      />

                      <Group justify="center" gap="md">
                        {enabledProviders.map((p) => {
                          if (p.provider === 'telegram') {
                            return (
                              <Tooltip label="Telegram" key="telegram">
                                <ActionIcon
                                  size={44}
                                  radius="md"
                                  variant="outline"
                                  styles={{
                                    root: {
                                      borderColor: 'rgba(255,255,255,0.08)',
                                      color: '#2AABEE',
                                    },
                                  }}
                                >
                                  <IconBrandTelegram size={22} />
                                </ActionIcon>
                              </Tooltip>
                            );
                          }
                          if (p.provider === 'github') {
                            return (
                              <Tooltip label="GitHub" key="github">
                                <ActionIcon
                                  size={44}
                                  radius="md"
                                  variant="outline"
                                  onClick={handleGitHubLogin}
                                  styles={{
                                    root: {
                                      borderColor: 'rgba(255,255,255,0.08)',
                                      color: '#C1C2C5',
                                    },
                                  }}
                                >
                                  <IconBrandGithub size={22} />
                                </ActionIcon>
                              </Tooltip>
                            );
                          }
                          if (p.provider === 'yandex') {
                            return (
                              <Tooltip label="Yandex" key="yandex">
                                <ActionIcon
                                  size={44}
                                  radius="md"
                                  variant="outline"
                                  onClick={handleYandexLogin}
                                  styles={{
                                    root: {
                                      borderColor: 'rgba(255,255,255,0.08)',
                                      color: '#FC3F1D',
                                    },
                                  }}
                                >
                                  <YandexIcon size={20} />
                                </ActionIcon>
                              </Tooltip>
                            );
                          }
                          return null;
                        })}
                      </Group>
                    </>
                  )}

                  <Text ta="center" size="xs" style={{ color: '#373A40' }}>
                    {t('login.version')}
                  </Text>
                </Stack>
              </form>
            )}
          </Transition>

          {/* 2FA step */}
          <Transition mounted={step === '2fa'} transition="fade" duration={300}>
            {(styles) => (
              <Stack gap="lg" style={styles}>
                <Center>
                  <Box
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: '50%',
                      backgroundColor: 'rgba(32,201,151,0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <IconShieldLock size={28} color="#20C997" stroke={1.5} />
                  </Box>
                </Center>

                <Box>
                  <Text ta="center" size="20px" fw={700} style={{ color: '#C1C2C5' }}>
                    {t('login.twoFactorTitle')}
                  </Text>
                  <Text ta="center" size="sm" mt={4} style={{ color: '#5c5f66' }}>
                    {t('login.twoFactorSubtitle')}
                  </Text>
                </Box>

                <Center>
                  <PinInput
                    length={6}
                    type="number"
                    value={twoFactorCode}
                    onChange={setTwoFactorCode}
                    size="lg"
                    styles={{
                      input: {
                        backgroundColor: '#161B23',
                        border: '1px solid rgba(255,255,255,0.06)',
                        color: '#C1C2C5',
                        fontFamily: "'JetBrains Mono', monospace",
                        fontWeight: 700,
                        fontSize: '18px',
                      },
                    }}
                  />
                </Center>

                <Button
                  fullWidth
                  loading={verifying}
                  variant="gradient"
                  gradient={{ from: '#20C997', to: '#339AF0' }}
                  size="md"
                  radius="md"
                  onClick={handleVerify2FA}
                  disabled={twoFactorCode.length !== 6}
                  styles={{
                    root: {
                      height: 44,
                      fontWeight: 600,
                    },
                  }}
                >
                  {t('login.verify')}
                </Button>

                <Button
                  variant="subtle"
                  color="gray"
                  radius="md"
                  leftSection={<IconArrowLeft size={16} />}
                  onClick={handleBackToLogin}
                  styles={{
                    root: { color: '#5c5f66' },
                  }}
                >
                  {t('login.backToLogin')}
                </Button>
              </Stack>
            )}
          </Transition>
        </Card>
      </Box>
    </Box>
  );
}
