import { build } from 'vite';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

async function runBuild() {
  console.log('Building popup and copying public assets...');
  await build({
    configFile: false,
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      rollupOptions: {
        input: {
          popup: resolve(__dirname, 'src/popup/popup.html'),
        },
        output: {
          entryFileNames: 'popup.js',
          assetFileNames: (asset) => {
            if (asset.name && asset.name.endsWith('.css')) return 'popup.css';
            return 'assets/[name].[ext]';
          }
        }
      }
    }
  });

  // Move popup.html from dist/src/popup/popup.html to dist/popup.html
  const nestedPopup = resolve(__dirname, 'dist/src/popup/popup.html');
  const targetPopup = resolve(__dirname, 'dist/popup.html');
  if (fs.existsSync(nestedPopup)) {
    let html = fs.readFileSync(nestedPopup, 'utf-8');
    // Ensure relative paths for extension context
    html = html.replace(/src="\/popup\.js"/g, 'src="popup.js"');
    html = html.replace(/href="\/popup\.css"/g, 'href="popup.css"');
    fs.writeFileSync(targetPopup, html, 'utf-8');
    fs.rmSync(resolve(__dirname, 'dist/src'), { recursive: true, force: true });
  }

  console.log('Building content script (IIFE)...');
  await build({
    configFile: false,
    publicDir: false,
    build: {
      outDir: 'dist',
      emptyOutDir: false,
      lib: {
        entry: resolve(__dirname, 'src/content/index.ts'),
        name: 'LeetfoxContent',
        formats: ['iife'],
        fileName: () => 'content.js'
      },
      rollupOptions: {
        output: {
          assetFileNames: (asset) => {
            if (asset.name && asset.name.endsWith('.css')) return 'content.css';
            return 'assets/[name].[ext]';
          }
        }
      }
    }
  });

  console.log('Building background script (IIFE)...');
  await build({
    configFile: false,
    publicDir: false,
    build: {
      outDir: 'dist',
      emptyOutDir: false,
      lib: {
        entry: resolve(__dirname, 'src/background/index.ts'),
        name: 'LeetfoxBackground',
        formats: ['iife'],
        fileName: () => 'background.js'
      }
    }
  });

  console.log('Build completed successfully!');
}

runBuild().catch(err => {
  console.error('Build failed:', err);
  process.exit(1);
});
