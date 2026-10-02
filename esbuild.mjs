import { build } from 'esbuild';
import { sassPlugin } from 'esbuild-sass-plugin'
import fsSync from 'fs';
import path from 'path';
import { glob } from 'glob';
import { ESLint } from "eslint";

const resourcesDir = "resources";
const distDir = "dist";

async function preprocess(files) {
    const eslint = new ESLint({
        fix: true,
    });
    await Promise.all(files.map(async (filename) => {
        let text = fsSync.readFileSync(filename, 'utf-8');

        // drop lines tagged with "// @esbuild-drop-next-line"
        text = text.replace(/\/\/\s*@esbuild-drop-next-line\s*\n.*?;/gs, '');

        // Ensure every import has ".js" at end end, excluding GJS imports
        text = text.replace(
            /import\s+([\s\S]*?)\s+from\s+['"]([^'"]+)['"]/g,
            (_match, imports, importPath) => {
                if (!importPath.endsWith('.js') && !importPath.startsWith('gi://')) {
                    importPath += '.js';
                }
                return `import ${imports} from "${importPath}"`;
            }
        );

        // Run ESLint on the file
        const lintResults = await eslint.lintText(text, { filePath: filename });
        text = lintResults.length > 0 ? lintResults[0].output || text : text;

        // Check if there are remaining errors
        const hasErrors = lintResults.some((r) =>
            r.messages.some((m) => m.severity === 2),
        );

        if (hasErrors) {
            const formatter = await eslint.loadFormatter("stylish");
            const output = formatter.format(lintResults);
            console.error(output);
        }

        fsSync.writeFileSync(filename, text, 'utf-8');
    }));
}

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
    target: 'firefox78',
    platform: 'node',
    format: 'esm',
    plugins: [sassPlugin()],
}).then(async () => {
    const excludedFiles = [ // paths relative to dist directory
        './ambient.d.js', // not needed in the build
        './indicator/currentMenu.js', // it is empty
        './components/tilepreview/blurTilePreview.js', // not used, but Shexli complains
        './components/tilingsystem/extendedWindow.js' // it is empty
    ];
    excludedFiles.forEach(file => {
        fsSync.rmSync(path.resolve(distDir, file), { recursive: true, force: true });
    });

    // Post-build sync steps
    fsSync.renameSync(path.resolve(distDir, "styles/stylesheet.css"), path.resolve(distDir, "stylesheet.css"));
    fsSync.renameSync(path.resolve(distDir, "styles/prefs.css"), path.resolve(distDir, "prefs.css"));
    fsSync.cpSync(resourcesDir, distDir, { recursive: true });

    // preprocess extension files in parallel
    console.log("   🛠️ ", "Preprocessing extension files...");
    const generatedFiles = await glob(`${distDir}/**/*.js`, {});
    await preprocess(generatedFiles);

    // run both verifications in parallel
    console.log("   🔍", "Verifying imports...");
    const verification = Promise.all(generatedFiles.map(f => {
        if (f.includes('prefs.js')) verifyImports(['Clutter', 'Meta', 'Mtk', 'St', 'Shell'], f);
        else verifyImports(['Gdk', 'Gtk', 'Adw'], f);
    }));

    await verification;
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
