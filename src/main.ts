import './ui/styles.css';
import { App } from './app/App';
import { tr } from './i18n/tr';

const root = document.getElementById('app');
if (!root) throw new Error('#app root element missing');

document.title = tr.appTitle;

try {
  const app = new App(root);
  if (import.meta.env.DEV) Object.assign(window, { __app: app });
} catch (err) {
  root.textContent = tr.webglError;
  root.classList.add('fatal');
  throw err;
}
