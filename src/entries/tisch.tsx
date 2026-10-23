// Tiny entry: the stylesheet and the header photo (tisch/index.html) paint first, the app follows.
import '@/styles/app.css';
import { afterFirstPaint } from './boot';

afterFirstPaint(() => void import('./tisch-app'));
