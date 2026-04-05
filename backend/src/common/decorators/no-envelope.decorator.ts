import { SetMetadata } from '@nestjs/common';

export const NO_ENVELOPE_KEY = 'no_envelope';
export const NoEnvelope = () => SetMetadata(NO_ENVELOPE_KEY, true);
