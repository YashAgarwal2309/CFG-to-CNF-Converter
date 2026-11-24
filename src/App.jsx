import { Component } from 'react';
import { WorkspaceProvider, useWorkspace } from './context/WorkspaceContext.jsx';
import { AppShell } from './components/layout/AppShell.jsx';
import Dashboard from './pages/Dashboard.jsx';
import EditorPage from './pages/EditorPage.jsx';
import ConverterPage from './pages/ConverterPage.jsx';
import VisualizerPage from './pages/VisualizerPage.jsx';
import LibraryPage from './pages/LibraryPage.jsx';
import LearnPage from './pages/LearnPage.jsx';
import AboutPage from './pages/AboutPage.jsx';

const PAGES = {
  dashboard: Dashboard,
  editor: EditorPage,
  converter: ConverterPage,
  visualizer: VisualizerPage,
  library: LibraryPage,
  learn: LearnPage,
  about: AboutPage,
};

/** Keeps a rendering error on one page from taking down the whole app. */
class PageErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidUpdate(prev) {
    if (prev.route !== this.props.route && this.state.error) this.setState({ error: null });
  }

  render() {
    if (this.state.error) {
      return (
        <div className="card card-pad mx-auto max-w-xl text-center">
          <h1 className="text-lg font-semibold text-fg">Something went wrong on this page</h1>
          <p className="mt-2 text-sm text-muted">{String(this.state.error.message || this.state.error)}</p>
          <button
            type="button"
            className="mt-4 rounded-xl border border-line px-4 py-2 text-sm text-fg hover:bg-surface-2"
            onClick={() => this.setState({ error: null })}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function CurrentPage() {
  const { route } = useWorkspace();
  const Page = PAGES[route] ?? Dashboard;
  return (
    <PageErrorBoundary route={route}>
      <Page />
    </PageErrorBoundary>
  );
}

export default function App() {
  return (
    <WorkspaceProvider>
      <AppShell>
        <CurrentPage />
      </AppShell>
    </WorkspaceProvider>
  );
}
