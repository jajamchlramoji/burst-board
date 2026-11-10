import type { BurstApi } from '../shared/api';

declare global {
  interface Window {
    burst: BurstApi;
  }
}
