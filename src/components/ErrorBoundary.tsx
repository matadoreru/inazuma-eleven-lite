import { Component, type ReactNode } from 'react'
import { clearAutoSave } from '../services/saveService'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  handleReset = () => {
    clearAutoSave()
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-full flex flex-col items-center justify-center gap-6 bg-gray-900 px-6 text-center">
          <div className="text-red-400 text-5xl">⚠</div>
          <div>
            <p className="text-white font-bold text-lg mb-2">Algo ha ido mal</p>
            <p className="text-gray-400 text-sm max-w-xs">
              Hubo un error al cargar la partida guardada. Se reiniciará la aplicación.
            </p>
          </div>
          <button
            onClick={this.handleReset}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold text-sm transition-colors"
          >
            Reiniciar aplicación
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
