import { defineConfig } from 'eslint-define-config';

export default defineConfig({
  extends: [
    'expo',
    'prettier',
  ],
  rules: {
    'prettier/prettier': 'error',
  },
});