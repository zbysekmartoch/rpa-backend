import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const BACKEND_DIR = path.join(__dirname, '../..');

/**
 * Helper funkce pro stažení ZIP souboru z harvesteru
 */
export async function downloadZipFromHarvester(host, endpoint, outputPath) {
  try {
    const url = `${host.replace(/\/$/, '')}${endpoint}`;
    console.log(`Downloading ZIP from: ${url}`);
    
    const response = await fetch(url, {
      method: 'GET',
      timeout: 300000, // 5 minut timeout pro velké soubory
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }

    // Zkontroluj content type
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/zip')) {
      console.warn(`Unexpected content type: ${contentType}`);
    }

    // Stáhni a ulož soubor
    const buffer = await response.arrayBuffer();
    await fs.writeFile(outputPath, Buffer.from(buffer));
    
    console.log(`ZIP file downloaded: ${outputPath} (${buffer.byteLength} bytes)`);
    return outputPath;
  } catch (error) {
    throw new Error(`Failed to download ZIP: ${error.message}`);
  }
}

/**
 * Helper funkce pro spuštění import scriptu
 */
export async function runImportScript(zipFilePath) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(BACKEND_DIR, 'import-data.cjs');
    
    console.log(`Running import script: ${scriptPath} with file: ${zipFilePath}`);
    
    const childProcess = spawn('node', [scriptPath, zipFilePath], {
      cwd: BACKEND_DIR,
      env: process.env
    });

    let stdout = '';
    let stderr = '';

    childProcess.stdout.on('data', (data) => {
      const output = data.toString();
      stdout += output;
      console.log(`Import script output: ${output}`);
    });

    childProcess.stderr.on('data', (data) => {
      const output = data.toString();
      stderr += output;
      console.error(`Import script error: ${output}`);
    });

    childProcess.on('error', (error) => {
      reject(new Error(`Failed to start import script: ${error.message}`));
    });

    childProcess.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true, stdout, stderr });
      } else {
        reject(new Error(`Import script exited with code ${code}\nStderr: ${stderr}`));
      }
    });
  });
}
