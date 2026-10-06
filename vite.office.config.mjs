import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins:[react()],base:'/portal-ui/',publicDir:false,
  build:{outDir:'integrations/smart-office/portal-ui',emptyOutDir:true,rollupOptions:{input:'office-portal.html'}},
});
