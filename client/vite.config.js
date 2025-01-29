import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // So that it can interact with the Node server on port 5000
    port: 3000
  }
});
