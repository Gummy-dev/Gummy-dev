import React from 'react'
import TabletopApp from './tabletop/TabletopApp.jsx'
import { editionForPath } from './tabletop/editions.js'

class GameErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error) {
    return { error }
  }
  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-8">
          <div className="w-full max-w-2xl rounded-xl border border-red-700 bg-red-950/40 p-6">
            <h2 className="text-lg font-black text-red-300 mb-3">렌더링 오류 발생</h2>
            <pre className="whitespace-pre-wrap text-sm text-red-200/80 font-mono leading-relaxed">
              {String(this.state.error?.message ?? this.state.error)}
            </pre>
            <pre className="mt-3 whitespace-pre-wrap text-xs text-red-400/60 font-mono">
              {this.state.error?.stack}
            </pre>
            <button
              onClick={() => { this.setState({ error: null }); window.location.reload() }}
              className="mt-4 rounded-lg border border-red-600 bg-red-900/60 px-4 py-2 text-sm text-red-100 hover:bg-red-800/60"
            >
              다시 시작
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

export default function App() {
  const edition = editionForPath(location.pathname)
  return <GameErrorBoundary><TabletopApp key={edition} edition={edition} /></GameErrorBoundary>
}
