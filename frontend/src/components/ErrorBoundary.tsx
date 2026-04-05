import { Component, type ErrorInfo, type ReactNode } from 'react';
import {
  Box,
  Button,
  Card,
  Code,
  Collapse,
  Group,
  Stack,
  Text,
} from '@mantine/core';
import { IconAlertTriangle, IconRefresh, IconChevronDown } from '@tabler/icons-react';

interface Props {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  detailsOpen: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      detailsOpen: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // eslint-disable-next-line no-console
    console.error('ErrorBoundary caught error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      detailsOpen: false,
    });
    window.location.reload();
  };

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      detailsOpen: false,
    });
  };

  toggleDetails = (): void => {
    this.setState((prev) => ({ detailsOpen: !prev.detailsOpen }));
  };

  render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.handleReset);
      }

      const { error, errorInfo, detailsOpen } = this.state;

      return (
        <Box
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'flex-start',
            minHeight: 400,
            padding: 32,
          }}
        >
          <Card
            p="xl"
            radius="lg"
            style={{
              backgroundColor: '#1E2128',
              border: '1px solid rgba(255,107,107,0.2)',
              maxWidth: 720,
              width: '100%',
            }}
          >
            <Stack gap="md">
              <Group gap="sm">
                <Box
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    backgroundColor: 'rgba(255,107,107,0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <IconAlertTriangle size={24} color="#ff6b6b" stroke={1.5} />
                </Box>
                <Box>
                  <Text size="lg" fw={700} style={{ color: '#C1C2C5' }}>
                    Something went wrong
                  </Text>
                  <Text size="xs" style={{ color: '#5c5f66' }}>
                    An unexpected error was caught by the boundary
                  </Text>
                </Box>
              </Group>

              <Card
                p="md"
                radius="md"
                style={{
                  backgroundColor: '#161B23',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <Text size="sm" ff="monospace" style={{ color: '#ff6b6b' }}>
                  {error.message || 'Unknown error'}
                </Text>
              </Card>

              <Group gap="sm">
                <Button
                  variant="gradient"
                  gradient={{ from: 'teal', to: 'cyan' }}
                  radius="md"
                  leftSection={<IconRefresh size={16} />}
                  onClick={this.handleReload}
                >
                  Reload
                </Button>
                <Button
                  variant="subtle"
                  color="gray"
                  radius="md"
                  onClick={this.handleReset}
                >
                  Try again
                </Button>
                <Button
                  variant="subtle"
                  color="gray"
                  radius="md"
                  rightSection={
                    <IconChevronDown
                      size={14}
                      style={{
                        transform: detailsOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s ease',
                      }}
                    />
                  }
                  onClick={this.toggleDetails}
                >
                  {detailsOpen ? 'Hide details' : 'Show details'}
                </Button>
              </Group>

              <Collapse in={detailsOpen}>
                <Stack gap="xs">
                  {error.stack && (
                    <Box>
                      <Text size="xs" fw={600} mb={4} style={{ color: '#5c5f66' }}>
                        Stack trace
                      </Text>
                      <Code
                        block
                        style={{
                          backgroundColor: '#161B23',
                          border: '1px solid rgba(255,255,255,0.06)',
                          color: '#909296',
                          fontSize: '11px',
                          maxHeight: 240,
                          overflow: 'auto',
                        }}
                      >
                        {error.stack}
                      </Code>
                    </Box>
                  )}
                  {errorInfo?.componentStack && (
                    <Box>
                      <Text size="xs" fw={600} mb={4} style={{ color: '#5c5f66' }}>
                        Component stack
                      </Text>
                      <Code
                        block
                        style={{
                          backgroundColor: '#161B23',
                          border: '1px solid rgba(255,255,255,0.06)',
                          color: '#909296',
                          fontSize: '11px',
                          maxHeight: 200,
                          overflow: 'auto',
                        }}
                      >
                        {errorInfo.componentStack}
                      </Code>
                    </Box>
                  )}
                </Stack>
              </Collapse>
            </Stack>
          </Card>
        </Box>
      );
    }

    return this.props.children;
  }
}
