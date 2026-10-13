import './style.css';
import './landing.css';
import './landing-theme.css';
import { mountThemeControls } from './shared/theme.js';
import { mountLandingShell } from './landing/shell.js';

const root = document.querySelector('#landing');
mountLandingShell(root);
mountThemeControls({ buttons: [...root.querySelectorAll('[data-theme-choice]')] });
