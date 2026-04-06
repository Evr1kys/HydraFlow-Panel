import { Center, Loader } from '@mantine/core';

export function LoadingPage() {
  return (
    <Center style={{ minHeight: '60vh' }}>
      <Loader size="lg" color="teal" />
    </Center>
  );
}
