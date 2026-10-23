// Tiny entry: the stylesheet paints first, the app follows (see boot.ts).
import '@/styles/app.css';
import { afterFirstPaint } from './boot';

afterFirstPaint(() => void import('./theke-app'));
