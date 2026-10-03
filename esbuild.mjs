import { build } from 'esbuild';
import { sassPlugin } from 'esbuild-sass-plugin'
import fsSync from 'fs';
import path from 'path';
import { glob } from 'glob';

const resourcesDir = "resources";
const distDir = "dist";

function printError(text) {
    console.error(`\x1b[31m${text}\x1b[0m`);
}

// build extension
build({
    logLevel: "info",
    entryPoints: ['src/**/*.ts', 'src/styles/stylesheet.scss', 'src/styles/prefs.scss', 'src/prefs.ts'],
    outdir: distDir,
    bundle: false,
    treeShaking: false,
    // gjs runs current SpiderMonkey: keep class static blocks and the rest
    // of ES2024 as written instead of lowering them
    target: 'es2024',
    platform: 'node',
    format: 'esm',
    plugins: [sassPlugin()],
}).then(async () => {
    const excludedFiles = [ // paths relative to dist directory
        './ambient.d.js', // not needed in the build
        './indicator/currentMenu.js', // it is empty
        './components/tilingsystem/extendedWindow.js' // it is empty
    ];
    excludedFiles.forEach(file => {
        fsSync.rmSync(path.resolve(distDir, file), { recursive: true, force: true });
    });

    // Post-build sync steps
    fsSync.renameSync(path.resolve(distDir, "styles/stylesheet.css"), path.resolve(distDir, "stylesheet.css"));
    fsSync.renameSync(path.resolve(distDir, "styles/prefs.css"), path.resolve(distDir, "prefs.css"));
    fsSync.rmdirSync(path.resolve(distDir, "styles"));
    fsSync.cpSync(resourcesDir, distDir, { recursive: true });

    const generatedFiles = await glob(`${distDir}/**/*.js`, {});

    console.log("   🔍", "Verifying imports...");
    await Promise.all(generatedFiles.map(f => {
        if (f.includes('prefs.js')) return verifyImports(['Clutter', 'Meta', 'Mtk', 'St', 'Shell'], f);
        return verifyImports(['Gdk', 'Gtk', 'Adw'], f);
    }));
    console.log();
    console.log("📁 ", "Extension directory:", distDir);
});

function verifyImports(modules, fileName) {
    return new Promise(resolve => {
        const content = fsSync.readFileSync(fileName, 'utf-8');
        const lines = content.split('\n');
        modules.forEach(m => {
            lines.forEach((line, i) => {
                if (line.includes(`import ${m}`)) {
                    printError(`      ⚠️  WARNING: "${m}" was imported in ${fileName} at line ${i}`);
                }
            });
        });
        resolve();
    });
}
