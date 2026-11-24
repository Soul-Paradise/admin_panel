import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import StagingBanner from './components/StagingBanner.tsx'
import { applyStagingDocumentState } from './lib/app-env.ts'

applyStagingDocumentState()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StagingBanner />
    <App />
  </StrictMode>,
)
