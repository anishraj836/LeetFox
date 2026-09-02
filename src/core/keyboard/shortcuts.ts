export interface ShortcutAction {
  id: string;
  name: string;
  description: string;
  keyCombination: string;
  handler: () => void | Promise<void>;
  category?: 'Navigation' | 'Actions' | 'View' | 'System';
}
