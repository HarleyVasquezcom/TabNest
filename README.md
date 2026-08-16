# TabNest

A window-nesting (OneTab-style) tool for Chromium browsers (Manifest V3): one click stores every tab of the current window into a nest — title and URL — and closes the tabs so Chrome can release their memory. Restore one nest or all of them whenever you want.

Landing page: `https://tabnest-jade.vercel.app`

## What it does

- **Nest**: one click records every tab of the current window (title + URL), closes them, and stores a nest in `chrome.storage.local`.
- **Restore**: reopens all tabs of a nest; "Restore all" reopens every nest's tabs. Restoring removes the nest, OneTab-style.
- **Memory estimate**: each nest shows a deterministic estimate of saved memory (≈12 MB per http(s) tab) — documented as an estimate, not a Chrome measurement.
- **Domain grouping**: each nest groups its saved pages by domain with counts.
- **Search + manage**: filter nests by name, tab title, URL or domain; delete one nest (two-step) or clear all; archive keeps the latest 40 nests.
- Internal pages (`chrome-extension://…`) are never nested.

## Permissions — minimal and used

| Permission | Why |
| --- | --- |
| `storage` | nests + settings persisted in `chrome.storage.local` |
| `tabs` | reads the current window's tabs (title/URL) on nest, closes them, reopens them on restore |

No host permissions: page content is never read or modified.

## Install

1. Download `tabnest.zip` from the landing page and unpack it somewhere permanent.
2. Open `chrome://extensions`, enable Developer mode.
3. Click "Load unpacked" and pick the folder (keep the folder after loading).
4. Open the popup, nest a window, restore when you need the tabs back.

## Verify (headless probe)

Clone the repo, then:

```bash
npm install
npm run zip    # dist/tabnest.zip + landing copy (byte-identical)
npm run probe  # hermetic end-to-end probe against a headless Chrome (extension + landing)
```

---

# TabNest (ES)

Un gestor de ventanas al estilo OneTab para navegadores Chromium (Manifest V3): un clic guarda cada pestaña de la ventana actual en un nido — título y URL — y cierra las pestañas para que Chrome libere memoria. Restaura un nido o todos cuando quieras.

Página de aterrizaje: `https://tabnest-jade.vercel.app`

## Qué hace

- **Encerrar**: un clic registra cada pestaña de la ventana actual (título + URL), las cierra y guarda un nido en `chrome.storage.local`.
- **Restaurar**: reabre todas las pestañas de un nido; "Restaurar todo" reabre todas. Restaurar elimina el nido, al estilo OneTab.
- **Estimación de memoria**: cada nido muestra una estimación determinista de memoria liberada (≈12 MB por pestaña http(s)) — documentada como estimación, no como medición de Chrome.
- **Agrupación por dominio**: cada nido agrupa sus páginas guardadas por dominio con recuentos.
- **Búsqueda y gestión**: filtra nidos por nombre, título de pestaña, URL o dominio; borra un nido (en dos pasos) o limpia todo; el archivo conserva los últimos 40 nidos.
- Las páginas internas (`chrome-extension://…`) nunca se encierran.

## Permisos — mínimos y usados

| Permiso | Por qué |
| --- | --- |
| `storage` | nidos + ajustes persistidos en `chrome.storage.local` |
| `tabs` | lee las pestañas de la ventana actual (título/URL) al encerrar, las cierra y las reabre al restaurar |

Sin permisos de host: el contenido de las páginas nunca se lee ni modifica.

## Instalación

1. Descarga `tabnest.zip` desde la página de aterrizaje y descomprímelo en un lugar permanente.
2. Abre `chrome://extensions` y activa el modo desarrollador.
3. Haz clic en "Cargar descomprimida" y elige la carpeta (consérvala después de cargarla).
4. Abre el popup, encierra una ventana y restaura cuando necesites las pestañas de vuelta.

## Verificación (probe headless)

Clona el repo y ejecuta:

```bash
npm install
npm run zip    # dist/tabnest.zip + copia en landing (byte-idénticos)
npm run probe  # probe hermético end-to-end contra un Chrome headless (extensión + landing)
```

---

Built by Harley Vásquez — https://www.linkedin.com/in/harleyvasquez/