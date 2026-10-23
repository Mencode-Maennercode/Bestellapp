import { QrCode } from '@phosphor-icons/react';
import { mount } from './mount';
import { Notice } from '@/ui';

mount(
  <Notice icon={<QrCode size={44} />} title="Bestellsystem">
    Bitte den QR-Code an deinem Tisch scannen. Personal öffnet den Link vom Veranstalter.
  </Notice>,
);
