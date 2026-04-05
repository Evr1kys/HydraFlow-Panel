import { Box, Paper, Skeleton, SimpleGrid, Stack, Group } from '@mantine/core';

const cardStyle = {
  backgroundColor: '#1E2128',
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: 12,
};

type SkeletonVariant = 'table' | 'cards' | 'form' | 'dashboard';

interface LoadingSkeletonProps {
  variant?: SkeletonVariant;
  rows?: number;
}

export function LoadingSkeleton({ variant = 'table', rows = 5 }: LoadingSkeletonProps) {
  if (variant === 'dashboard') {
    return (
      <Stack gap="lg">
        <Group justify="space-between">
          <Skeleton height={28} width={180} radius="md" />
          <Skeleton height={32} width={120} radius="md" />
        </Group>
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 5 }} spacing="md">
          {Array.from({ length: 5 }).map((_, i) => (
            <Paper key={i} p="lg" style={cardStyle}>
              <Group gap="md" wrap="nowrap">
                <Skeleton height={48} width={48} circle />
                <Box style={{ flex: 1 }}>
                  <Skeleton height={10} width={80} radius="sm" />
                  <Skeleton height={24} width={100} mt={8} radius="sm" />
                </Box>
              </Group>
            </Paper>
          ))}
        </SimpleGrid>
        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
          {Array.from({ length: 3 }).map((_, i) => (
            <Paper key={i} p="lg" style={cardStyle}>
              <Stack gap="sm">
                <Skeleton height={12} width={80} radius="sm" />
                <Skeleton height={22} width={120} radius="sm" />
                <Skeleton height={50} radius="sm" />
              </Stack>
            </Paper>
          ))}
        </SimpleGrid>
      </Stack>
    );
  }

  if (variant === 'cards') {
    return (
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
        {Array.from({ length: rows }).map((_, i) => (
          <Paper key={i} p="lg" style={cardStyle}>
            <Stack gap="sm">
              <Group gap="sm">
                <Skeleton height={36} width={36} circle />
                <Skeleton height={16} width={140} radius="sm" />
              </Group>
              <Skeleton height={12} radius="sm" />
              <Skeleton height={12} width="80%" radius="sm" />
              <Skeleton height={12} width="60%" radius="sm" />
            </Stack>
          </Paper>
        ))}
      </SimpleGrid>
    );
  }

  if (variant === 'form') {
    return (
      <Stack gap="md">
        {Array.from({ length: rows }).map((_, i) => (
          <Box key={i}>
            <Skeleton height={12} width={100} radius="sm" mb={6} />
            <Skeleton height={38} radius="md" />
          </Box>
        ))}
        <Skeleton height={42} width={140} mt="md" radius="md" />
      </Stack>
    );
  }

  // default: table
  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Skeleton height={28} width={180} radius="md" />
        <Skeleton height={32} width={120} radius="md" />
      </Group>
      <Paper style={{ ...cardStyle, overflow: 'hidden' }} p="md">
        <Stack gap="xs">
          {/* Header row */}
          <Group gap="md" justify="space-between">
            <Skeleton height={12} width={120} radius="sm" />
            <Skeleton height={12} width={80} radius="sm" />
            <Skeleton height={12} width={80} radius="sm" />
            <Skeleton height={12} width={60} radius="sm" />
          </Group>
          {Array.from({ length: rows }).map((_, i) => (
            <Group key={i} gap="md" justify="space-between" py={8}>
              <Skeleton height={14} width={160} radius="sm" />
              <Skeleton height={14} width={90} radius="sm" />
              <Skeleton height={14} width={100} radius="sm" />
              <Skeleton height={14} width={50} radius="sm" />
            </Group>
          ))}
        </Stack>
      </Paper>
    </Stack>
  );
}
