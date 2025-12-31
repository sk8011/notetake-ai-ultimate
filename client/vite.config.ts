import { defineConfig } from 'vite'
import type { ViteDevServer } from 'vite'
import react from '@vitejs/plugin-react'
import type { ServerResponse, IncomingMessage } from 'http';
import tailwindcss from '@tailwindcss/vite';

// Vite plugin to serve font files with correct MIME types
function fontMimeTypePlugin() {
  return {
 name: 'font-mime-type',
 configureServer(server: ViteDevServer) {
   server.middlewares.use((req: IncomingMessage, res: ServerResponse, next: () => void) => {
     if (req.url?.endsWith('.woff')) {
       res.setHeader('Content-Type', 'application/font-woff');
     } else if (req.url?.endsWith('.woff2')) {
       res.setHeader('Content-Type', 'application/font-woff2');
     }
     next();
   });
 },
  };
}

// https://vite.dev/config/
export default defineConfig({
  base: '/', // Set this to your base URL, e.g., '/my-app/' if deployed to a subdirectory
  plugins: [
    react(), 
    fontMimeTypePlugin(), 
    tailwindcss(),
  ], // Add the plugin here
  publicDir: 'public',
  server: {
    fs: {
      allow: ['.', '/node_modules/bootstrap-icons'],
    },
  },
  build: {
    rollupOptions: {
      output: {
        assetFileNames: '[name].[ext]',
      },
    },
  },
})
