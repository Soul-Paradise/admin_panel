import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  // A production bundle without VITE_API_URL would quietly call localhost from
  // every admin's browser. Fail the build instead.
  if (command === 'build' && mode === 'production') {
    const env = loadEnv(mode, process.cwd(), 'VITE_')
    if (!env.VITE_API_URL?.trim()) {
      throw new Error(
        'VITE_API_URL is not set. Define it (e.g. https://<backend>/api/v1) before running a production build.',
      )
    }
  }

  return {
    plugins: [react(), tailwindcss()],
  }
})
