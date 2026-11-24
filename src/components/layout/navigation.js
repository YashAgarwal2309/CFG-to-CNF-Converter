import {
  BookOpen,
  GitBranch,
  Info,
  LayoutDashboard,
  Library,
  PencilRuler,
  Workflow,
} from 'lucide-react';

export const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, description: 'Overview and quick start', key: '1' },
  { id: 'editor', label: 'Grammar Editor', icon: PencilRuler, description: 'Write and validate a CFG', key: '2' },
  { id: 'converter', label: 'CNF Converter', icon: Workflow, description: 'Run the full conversion', key: '3' },
  { id: 'visualizer', label: 'Step Visualizer', icon: GitBranch, description: 'Walk through every stage', key: '4' },
  { id: 'library', label: 'Grammar Library', icon: Library, description: 'Samples and saved grammars', key: '5' },
  { id: 'learn', label: 'Learn CNF', icon: BookOpen, description: 'Theory, examples and quiz', key: '6' },
  { id: 'about', label: 'About Project', icon: Info, description: 'Architecture and credits', key: '7' },
];

export const SHORTCUTS = [
  { keys: ['Alt', '1 – 7'], description: 'Jump to a page (Dashboard … About)' },
  { keys: ['Ctrl / ⌘', 'Enter'], description: 'Convert the current grammar to CNF' },
  { keys: ['?'], description: 'Open this help panel' },
  { keys: ['←', '→'], description: 'Step Visualizer: previous / next stage' },
  { keys: ['Space'], description: 'Step Visualizer: play / pause' },
  { keys: ['Home', 'End'], description: 'Step Visualizer: first / last stage' },
  { keys: ['Esc'], description: 'Close dialogs and menus' },
];
