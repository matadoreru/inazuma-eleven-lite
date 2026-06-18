import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import { useCareerStore } from './store/careerStore'
import { autoSave, clearAutoSave } from './services/saveService'

// Restore last session automatically before first render
try {
  useCareerStore.getState().restoreAutoSave()
} catch {
  clearAutoSave()
}

// Auto-save whenever career state changes (500ms debounce)
let debounceTimer: ReturnType<typeof setTimeout> | null = null
useCareerStore.subscribe((state, prevState) => {
  if (!state.career || state.career === prevState.career) return
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    autoSave(state.career!, state.players, state.teams)
  }, 500)
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
)
