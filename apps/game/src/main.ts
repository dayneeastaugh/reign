import { mount } from 'svelte';
import '@fontsource/libre-caslon-text/400.css';
import '@fontsource/libre-caslon-text/700.css';
import '@fontsource/source-sans-3/400.css';
import '@fontsource/source-sans-3/600.css';
import App from './App.svelte';
import './theme.css';

mount(App, { target: document.getElementById('app')! });
