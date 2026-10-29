import fs from 'node:fs';
import path from 'node:path';
import { randomBytes, pbkdf2Sync, createCipheriv } from 'node:crypto';
import { ZipArchive } from 'archiver';
import { buildViewerData } from './exportData.js';

const PBKDF2_ITERATIONS = 100000;
const PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

// Contraseña generada al vuelo, nunca guardada: se muestra una sola vez al
// usuario tras exportar. Sin ella, el ZIP no revela ningun dato (ni siquiera
// los nombres de los candidatos, que van cifrados dentro del HTML).
function generatePassword(length = 20) {
  return Array.from(randomBytes(length), (b) => PASSWORD_ALPHABET[b % PASSWORD_ALPHABET.length]).join('');
}

// AES-256-GCM con clave derivada por PBKDF2, mismos parametros que el
// index.html descifra en el navegador via Web Crypto (SubtleCrypto). La
// contraseña en si nunca queda escrita en el HTML/JS, solo este cifrado.
function encryptPayload(password, plaintext) {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, 32, 'sha256');
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final(), cipher.getAuthTag()]);
  return {
    iterations: PBKDF2_ITERATIONS,
    salt: salt.toString('base64'),
    iv: iv.toString('base64'),
    data: ciphertext.toString('base64'),
  };
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function renderViewerHtml(jobName, encrypted) {
  const title = escapeHtml(`Candidatos — ${jobName}`);
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; background: #f5f6f8; color: #1a1a1a; }
  #gate { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; background: #1a1a1a; }
  #gate form { background: #fff; padding: 2rem; border-radius: 8px; width: 320px; max-width: 90vw; box-shadow: 0 10px 30px rgba(0,0,0,.3); }
  #gate h1 { margin: 0 0 1rem; font-size: 1.1rem; }
  #gate input { width: 100%; padding: .6rem; font-size: 1rem; border: 1px solid #ccc; border-radius: 6px; margin-bottom: .75rem; }
  #gate button { width: 100%; padding: .6rem; font-size: 1rem; border: none; border-radius: 6px; background: #0a66c2; color: #fff; cursor: pointer; }
  #gate button:disabled { opacity: .6; cursor: default; }
  #gate-error { color: #c0392b; font-size: .85rem; min-height: 1.2em; margin-bottom: .5rem; }
  #app { padding: 1.5rem; max-width: 1200px; margin: 0 auto; }
  #app header { display: flex; flex-wrap: wrap; gap: 1rem; align-items: center; justify-content: space-between; margin-bottom: 1rem; }
  #app h1 { font-size: 1.3rem; margin: 0; }
  #filter { padding: .5rem .7rem; font-size: 1rem; border: 1px solid #ccc; border-radius: 6px; min-width: 220px; }
  #count { color: #555; font-size: .85rem; }
  .table-wrap { overflow-x: auto; background: #fff; border-radius: 8px; box-shadow: 0 1px 4px rgba(0,0,0,.08); }
  table { width: 100%; border-collapse: collapse; font-size: .9rem; table-layout: fixed; }
  th, td { padding: .6rem .8rem; border-bottom: 1px solid #eee; text-align: left; max-width: 240px; overflow-wrap: break-word; }
  th { cursor: pointer; user-select: none; background: #fafafa; position: sticky; top: 0; }
  th.col-name, td.col-name { width: 160px; }
  th.col-publicProfileUrl, td.col-publicProfileUrl, th.col-pdfFile, td.col-pdfFile { width: 110px; max-width: 110px; white-space: nowrap; }
  th.col-photoFile, td.col-photoFile { width: 220px; max-width: 220px; padding: .3rem .4rem; cursor: default; }
  .avatar { width: 200px; height: 200px; border-radius: 50%; object-fit: cover; display: block; background: #e4e6eb; image-rendering: -webkit-optimize-contrast; }
  .avatar-placeholder { background: #e4e6eb; }
  tr:hover td { background: #f9fbff; }
  a { color: #0a66c2; text-decoration: none; }
  a:hover { text-decoration: underline; }
</style>
</head>
<body>
  <div id="gate">
    <form id="gate-form" autocomplete="off">
      <h1>${title}</h1>
      <div id="gate-error"></div>
      <input id="gate-password" type="password" placeholder="Contraseña" autofocus required />
      <button type="submit">Entrar</button>
    </form>
  </div>

  <div id="app" hidden>
    <header>
      <h1>${title}</h1>
      <div>
        <input id="filter" type="search" placeholder="Filtrar..." />
        <div id="count"></div>
      </div>
    </header>
    <div class="table-wrap">
      <table id="table"></table>
    </div>
  </div>

  <script id="viewer-data" type="application/json">${JSON.stringify(encrypted)}</script>
  <script>
  (function () {
    'use strict';

    function b64ToBytes(b64) {
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return bytes;
    }

    function escapeHtml(value) {
      return String(value).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    }

    async function decryptPayload(password, encrypted) {
      if (!window.crypto || !window.crypto.subtle) {
        throw new Error('Esta pagina necesita HTTPS (o localhost) para descifrar los datos.');
      }
      const enc = new TextEncoder();
      const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
      const key = await crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt: b64ToBytes(encrypted.salt), iterations: encrypted.iterations, hash: 'SHA-256' },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
      );
      const plainBuf = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: b64ToBytes(encrypted.iv) },
        key,
        b64ToBytes(encrypted.data)
      );
      return JSON.parse(new TextDecoder().decode(plainBuf));
    }

    function renderApp(data) {
      const columns = [
        { key: 'photoFile', label: '' },
        { key: 'name', label: 'Nombre' },
        { key: 'publicProfileUrl', label: 'Perfil LinkedIn' },
        { key: 'pdfFile', label: 'CV' },
      ].concat(data.questionColumns.map(function (c) { return { key: 'answers.' + c.field, label: c.label }; }));

      let sortKey = 'name';
      let sortDir = 1;
      let filterText = '';

      function getValue(row, key) {
        if (key.indexOf('answers.') === 0) return row.answers[key.slice(8)] || '';
        return row[key] || '';
      }

      function matchesFilter(row) {
        if (!filterText) return true;
        const haystack = columns.map(function (c) { return getValue(row, c.key); }).join(' ').toLowerCase();
        return haystack.indexOf(filterText) !== -1;
      }

      const tableEl = document.getElementById('table');
      const countEl = document.getElementById('count');

      function render() {
        const rows = data.rows.filter(matchesFilter).slice().sort(function (a, b) {
          const av = String(getValue(a, sortKey));
          const bv = String(getValue(b, sortKey));
          return av.localeCompare(bv, 'es', { numeric: true }) * sortDir;
        });

        const baseCols = { photoFile: 1, name: 1, publicProfileUrl: 1, pdfFile: 1 };
        function colClass(key) { return baseCols[key] ? ' class="col-' + key + '"' : ''; }

        const thead = columns.map(function (c) {
          const arrow = sortKey === c.key ? (sortDir === 1 ? ' ▲' : ' ▼') : '';
          return '<th data-key="' + c.key + '"' + colClass(c.key) + ' title="' + escapeHtml(c.label) + '">' + escapeHtml(c.label) + arrow + '</th>';
        }).join('');

        const tbody = rows.map(function (r) {
          const cells = columns.map(function (c) {
            if (c.key === 'photoFile') {
              return r.photoFile
                ? '<td' + colClass(c.key) + '><img class="avatar" src="' + escapeHtml(r.photoFile) + '" alt="" loading="lazy" /></td>'
                : '<td' + colClass(c.key) + '><div class="avatar avatar-placeholder"></div></td>';
            }
            if (c.key === 'publicProfileUrl') {
              return r.publicProfileUrl
                ? '<td' + colClass(c.key) + '><a href="' + escapeHtml(r.publicProfileUrl) + '" target="_blank" rel="noopener">Ver perfil ↗</a></td>'
                : '<td' + colClass(c.key) + '>—</td>';
            }
            if (c.key === 'pdfFile') {
              return r.pdfFile
                ? '<td' + colClass(c.key) + '><a href="' + escapeHtml(r.pdfFile) + '" target="_blank" rel="noopener">Ver CV ↗</a></td>'
                : '<td' + colClass(c.key) + '>—</td>';
            }
            const value = getValue(r, c.key);
            return '<td' + colClass(c.key) + (value ? ' title="' + escapeHtml(value) + '"' : '') + '>' + escapeHtml(value) + '</td>';
          }).join('');
          return '<tr>' + cells + '</tr>';
        }).join('');

        tableEl.innerHTML = '<thead><tr>' + thead + '</tr></thead><tbody>' + tbody + '</tbody>';
        countEl.textContent = rows.length + ' de ' + data.rows.length + ' candidatos';
      }

      document.getElementById('filter').addEventListener('input', function (e) {
        filterText = e.target.value.toLowerCase();
        render();
      });
      tableEl.addEventListener('click', function (e) {
        const th = e.target.closest('th');
        if (!th) return;
        const key = th.dataset.key;
        if (sortKey === key) sortDir *= -1; else { sortKey = key; sortDir = 1; }
        render();
      });

      render();
    }

    const encrypted = JSON.parse(document.getElementById('viewer-data').textContent);
    const gate = document.getElementById('gate');
    const gateForm = document.getElementById('gate-form');
    const gateError = document.getElementById('gate-error');
    const gateButton = gateForm.querySelector('button');
    const app = document.getElementById('app');

    gateForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      gateError.textContent = '';
      gateButton.disabled = true;
      try {
        const data = await decryptPayload(document.getElementById('gate-password').value, encrypted);
        gate.remove();
        app.hidden = false;
        renderApp(data);
      } catch (err) {
        gateError.textContent = 'Contraseña incorrecta.';
        gateButton.disabled = false;
      }
    });
  })();
  </script>
</body>
</html>
`;
}

// Construye el ZIP del visualizador estatico (index.html + carpeta cv/ con
// los PDFs bajo nombres aleatorios) y lo escribe directamente en la
// response. Devuelve la contraseña generada para que el caller la exponga
// (headers), ya que no se guarda en ningun sitio: si se pierde, hay que
// volver a exportar.
export function streamViewerExport(job, res) {
  const password = generatePassword();
  const { questionColumns, rows } = buildViewerData(job.id);

  const fileEntries = [];
  const viewerRows = rows.map((row) => {
    let pdfFile = null;
    if (row.pdfPath && fs.existsSync(row.pdfPath)) {
      const token = randomBytes(16).toString('hex');
      pdfFile = `cv/${token}.pdf`;
      fileEntries.push({ path: row.pdfPath, name: pdfFile });
    }
    let photoFile = null;
    if (row.photoPath && fs.existsSync(row.photoPath)) {
      const token = randomBytes(16).toString('hex');
      const ext = path.extname(row.photoPath) || '.jpg';
      photoFile = `photos/${token}${ext}`;
      fileEntries.push({ path: row.photoPath, name: photoFile });
    }
    return {
      name: row.name,
      publicProfileUrl: row.publicProfileUrl,
      pdfFile,
      photoFile,
      answers: row.answers,
    };
  });

  const payload = JSON.stringify({ questionColumns, rows: viewerRows });
  const encrypted = encryptPayload(password, payload);
  const html = renderViewerHtml(job.name, encrypted);

  res.setHeader('X-Viewer-Password', password);
  res.setHeader('Content-Type', 'application/zip');

  const archive = new ZipArchive({ zlib: { level: 9 } });
  archive.on('error', (err) => {
    res.destroy(err);
  });
  archive.pipe(res);
  archive.append(html, { name: 'index.html' });
  for (const { path: filePath, name: entryName } of fileEntries) {
    archive.file(filePath, { name: entryName });
  }
  archive.finalize();
}
